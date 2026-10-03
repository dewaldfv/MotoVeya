package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.BatteryManager
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import kotlin.math.sqrt

class MotoVeyaLocationForegroundService : Service(), SensorEventListener {
    companion object {
        const val ACTION_START = "com.motoveya.app.START_NATIVE_TRACKING"
        const val ACTION_STOP = "com.motoveya.app.STOP_NATIVE_TRACKING"
        const val EXTRA_DEVICE_TOKEN = "device_token"
        private const val CHANNEL_ID = "motoveya_ride_tracking"
        private const val NOTIFICATION_ID = 4401
        private const val LOCATION_INTERVAL_MS = 3000L
        private const val FASTEST_INTERVAL_MS = 1500L
        private const val PREFS = "motoveya_tracking"
        private const val TOKEN_KEY = "device_token"

        fun start(context: android.content.Context, token: String) {
            context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit()
                .putString(TOKEN_KEY, token).apply()
            val intent = Intent(context, MotoVeyaLocationForegroundService::class.java).apply {
                action = ACTION_START
                putExtra(EXTRA_DEVICE_TOKEN, token)
            }
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: android.content.Context) {
            context.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE).edit().remove(TOKEN_KEY).apply()
            context.startService(Intent(context, MotoVeyaLocationForegroundService::class.java).apply { action = ACTION_STOP })
        }
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var networkExecutor: java.util.concurrent.ExecutorService
    @Volatile private var deviceToken: String? = null
    @Volatile private var latestUnsentLocation: Location? = null
    @Volatile private var lastKnownLocation: Location? = null
    @Volatile private var postInFlight = false
    private var locationCallback: LocationCallback? = null
    private lateinit var sensorManager: SensorManager
    private var accelerometer: Sensor? = null
    private var rotationSensor: Sensor? = null
    private var highGAt = 0L
    private var highRotationAt = 0L
    private var suddenDecelAt = 0L
    private var strongestG = 0.0
    private var strongestRotation = 0.0
    private var lastSpeedKmh = 0.0
    private var lastSpeedAt = 0L
    private var crashCooldownUntil = 0L
    private val indicatorWindowMs = 1500L

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        networkExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
        deviceToken = getSharedPreferences(PREFS, MODE_PRIVATE).getString(TOKEN_KEY, null)
        restorePendingLocation()
        sensorManager = getSystemService(SENSOR_SERVICE) as SensorManager
        accelerometer = sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER)
        rotationSensor = sensorManager.getDefaultSensor(Sensor.TYPE_GYROSCOPE)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> { stopTracking(); stopSelf(); return START_NOT_STICKY }
            ACTION_START -> {
                intent.getStringExtra(EXTRA_DEVICE_TOKEN)?.takeIf { it.length >= 32 }?.let {
                    deviceToken = it
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN_KEY, it).apply()
                }
                if (deviceToken.isNullOrBlank()) { stopSelf(); return START_NOT_STICKY }
                startForeground(NOTIFICATION_ID, buildNotification("Ride tracking active"))
                startTracking()
                startCrashDetection()
            }
            null -> {
                // Android can recreate a START_STICKY service with a null Intent.
                if (deviceToken.isNullOrBlank()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForeground(NOTIFICATION_ID, buildNotification("Ride tracking resumed"))
                startTracking()
                startCrashDetection()
                postLocationIfPossible()
            }
        }
        return START_STICKY
    }

    private fun startTracking() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            stopSelf()
            return
        }
        if (locationCallback != null) return

        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, LOCATION_INTERVAL_MS)
            .setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
            .setWaitForAccurateLocation(false)
            .setMaxUpdateDelayMillis(6000L)
            .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { location ->
                    latestUnsentLocation = location
                    lastKnownLocation = Location(location)
                    updateCrashSpeed(location)
                    persistPendingLocation(location)
                    postLocationIfPossible()
                    updateNotification(location)
                }
            }
        }
        fusedLocationClient.requestLocationUpdates(request, locationCallback!!, Looper.getMainLooper())
    }

    private fun postLocationIfPossible() {
        if (postInFlight || latestUnsentLocation == null || deviceToken.isNullOrBlank()) return
        postInFlight = true
        val location = latestUnsentLocation ?: run { postInFlight = false; return }
        val token = deviceToken ?: run { postInFlight = false; return }

        networkExecutor.execute {
            var success = false
            try {
                val payload = org.json.JSONObject().apply {
                    put("device_token", token)
                    put("lat", location.latitude)
                    put("lng", location.longitude)
                    if (location.hasSpeed()) put("speed_kmh", location.speed * 3.6)
                    if (location.hasBearing()) put("heading", location.bearing.toDouble())
                    put("accuracy", location.accuracy)
                }.toString()
                val connection = (java.net.URL("https://motoveya.base44.app/functions/native-location").openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                val code = connection.responseCode
                success = code in 200..299
                try { (if (success) connection.inputStream else connection.errorStream)?.use { it.readBytes() } } catch (_: Exception) {}
                connection.disconnect()
            } catch (_: Exception) {
                success = false
            } finally {
                if (success && latestUnsentLocation === location) {
                    latestUnsentLocation = null
                    clearPendingLocation()
                }
                postInFlight = false
            }
            if (!success) {
                android.os.Handler(mainLooper).postDelayed({ postLocationIfPossible() }, 3000L)
            }
        }
    }

    private fun persistPendingLocation(location: Location) {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .putString("pending_lat", location.latitude.toString())
            .putString("pending_lng", location.longitude.toString())
            .putFloat("pending_accuracy", location.accuracy)
            .apply()
    }

    private fun restorePendingLocation() {
        val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
        val lat = prefs.getString("pending_lat", null)?.toDoubleOrNull() ?: return
        val lng = prefs.getString("pending_lng", null)?.toDoubleOrNull() ?: return
        latestUnsentLocation = Location("motoveya_pending").apply {
            latitude = lat
            longitude = lng
            prefs.getFloat("pending_accuracy", -1f).takeIf { it >= 0f }?.let { accuracy = it }
        }
    }

    private fun clearPendingLocation() {
        getSharedPreferences(PREFS, MODE_PRIVATE).edit()
            .remove("pending_lat").remove("pending_lng").remove("pending_accuracy").apply()
    }

    private fun startCrashDetection() {
        accelerometer?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
        rotationSensor?.let { sensorManager.registerListener(this, it, SensorManager.SENSOR_DELAY_GAME) }
    }

    private fun stopCrashDetection() {
        if (::sensorManager.isInitialized) sensorManager.unregisterListener(this)
        highGAt = 0L
        highRotationAt = 0L
        suddenDecelAt = 0L
        strongestG = 0.0
        strongestRotation = 0.0
        lastSpeedKmh = 0.0
        lastSpeedAt = 0L
    }

    private fun updateCrashSpeed(location: Location) {
        if (!location.hasSpeed()) return
        val speedKmh = location.speed * 3.6
        val now = System.currentTimeMillis()
        if (lastSpeedAt > 0L && now - lastSpeedAt <= 3500L) {
            val drop = lastSpeedKmh - speedKmh
            if (lastSpeedKmh >= 25.0 && drop > 35.0) {
                suddenDecelAt = now
                maybeTriggerNativeCrash(now, speedKmh)
            }
        }
        lastSpeedKmh = speedKmh
        lastSpeedAt = now
    }

    override fun onSensorChanged(event: SensorEvent) {
        val now = System.currentTimeMillis()
        if (now < crashCooldownUntil) return
        if (lastSpeedKmh < 25.0) return

        when (event.sensor.type) {
            Sensor.TYPE_ACCELEROMETER -> {
                val x = event.values.getOrNull(0)?.toDouble() ?: 0.0
                val y = event.values.getOrNull(1)?.toDouble() ?: 0.0
                val z = event.values.getOrNull(2)?.toDouble() ?: 0.0
                val g = sqrt(x * x + y * y + z * z) / 9.81
                if (g > 4.0) {
                    highGAt = now
                    if (g > strongestG) strongestG = g
                    maybeTriggerNativeCrash(now, lastSpeedKmh)
                }
            }
            Sensor.TYPE_GYROSCOPE -> {
                val x = Math.toDegrees(event.values.getOrNull(0)?.toDouble() ?: 0.0)
                val y = Math.toDegrees(event.values.getOrNull(1)?.toDouble() ?: 0.0)
                val z = Math.toDegrees(event.values.getOrNull(2)?.toDouble() ?: 0.0)
                val rotation = sqrt(x * x + y * y + z * z)
                if (rotation > 360.0) {
                    highRotationAt = now
                    if (rotation > strongestRotation) strongestRotation = rotation
                    maybeTriggerNativeCrash(now, lastSpeedKmh)
                }
            }
        }
    }

    private fun maybeTriggerNativeCrash(now: Long, speedKmh: Double) {
        if (now < crashCooldownUntil) return
        val impact = highGAt > 0 && now - highGAt <= indicatorWindowMs
        val rotation = highRotationAt > 0 && now - highRotationAt <= indicatorWindowMs
        val decel = suddenDecelAt > 0 && now - suddenDecelAt <= indicatorWindowMs
        val corroborated = (impact && (rotation || decel)) || (decel && rotation)
        if (!corroborated) return

        crashCooldownUntil = now + 60000L
        val location = lastKnownLocation ?: latestUnsentLocation ?: return
        val token = deviceToken ?: return
        val g = strongestG
        val rot = strongestRotation
        val severity = when {
            g > 8.0 || decel && lastSpeedKmh > 50.0 || (rotation && impact && g > 5.5) -> "high"
            g > 5.5 || decel -> "medium"
            else -> "low"
        }
        highGAt = 0L
        highRotationAt = 0L
        suddenDecelAt = 0L

        networkExecutor.execute {
            try {
                val battery = (getSystemService(BATTERY_SERVICE) as BatteryManager)
                    .getIntProperty(BatteryManager.BATTERY_PROPERTY_CAPACITY)
                val payload = org.json.JSONObject().apply {
                    put("device_token", token)
                    put("lat", location.latitude)
                    put("lng", location.longitude)
                    put("severity", severity)
                    put("speed_at_impact", speedKmh)
                    if (location.hasBearing()) put("heading_at_impact", location.bearing.toDouble())
                    put("battery_level", battery)
                    put("indicators", org.json.JSONObject().apply {
                        put("highGForce", g > 4.0)
                        put("highRotation", rot > 360.0)
                        put("suddenDecel", decel)
                    })
                }.toString()
                val connection = (java.net.URL("https://motoveya.base44.app/functions/trigger-emergency-native").openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                try { connection.inputStream.use { it.readBytes() } } catch (_: Exception) {}
                connection.disconnect()
            } catch (_: Exception) {}
        }
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit

    private fun buildNotification(status: String): Notification =
        NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("MotoVeya Ride")
            .setContentText(status)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()

    private fun updateNotification(location: Location) {
        val speed = if (location.hasSpeed()) (location.speed * 3.6).toInt() else 0
        getSystemService(NotificationManager::class.java).notify(NOTIFICATION_ID, buildNotification("Live GPS active · ${speed} km/h"))
    }

    private fun stopTracking() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        stopCrashDetection()
        deviceToken = null
        latestUnsentLocation = null
        lastKnownLocation = null
        clearPendingLocation()
        if (::networkExecutor.isInitialized) networkExecutor.shutdownNow()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getSystemService(NotificationManager::class.java).createNotificationChannel(
                NotificationChannel(CHANNEL_ID, "MotoVeya ride tracking", NotificationManager.IMPORTANCE_LOW)
            )
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null
    override fun onDestroy() { stopTracking(); super.onDestroy() }
}
