package com.motoveya.app.nativebridge

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Bundle
import android.webkit.WebView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import android.webkit.WebViewClient

class MotoVeyaWebViewActivity : Activity() {
    private lateinit var webView: WebView
    private lateinit var permissionClient: MotoVeyaWebChromeClient
    private lateinit var nativeBridge: MotoVeyaNativeBridge

    // A tapped push alert is held here until the page can receive it.
    private var pendingPath: String? = null
    private var pendingConversationId: String? = null

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Launch MotoVeya as an immersive fullscreen app. Android can still
        // temporarily reveal system bars with a swipe when needed.
        WindowCompat.setDecorFitsSystemWindows(window, false)
        hideSystemBars()

        // Restore the saved orientation before the web app loads so the
        // screen is already correct on cold start (no orientation flash).
        restoreOrientation()

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            javaScriptCanOpenWindowsAutomatically = true
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                dispatchPendingAlert()
            }
        }
        permissionClient = MotoVeyaWebChromeClient(this)
        webView.webChromeClient = permissionClient
        nativeBridge = MotoVeyaNativeBridge(this, webView, permissionClient)
        webView.addJavascriptInterface(nativeBridge, "MotoVeyaNative")
        readAlertIntent(intent)
        webView.loadUrl(BASE_URL)
    }

    // Reads the deep link carried by a notification tap, if any.
    private fun readAlertIntent(intent: Intent?) {
        if (intent == null) return
        val path = intent.getStringExtra(MotoVeyaMessagingService.EXTRA_URL) ?: return
        intent.removeExtra(MotoVeyaMessagingService.EXTRA_URL)
        pendingPath = if (path.startsWith("/")) path else "/$path"
        pendingConversationId = intent.getStringExtra("conversationId")
    }

    // Hands the alert's destination to the app once the page is ready.
    private fun dispatchPendingAlert() {
        val path = pendingPath ?: return
        val conversationId = pendingConversationId
        pendingPath = null
        pendingConversationId = null
        val detail = StringBuilder("{url:${org.json.JSONObject.quote(path)}")
        if (!conversationId.isNullOrEmpty()) {
            detail.append(",conversationId:${org.json.JSONObject.quote(conversationId)}")
        }
        detail.append("}")
        webView.evaluateJavascript(
            "window.dispatchEvent(new CustomEvent('motoveya:navigate',{detail:$detail}));",
            null
        )
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        readAlertIntent(intent)
        webView.post { dispatchPendingAlert() }
    }

    private fun restoreOrientation() {
        val prefs = getSharedPreferences(MotoVeyaNativeBridge.PREFS_NAME, Context.MODE_PRIVATE)
        val pref = prefs.getString(MotoVeyaNativeBridge.PREF_ORIENTATION, "auto")
        requestedOrientation = when (pref) {
            "portrait" -> ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            "landscape" -> ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE
            else -> ActivityInfo.SCREEN_ORIENTATION_FULL_SENSOR
        }
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideSystemBars()
    }

    private fun hideSystemBars() {
        WindowInsetsControllerCompat(window, window.decorView).apply {
            hide(WindowInsetsCompat.Type.systemBars())
            systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        permissionClient.onRequestPermissionsResult(requestCode, grantResults)
        nativeBridge.onRequestPermissionsResult(requestCode, grantResults)
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("MotoVeyaNative")
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val BASE_URL = "https://motoveya.base44.app"
    }
}