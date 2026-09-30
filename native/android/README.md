# MotoVeya Native Android Wrapper

## Required AndroidManifest permissions

Add the permissions from AndroidManifest.permissions.xml to the wrapper application's AndroidManifest.xml.

## WebView integration

Use MotoVeyaWebViewActivity.kt as the reference Activity. The important pieces are:

1. Enable JavaScript and DOM storage.
2. Attach MotoVeyaWebChromeClient as the WebView WebChromeClient.
3. Add MotoVeyaNativeBridge as the JavaScript interface named `MotoVeyaNative`.
4. Forward Activity.onRequestPermissionsResult() to MotoVeyaWebChromeClient.
5. Load the MotoVeya production URL.

## Crowd Clips

Crowd Clips calls:

`window.MotoVeyaNative.requestCameraAndMicrophonePermissions(callbackName)`

The Android bridge opens the normal OS permission dialog. Once permission is resolved, it invokes the callback supplied by the web app.

The bridge also exposes:

`window.MotoVeyaNative.isCameraAndMicrophoneGranted()`

## Security

Do not expose broad Android APIs through the JavaScript interface. Keep only the explicitly required methods. Keep the wrapper HTTPS-only and do not enable cleartext traffic.

## Important

The native Kotlin files in this folder are integration-ready reference files. They become part of the compiled Android application only after being copied into the actual Android Studio wrapper project.
