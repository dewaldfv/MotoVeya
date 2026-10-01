# MotoVeya Native Android Wrapper

## Native foreground location service

MotoVeya now includes MotoVeyaLocationForegroundService.kt.

This service is the Android safety/tracking layer for an active ride. It runs as a real Android foreground service, uses Fused Location Provider at high accuracy, requests GPS fixes about every 3 seconds, continues when the WebView is backgrounded or the screen is locked, posts authenticated fixes to the existing Base44 native-location endpoint, shows a persistent ride notification, and keeps collecting GPS while the network is temporarily unavailable.

The React app starts the service at ride start and stops it at ride end. Web geolocation remains enabled for the live map/UI.

## AndroidManifest

Add the permissions from AndroidManifest.permissions.xml.

Inside <application> add:

<service android:name=".nativebridge.MotoVeyaLocationForegroundService" android:exported="false" android:foregroundServiceType="location" />

## Required Gradle dependencies

The native wrapper must include AndroidX Core and Google Play Services Location. Use the versions already supported by the wrapper project:

implementation "androidx.core:core-ktx:<current-version>"
implementation "com.google.android.gms:play-services-location:<current-version>"

## Runtime permissions

Before starting a ride, the Android wrapper must have location permission and notification permission where required. Android versions that require it for the intended background behavior also need ACCESS_BACKGROUND_LOCATION. The service is started from the visible MotoVeya activity when Ride Mode starts.

## WebView bridge

MotoVeyaNativeBridge now exposes startNativeLocationTracking(deviceToken), stopNativeLocationTracking(), and isNativeLocationTrackingAvailable(), in addition to the existing camera/microphone methods.

The JavaScript layer starts the native service from useRideSession.startRide() and stops it from handleEndRide().

## Security

The service does not expose arbitrary Android APIs to JavaScript. It receives only the opaque device token and uses the existing token-authenticated Base44 native-location endpoint. Do not log or display the raw token outside the protected native/WebView boundary.

## Deployment note

These Kotlin files are native-wrapper source. Base44's web build cannot itself compile Kotlin into an APK. The Android Studio/native wrapper build must include these files, the manifest declaration, and the required Gradle dependencies. Until that wrapper is rebuilt and installed, the Base44 web app continues using browser geolocation as its fallback.