package com.motoveya.app.nativebridge

import android.app.Activity
import android.webkit.JavascriptInterface
import org.json.JSONObject

/**
 * JavaScript bridge exposed as window.MotoVeyaNative.
 *
 * The Crowd Clips web page uses this bridge when running inside the native
 * Android wrapper. Permission ownership remains with Android; the web app
 * never attempts to bypass the OS permission dialog.
 */
class MotoVeyaNativeBridge(
    private val activity: Activity,
    private val permissionClient: MotoVeyaWebChromeClient
) {

    @JavascriptInterface
    fun requestCameraAndMicrophonePermissions(): String {
        var result = JSONObject().put("granted", false)

        permissionClient.requestCameraAndMicrophonePermissions { granted ->
            result = JSONObject().put("granted", granted)
            activity.runOnUiThread {
                // The web layer also supports normal getUserMedia fallback.
                // Native wrappers may alternatively expose a Promise bridge
                // around this method if their WebView integration requires it.
            }
        }

        return result.toString()
    }
}
