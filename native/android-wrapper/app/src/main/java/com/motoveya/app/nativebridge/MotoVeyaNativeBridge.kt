package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.content.pm.ActivityInfo
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MotoVeyaNativeBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val permissionClient: MotoVeyaWebChromeClient
) {
    companion object { const val LOCATION_PERMISSION_REQUEST = 7402 }
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
        pendingLocationCallback = sanitize(callbackName)

        if (fine || coarse) {
            if (android.os.Build.VERSION.SDK_INT >= 33 &&
                ContextCompat.checkSelfPermission(activity, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                ActivityCompat.requestPermissions(
                    activity,
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    LOCATION_PERMISSION_REQUEST
                )
                return false
            }
            invokeLocationCallback(callbackName, true)
            pendingLocationCallback = null
            return true
        }

        ActivityCompat.requestPermissions(
            activity,
            arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ),
            LOCATION_PERMISSION_REQUEST
        )
        return false
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        val locationGranted =
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
            ContextCompat.checkSelfPermission(activity, Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED
        pendingLocationCallback?.let { invokeCallback(it, locationGranted) }
        pendingLocationCallback = null
    }

    @JavascriptInterface
    fun setScreenOrientation(preference: String): Boolean {
        activity.runOnUiThread {
            activity.requestedOrientation = when (preference) {
                "portrait" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT
                "landscape" -> ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                else -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
            }
        }
        return true
    }

    @JavascriptInterface
    fun startNativeLocationTracking(deviceToken: String): Boolean {
        if (deviceToken.length < 32) return false
        MotoVeyaLocationForegroundService.start(activity, deviceToken)
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
