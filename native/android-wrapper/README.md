# MotoVeya Native Android Wrapper

## Android identity

- Application ID: `com.motoveya.app`
- Namespace: `com.motoveya.app`
- Display name: MotoVeya
- Target SDK: 35
- Minimum SDK: 26

## Architecture

The wrapper hosts the deployed MotoVeya web application at:

`https://motoveya.base44.app`

The WebView exposes a restricted `MotoVeyaNative` JavaScript bridge. Ride Mode uses that bridge to start/stop the native foreground location service.

## Native capabilities

- Android foreground location service
- Fused Location Provider
- GPS updates approximately every 3 seconds
- Continues while the WebView is backgrounded or the screen is locked
- Persistent Ride tracking notification
- Camera/microphone permission bridge for Crowd Clips
- Location permission bridge
- Notification permission request on Android 13+
- Authenticated device-token handoff to the existing Base44 `native-location` function

## Open in Android Studio

Open this directory as an existing Gradle project:

`native/android-wrapper/`

Android Studio must have a compatible JDK/Gradle environment and internet access for the AndroidX/Google Play Services dependencies.

## Before release

1. Build and install a debug APK on a physical Android device.
2. Test login, navigation, maps, events, subscriptions and Crowd Clips.
3. Test Ride Mode with the screen locked.
4. Test location permission denial/retry.
5. Test notification permission behavior.
6. Test ending a ride and verify the native service stops.
7. Test crash/SOS workflows independently.
8. Configure a release signing key / Play App Signing.
9. Build a signed AAB.
10. Complete Google Play Data Safety, location declarations, privacy policy and other Play Console disclosures.

## Important

The Base44 sandbox used to store this project does not contain the Android SDK/JDK, so an APK/AAB cannot be truthfully claimed as built from this environment. The wrapper source is prepared for Android Studio, where the final Gradle build and physical-device validation must be performed.
