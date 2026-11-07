package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.content.Context
import android.content.pm.ActivityInfo
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MotoVeyaNativeBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val permissionClient: MotoVeyaWebChromeClient
) {
    companion object {
        const val LOCATION_PERMISSION_REQUEST = 7402
        const val BACKGROUND_LOCATION_REQUEST = 7403
        const val PREFS_NAME = "motoveya_prefs"
        const val PREF_ORIENTATION = "screen_orientation"
    }
    private var pendingLocationCallback: String? = null

    @JavascriptInterface
    fun requestCameraAndMicrophonePermissions(callbackName: String): Boolean {
        permissionClient.requestCameraAndMicrophonePermissions { invokeCallback(callbackName, it) }
        return false
    }

    @JavascriptInterface
    fun isCameraAndMicrophoneGranted(): Boolean = permissionClient.areCameraAndMicrophoneGranted()

    @JavascriptInterface
    fun requestLocationPermissions(callbackName: String): Boolean {
        val fine = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val notificationsGranted = android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED

        if ((fine || coarse) && notificationsGranted) {
            // Foreground location is everything a location foreground service needs
            // to keep delivering fixes with the screen locked. Background location is
            // requested separately, because Android 11+ only grants it from Settings.
            invokeCallback(callbackName, true)
            return true
        }

        pendingLocationCallback = sanitize(callbackName)
        val permissions = mutableListOf<String>()
        if (!fine && !coarse) {
            permissions += Manifest.permission.ACCESS_FINE_LOCATION
            permissions += Manifest.permission.ACCESS_COARSE_LOCATION
        }
        if (!notificationsGranted) permissions += Manifest.permission.POST_NOTIFICATIONS
        ActivityCompat.requestPermissions(
            activity,
            permissions.toTypedArray(),
            LOCATION_PERMISSION_REQUEST
        )
        return false
    }

    /**
     * Background location ("Allow all the time") is what stops manufacturer ROMs
     * (Samsung, Xiaomi, Huawei) killing the service. Android 11+ never shows a
     * runtime dialog for it, so the rider is sent to the app's settings screen.
     */
    @JavascriptInterface
    fun requestBackgroundLocationPermission(): Boolean {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q || isBackgroundLocationGranted()) return true
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.R) {
            activity.runOnUiThread {
                try {
                    activity.startActivity(android.content.Intent(android.provider.Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = android.net.Uri.fromParts("package", activity.packageName, null)
                    })
                } catch (_: Exception) {
                }
            }
            return false
        }
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
            BACKGROUND_LOCATION_REQUEST
        )
        return false
    }

    @JavascriptInterface
    fun isForegroundLocationGranted(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
        ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED

    @JavascriptInterface
    fun isIgnoringBatteryOptimizations(): Boolean {
        val power = activity.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        return power.isIgnoringBatteryOptimizations(activity.packageName)
    }

    @JavascriptInterface
    fun requestBatteryOptimizationExemption(): Boolean {
        val power = activity.getSystemService(Context.POWER_SERVICE) as android.os.PowerManager
        if (power.isIgnoringBatteryOptimizations(activity.packageName)) return true
        return try {
            activity.startActivity(android.content.Intent(android.provider.Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = android.net.Uri.parse("package:${activity.packageName}")
            })
            true
        } catch (_: Exception) {
            false
        }
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        when (requestCode) {
            LOCATION_PERMISSION_REQUEST -> {
                val locationGranted =
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                // Start the service as soon as foreground location is granted.
                pendingLocationCallback?.let { invokeCallback(it, locationGranted) }
                pendingLocationCallback = null
            }
            BACKGROUND_LOCATION_REQUEST -> {
                // Background location result — tracking can proceed either way,
                // but background tracking only works reliably if granted.
                val locationGranted =
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                pendingLocationCallback?.let { invokeCallback(it, locationGranted) }
                pendingLocationCallback = null
            }
        }
    }

    @JavascriptInterface
    fun isBackgroundLocationGranted(): Boolean {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return true
        return ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
    }

    @JavascriptInterface
    fun setScreenOrientation(preference: String): Boolean {
        activity.runOnUiThread {
            activity.requestedOrientation = when (preference) {
                "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
                "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
                else -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            }
        }
        activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_ORIENTATION, preference)
            .apply()
        return true
    }

    @JavascriptInterface
    fun startNativeLocationTracking(deviceToken: String): Boolean =
        startNativeLocationTrackingWithCrashDetection(deviceToken, true)

    @JavascriptInterface
    fun startNativeLocationTrackingWithCrashDetection(deviceToken: String, crashDetectionEnabled: Boolean): Boolean {
        if (deviceToken.length < 32) return false
        MotoVeyaLocationForegroundService.start(activity, deviceToken, crashDetectionEnabled)
        return true
    }

    @JavascriptInterface
    fun setNativeCrashDetectionEnabled(enabled: Boolean): Boolean {
        MotoVeyaLocationForegroundService.setCrashDetectionEnabled(activity, enabled)
        return true
    }

    @JavascriptInterface
    fun stopNativeLocationTracking(): Boolean {
        MotoVeyaLocationForegroundService.stop(activity)
        return true
    }

    @JavascriptInterface
    fun isNativeLocationTrackingAvailable(): Boolean = true

    private fun sanitize(value: String): String = value.replace(Regex("[^A-Za-z0-9_\\$]"), "")

    private fun invokeCallback(callbackName: String, granted: Boolean) {
        val safe = sanitize(callbackName)
        activity.runOnUiThread { webView.evaluateJavascript("window.$safe($granted);", null) }
    }
}