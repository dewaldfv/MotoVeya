package com.motoveya.app.nativebridge

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.webkit.PermissionRequest
import android.webkit.WebChromeClient
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat

class MotoVeyaWebChromeClient(private val activity: Activity) : WebChromeClient() {
    companion object { const val MEDIA_PERMISSION_REQUEST = 7401 }

    private var pendingPermissionResult: ((Boolean) -> Unit)? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null

    fun areCameraAndMicrophoneGranted(): Boolean =
        ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED &&
        ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED

    fun requestCameraAndMicrophonePermissions(onResult: (Boolean) -> Unit) {
        if (areCameraAndMicrophoneGranted()) { onResult(true); return }
        pendingPermissionResult = onResult
        ActivityCompat.requestPermissions(activity, arrayOf(
            Manifest.permission.CAMERA, Manifest.permission.RECORD_AUDIO
        ), MEDIA_PERMISSION_REQUEST)
    }

    override fun onPermissionRequest(request: PermissionRequest) {
        activity.runOnUiThread {
            val requested = request.resources.toSet()
            val wantsCamera = PermissionRequest.RESOURCE_VIDEO_CAPTURE in requested
            val wantsAudio = PermissionRequest.RESOURCE_AUDIO_CAPTURE in requested
            val cameraGranted = !wantsCamera || ContextCompat.checkSelfPermission(activity, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
            val audioGranted = !wantsAudio || ContextCompat.checkSelfPermission(activity, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
            if (cameraGranted && audioGranted) {
                request.grant(request.resources)
            } else {
                pendingWebPermissionRequest = request
                ActivityCompat.requestPermissions(activity, buildList {
                    if (wantsCamera) add(Manifest.permission.CAMERA)
                    if (wantsAudio) add(Manifest.permission.RECORD_AUDIO)
                }.toTypedArray(), MEDIA_PERMISSION_REQUEST)
            }
        }
    }

    fun onRequestPermissionsResult(requestCode: Int, grantResults: IntArray) {
        if (requestCode != MEDIA_PERMISSION_REQUEST) return
        val granted = grantResults.isNotEmpty() && grantResults.all { it == PackageManager.PERMISSION_GRANTED }
        pendingPermissionResult?.invoke(granted)
        pendingPermissionResult = null
        pendingWebPermissionRequest?.let { if (granted) it.grant(it.resources) else it.deny() }
        pendingWebPermissionRequest = null
    }
}
