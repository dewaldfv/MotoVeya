import { enableNotifications, notificationPermission, notificationsSupported } from '@/lib/enableNotifications';
import {
  getNativeBridge,
  isNativeCameraAndMicrophoneGranted,
  requestNativeCameraAndMicrophone,
  requestNativeLocationPermission,
} from '@/lib/nativeTracking';

const SETUP_KEY = 'motoveya_permission_setup_v1';

// The order the device permissions are asked for on a first launch.
export const PERMISSION_STEPS = [
  {
    key: 'location',
    title: 'Location',
    description: 'Shows you on the map, guides your navigation and keeps your group ride together.',
  },
  {
    key: 'notifications',
    title: 'Notifications',
    description: 'Ride invites, safety alerts and messages reach you even when MotoVeya is closed.',
  },
  {
    key: 'camera',
    title: 'Camera',
    description: 'Scan ride QR codes and capture the moments from your rides.',
  },
  {
    key: 'microphone',
    title: 'Microphone',
    description: 'Talk to your group over live voice while you ride.',
  },
];

export function hasCompletedPermissionSetup() {
  try { return localStorage.getItem(SETUP_KEY) === 'done'; } catch { return false; }
}

export function markPermissionSetupComplete(results = {}) {
  try {
    localStorage.setItem(SETUP_KEY, 'done');
    localStorage.setItem(`${SETUP_KEY}_results`, JSON.stringify(results));
  } catch {}
}

// Resolves to 'granted' | 'denied' | 'unsupported' for one permission.
export function requestPermission(key) {
  if (key === 'location') return requestLocation();
  if (key === 'notifications') return requestNotifications();
  return requestMedia(key);
}

async function permissionState(name) {
  try {
    if (!navigator.permissions?.query) return 'unknown';
    const status = await navigator.permissions.query({ name });
    return status.state;
  } catch {
    return 'unknown';
  }
}

async function requestLocation() {
  const bridge = getNativeBridge();
  if (bridge?.requestLocationPermissions) {
    const granted = await requestNativeLocationPermission();
    if (granted === null) return 'unsupported';
    return granted ? 'granted' : 'denied';
  }
  if (!('geolocation' in navigator)) return 'unsupported';
  if ((await permissionState('geolocation')) === 'granted') return 'granted';
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      () => resolve('granted'),
      async () => resolve((await permissionState('geolocation')) === 'granted' ? 'granted' : 'denied'),
      { enableHighAccuracy: false, timeout: 25000, maximumAge: 60000 }
    );
  });
}

async function requestNotifications() {
  if (!notificationsSupported()) return 'unsupported';
  if (notificationPermission() === 'granted') return 'granted';
  if (notificationPermission() === 'denied') return 'denied';
  const outcome = await enableNotifications();
  if (outcome === 'granted') return 'granted';
  return outcome === 'unsupported' ? 'unsupported' : 'denied';
}

async function requestMedia(key) {
  const bridge = getNativeBridge();
  if (bridge?.requestCameraAndMicrophonePermissions) {
    // Android hands out camera and microphone together, so the second step is
    // already satisfied once the first one was allowed.
    if (key === 'microphone' && isNativeCameraAndMicrophoneGranted()) return 'granted';
    const granted = await requestNativeCameraAndMicrophone();
    if (granted === null) return 'unsupported';
    return granted ? 'granted' : 'denied';
  }
  if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
  if ((await permissionState(key)) === 'granted') return 'granted';
  try {
    const stream = await navigator.mediaDevices.getUserMedia(key === 'camera' ? { video: true } : { audio: true });
    stream.getTracks().forEach((track) => track.stop());
    return 'granted';
  } catch (error) {
    return error?.name === 'NotAllowedError' ? 'denied' : 'unsupported';
  }
}