package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.location.Location
import android.os.Build
import android.os.IBinder
import android.os.Looper
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*

class MotoVeyaLocationForegroundService : Service() {
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
            context.startService(Intent(context, MotoVeyaLocationForegroundService::class.java).apply {
                action = ACTION_STOP
            })
        }
    }

    private lateinit var fusedLocationClient: FusedLocationProviderClient
    private lateinit var networkExecutor: java.util.concurrent.ExecutorService
    @Volatile private var deviceToken: String? = null
    @Volatile private var latestUnsentLocation: Location? = null
    @Volatile private var postInFlight = false
    private var locationCallback: LocationCallback? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
        networkExecutor = java.util.concurrent.Executors.newSingleThreadExecutor()
        deviceToken = getSharedPreferences(PREFS, MODE_PRIVATE).getString(TOKEN_KEY, null)
        restorePendingLocation()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                intent.getStringExtra(EXTRA_DEVICE_TOKEN)?.takeIf { it.length >= 32 }?.let {
                    deviceToken = it
                    getSharedPreferences(PREFS, MODE_PRIVATE).edit().putString(TOKEN_KEY, it).apply()
                }
                if (deviceToken.isNullOrBlank()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForeground(NOTIFICATION_ID, buildNotification("Ride tracking active"))
                startTracking()
            }
            null -> {
                // Android can recreate a START_STICKY service with a null Intent.
                if (deviceToken.isNullOrBlank()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForeground(NOTIFICATION_ID, buildNotification("Ride tracking resumed"))
                startTracking()
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

        val request = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY,
            LOCATION_INTERVAL_MS
        ).setMinUpdateIntervalMillis(FASTEST_INTERVAL_MS)
         .setWaitForAccurateLocation(false)
         .setMaxUpdateDelayMillis(6000L)
         .build()

        locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.locations.forEach { location ->
                    latestUnsentLocation = location
                    persistPendingLocation(location)
                    postLocationIfPossible()
                    updateNotification(location)
                }
            }
        }

        fusedLocationClient.requestLocationUpdates(
            request,
            locationCallback!!,
            Looper.getMainLooper()
        )
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
        getSystemService(NotificationManager::class.java).notify(
            NOTIFICATION_ID,
            buildNotification("Live GPS active · ${speed} km/h")
        )
    }

    private fun stopTracking() {
        locationCallback?.let { fusedLocationClient.removeLocationUpdates(it) }
        locationCallback = null
        deviceToken = null
        latestUnsentLocation = null
        clearPendingLocation()
        if (::networkExecutor.isInitialized) networkExecutor.shutdownNow()
        stopForeground(STOP_FOREGROUND_REMOVE)
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MotoVeya ride tracking",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Persistent notification required while MotoVeya is tracking a ride."
                setShowBadge(false)
            }
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopTracking()
        super.onDestroy()
    }
}
