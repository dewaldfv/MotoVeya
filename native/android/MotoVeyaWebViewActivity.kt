package com.motoveya.app.nativebridge

import android.annotation.SuppressLint
import android.app.Activity
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

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        permissionClient.onRequestPermissionsResult(requestCode, grantResults)
        nativeBridge.onRequestPermissionsResult(requestCode, grantResults)
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("MotoVeyaNative")
        webView.destroy()
        super.onDestroy()
    }
}
