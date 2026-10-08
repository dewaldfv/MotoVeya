package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
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
        permissionClient.requestCameraAndMicrophonePermissions { granted ->
            val safe = callbackName.replace(Regex("[^A-Za-z0-9_\$]"), "")
            activity.runOnUiThread {
                val value = if (granted) "true" else "false"
                webView.evaluateJavascript(
                    "window." + safe + "(" + value + ");",
                    null
                )
            }
        }
        return false
    }

    @JavascriptInterface
    fun isCameraAndMicrophoneGranted(): Boolean {
        return permissionClient.areCameraAndMicrophoneGranted()
    }

    @JavascriptInterface
    fun requestLocationPermissions(callbackName: String): Boolean {
        val fine = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val coarse = ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        val notificationsGranted = android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        if ((fine || coarse) && notificationsGranted) {
            invokeLocationCallback(callbackName, true)
            return true
        }
        pendingLocationCallback = callbackName.replace(Regex("[^A-Za-z0-9_\\$]"), "")
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

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        val locationGranted =
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        pendingLocationCallback?.let { invokeLocationCallback(it, locationGranted) }
        pendingLocationCallback = null
    }

    private fun invokeLocationCallback(callbackName: String, granted: Boolean) {
        val safe = callbackName.replace(Regex("[^A-Za-z0-9_\\$]"), "")
        activity.runOnUiThread {
            webView.evaluateJavascript("window." + safe + "(" + granted + ");", null)
        }
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

    /**
     * Applies the user's screen orientation preference to the Activity and
     * persists it to SharedPreferences so it survives app restarts. The web
     * layer calls this from the Preferences tab; the Activity also restores
     * the saved value on cold start via restoreOrientation().
     */
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
    fun isBackgroundLocationGranted(): Boolean {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.Q) return true
        return ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_BACKGROUND_LOCATION) == PackageManager.PERMISSION_GRANTED
    }
}