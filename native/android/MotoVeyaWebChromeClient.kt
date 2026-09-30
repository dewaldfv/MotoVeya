package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import android.webkit.WebView
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

/**
 * WebView permission bridge for MotoVeya Crowd Clips.
 *
 * The Web app calls:
 *   window.MotoVeyaNative.requestCameraAndMicrophonePermissions()
 *
 * This class grants WebView camera/microphone requests only after the Android
 * runtime permissions have been granted by the user.
 */
class MotoVeyaWebChromeClient(
    private val activity: Activity
) : WebChromeClient() {

    companion object {
        const val MEDIA_PERMISSION_REQUEST = 7401
    }

    private var pendingRequest: PermissionRequest? = null

    fun requestCameraAndMicrophonePermissions(onResult: (Boolean) -> Unit) {
        val cameraGranted = ContextCompat.checkSelfPermission(
            activity, Manifest.permission.CAMERA
        ) == PackageManager.PERMISSION_GRANTED

        val audioGranted = ContextCompat.checkSelfPermission(
            activity, Manifest.permission.RECORD_AUDIO
        ) == PackageManager.PERMISSION_GRANTED

        if (cameraGranted && audioGranted) {
            onResult(true)
            return
        }

        pendingPermissionResult = onResult
        ActivityCompat.requestPermissions(
            activity,
            arrayOf(
                Manifest.permission.CAMERA,
                Manifest.permission.RECORD_AUDIO
            ),
            MEDIA_PERMISSION_REQUEST
        )
    }

    override fun onPermissionRequest(request: PermissionRequest) {
        activity.runOnUiThread {
            val requested = request.resources.toSet()
            val wantsCamera = PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested
            val wantsAudio = PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested

            val cameraGranted = !wantsCamera ||
                ContextCompat.checkSelfPermission(
                    activity, Manifest.permission.CAMERA
                ) == PackageManager.PERMISSION_GRANTED

            val audioGranted = !wantsAudio ||
                ContextCompat.checkSelfPermission(
                    activity, Manifest.permission.RECORD_AUDIO
                ) == PackageManager.PERMISSION_GRANTED

            if (cameraGranted && audioGranted) {
                request.grant(request.resources)
            } else {
                pendingWebPermissionRequest = request
                ActivityCompat.requestPermissions(
                    activity,
                    buildList {
                        if (wantsCamera) add(Manifest.permission.CAMERA)
                        if (wantsAudio) add(Manifest.permission.RECORD_AUDIO)
                    }.toTypedArray(),
                    MEDIA_PERMISSION_REQUEST
                )
            }
        }
    }

    fun onRequestPermissionsResult(
        requestCode: Int,
        grantResults: IntArray
    ) {
        if (requestCode != MEDIA_PERMISSION_REQUEST) return

        val granted = grantResults.isNotEmpty() &&
            grantResults.all { it == PackageManager.PERMISSION_GRANTED }

        pendingPermissionResult?.invoke(granted)
        pendingPermissionResult = null

        pendingWebPermissionRequest?.let { request ->
            if (granted) {
                request.grant(request.resources)
            } else {
                request.deny()
            }
        }
        pendingWebPermissionRequest = null
    }

    private var pendingPermissionResult: ((Boolean) -> Unit)? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
}
