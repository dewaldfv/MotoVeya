package com.motoveya.app.nativebridge

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.webkit.WebSettings
import android.webkit.WebView

/**
 * Reference Activity for the MotoVeya native Android wrapper.
 *
 * Replace the existing wrapper Activity's WebView setup with this pattern.
 */
class MotoVeyaWebViewActivity : Activity() {

    private lateinit var webView: WebView
    private lateinit var permissionClient: MotoVeyaWebChromeClient
    private lateinit var nativeBridge: MotoVeyaNativeBridge

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Restore the saved orientation before the WebView loads so the screen
        // is already correct on cold start (no orientation flash).
        restoreOrientation()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
        }

        permissionClient = MotoVeyaWebChromeClient(this)
        webView.webChromeClient = permissionClient

        nativeBridge = MotoVeyaNativeBridge(this, webView, permissionClient)
        webView.addJavascriptInterface(nativeBridge, "MotoVeyaNative")

        // Use the deployed MotoVeya URL in the production wrapper.
        webView.loadUrl("https://motoveya.base44.app")
    }

    /**
     * Restore the rider's saved screen orientation preference before the web
     * app loads, so Auto-Rotate / Portrait-Locked / Landscape-Locked is in
     * effect immediately on cold start.
     */
    private fun restoreOrientation() {
        val prefs = getSharedPreferences(MotoVeyaNativeBridge.PREFS_NAME, Context.MODE_PRIVATE)
        val pref = prefs.getString(MotoVeyaNativeBridge.PREF_ORIENTATION, "auto")
        requestedOrientation = when (pref) {
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            else -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        permissionClient.onRequestPermissionsResult(requestCode, grantResults)
        nativeBridge.onRequestPermissionsResult(requestCode, grantResults)
    }

    /**
     * Handle the hardware Back button: step through the WebView's history
     * before falling back to closing the activity. Without this the back
     * press would immediately exit the app even though the SPA can go back.
     */
    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (this::webView.isInitialized && webView.canGoBack()) {
            webView.goBack()
        } else {
            @Suppress("DEPRECATION")
            super.onBackPressed()
        }
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("MotoVeyaNative")
        webView.destroy()
        super.onDestroy()
    }
}