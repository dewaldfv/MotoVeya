package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Activity
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
        if (fine || coarse) {
            invokeLocationCallback(callbackName, true)
            return true
        }
        pendingLocationCallback = callbackName.replace(Regex("[^A-Za-z0-9_\\$]"), "")
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION),
            LOCATION_PERMISSION_REQUEST
        )
        return false
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != LOCATION_PERMISSION_REQUEST) return
        val granted = grantResults.any { it == PackageManager.PERMISSION_GRANTED }
        pendingLocationCallback?.let { invokeLocationCallback(it, granted) }
        pendingLocationCallback = null
    }

    private fun invokeLocationCallback(callbackName: String, granted: Boolean) {
        val safe = callbackName.replace(Regex("[^A-Za-z0-9_\\$]"), "")
        activity.runOnUiThread {
            webView.evaluateJavascript("window." + safe + "(" + granted + ");", null)
        }
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
}
