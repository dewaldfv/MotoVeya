package com.motoveya.app.nativebridge

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Receives native push alerts for the installed MotoVeya app.
 *
 * The server sends data-only messages, so this service owns presentation: one
 * high-importance channel, MotoVeya branding, and a deep link that opens the
 * screen the alert is about inside the WebView.
 */
class MotoVeyaMessagingService : FirebaseMessagingService() {

    companion object {
        const val CHANNEL_ID = "motoveya_alerts"
        const val EXTRA_URL = "motoveya_url"
        const val PREF_PUSH_TOKEN = "fcm_push_token"
        private var notificationId = 4000
    }

    /** A refreshed token must reach the server or delivery silently stops. */
    override fun onNewToken(token: String) {
        super.onNewToken(token)
        getSharedPreferences(MotoVeyaNativeBridge.PREFS_NAME, Context.MODE_PRIVATE)
            .edit()
            .putString(PREF_PUSH_TOKEN, token)
            .apply()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val data = message.data
        val title = data["title"] ?: "MotoVeya"
        val body = data["body"] ?: return
        val url = data["url"] ?: "/"
        showNotification(title, body, url, data["conversationId"])
    }

    private fun showNotification(title: String, body: String, url: String, conversationId: String?) {
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "MotoVeya alerts",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Messages, ride invites, events and safety alerts"
                enableVibration(true)
            }
            manager.createNotificationChannel(channel)
        }

        // Android 13+ lets the rider block alerts; never crash on a blocked send.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val intent = Intent(this, MotoVeyaWebViewActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
            putExtra(EXTRA_URL, url)
            if (!conversationId.isNullOrEmpty()) putExtra("conversationId", conversationId)
        }
        val pendingIntent = PendingIntent.getActivity(
            this,
            url.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(applicationInfo.icon)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pendingIntent)
            .build()

        NotificationManagerCompat.from(this).notify(notificationId++, notification)
    }
}