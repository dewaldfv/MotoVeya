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

        fun start(context: android.content.Context, token: String) {
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
    private var deviceToken: String? = null
    private var locationCallback: LocationCallback? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_START -> {
                deviceToken = intent.getStringExtra(EXTRA_DEVICE_TOKEN)
                if (deviceToken.isNullOrBlank()) {
                    stopSelf()
                    return START_NOT_STICKY
                }
                startForeground(NOTIFICATION_ID, buildNotification("Ride tracking active"))
                startTracking()
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
                    postLocation(location)
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

    private fun postLocation(location: Location) {
        val token = deviceToken ?: return
        Thread {
            try {
                val url = java.net.URL("https://motoveya.base44.app/functions/native-location")
                val connection = (url.openConnection() as java.net.HttpURLConnection).apply {
                    requestMethod = "POST"
                    connectTimeout = 10000
                    readTimeout = 10000
                    doOutput = true
                    setRequestProperty("Content-Type", "application/json")
                }

                val speedKmh = if (location.hasSpeed()) location.speed * 3.6 else null
                val heading = if (location.hasBearing()) location.bearing.toDouble() else null
                val escapedToken = token.replace("\\", "\\\\").replace("\"", "\\\"")
                val payload = buildString {
                    append("{")
                    append("\"device_token\":\"").append(escapedToken).append("\",")
                    append("\"lat\":").append(location.latitude).append(",")
                    append("\"lng\":").append(location.longitude).append(",")
                    if (speedKmh != null) append("\"speed_kmh\":").append(speedKmh).append(",")
                    if (heading != null) append("\"heading\":").append(heading).append(",")
                    append("\"accuracy\":").append(location.accuracy)
                    append("}")
                }
                connection.outputStream.use { it.write(payload.toByteArray(Charsets.UTF_8)) }
                try { connection.inputStream.use { it.readBytes() } } catch (_: Exception) {}
                connection.disconnect()
            } catch (_: Exception) {
                // Keep collecting GPS while offline; the next fix will retry.
            }
        }.start()
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
