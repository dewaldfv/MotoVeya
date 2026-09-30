package com.motoveya.app.nativebridge

import android.app.Activity
import android.webkit.JavascriptInterface
import android.webkit.WebView

class MotoVeyaNativeBridge(
    private val activity: Activity,
    private val webView: WebView,
    private val permissionClient: MotoVeyaWebChromeClient
) {
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
}
