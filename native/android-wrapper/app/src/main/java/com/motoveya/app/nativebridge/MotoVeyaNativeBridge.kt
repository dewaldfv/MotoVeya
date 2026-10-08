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
            // Foreground location already granted — request background location if needed
            requestBackgroundLocationIfNeeded(callbackName)
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
     * On Android 10+, ACCESS_BACKGROUND_LOCATION must be requested separately
     * (on 11+ it cannot be combined with foreground location). Without it the
     * foreground service may stop receiving location fixes when the screen locks
     * on manufacturer ROMs (Samsung, Xiaomi, Huawei).
     */
    private fun requestBackgroundLocationIfNeeded(callbackName: String) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) {
            invokeCallback(callbackName, true)
            return
        }
        val bgGranted = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
        if (bgGranted) {
            invokeCallback(callbackName, true)
            return
        }
        if (callbackName.isBlank()) return
        pendingLocationCallback = sanitize(callbackName)
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.ACCESS_BACKGROUND_LOCATION),
            BACKGROUND_LOCATION_REQUEST
        )
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        when (requestCode) {
            LOCATION_PERMISSION_REQUEST -> {
                val locationGranted =
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
                if (locationGranted) {
                    // Foreground location granted — now request background location
                    val cb = pendingLocationCallback
                    requestBackgroundLocationIfNeeded(cb ?: "")
                } else {
                    pendingLocationCallback?.let { invokeCallback(it, false) }
                    pendingLocationCallback = null
                }
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