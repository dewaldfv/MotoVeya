import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ShieldCheck, MapPin, Activity, Route, Power, Check, AlertTriangle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import {
  startNativeLocationTracking,
  stopNativeLocationTracking,
  getMyDevices,
  setTrackingEnabled,
  revokeNativeTracking,
  getStoredDeviceToken,
  detectPlatform,
} from '@/lib/nativeTracking';
import { toast } from 'sonner';

const PERMISSION_STEPS = [
  { icon: MapPin, label: 'Location — Always', desc: 'Allow location access "Always" so tracking survives a locked screen.' },
  { icon: Activity, label: 'Motion & Fitness', desc: 'Enables background crash detection via accelerometer/gyroscope.' },
  { icon: Route, label: 'Notifications', desc: 'Rider-down and ride alerts can reach you and your contacts.' },
];

export default function BackgroundTracking() {
  const navigate = useNavigate();
  const [me, setMe] = useState(null);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const platform = detectPlatform();

  const load = async () => {
    setLoading(true);
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return;
      const user = await base44.auth.me();
      setMe(user);
      const devs = await getMyDevices();
      setDevices(devs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const primaryDevice = devices[0];
  const token = getStoredDeviceToken();
  const trackingOn = primaryDevice?.tracking_enabled !== false;

  const handleEnable = async () => {
    setRegistering(true);
    try {
      const result = await startNativeLocationTracking();
      if (!result.native) {
        toast.error('Always-on tracking requires the MotoVeya Android app. A browser cannot keep GPS active with the screen locked.');
        return;
      }
      if (result.permissionDenied) {
        toast.error('Location permission is required for always-on tracking');
        return;
      }
      if (!result.started) throw new Error('Native location tracking did not start');
      toast.success('Always-on tracking is active on this device');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Could not register device');
    } finally {
      setRegistering(false);
    }
  };

  const handleToggle = async (enabled) => {
    if (!primaryDevice) return;
    try {
      await setTrackingEnabled(primaryDevice.id, enabled);
      if (enabled) {
        const result = await startNativeLocationTracking();
        if (!result.started) throw new Error(result.permissionDenied ? 'Location permission denied' : 'Native tracking could not start');
      } else {
        stopNativeLocationTracking();
        // Stop the native service and revoke server acceptance before clearing local credentials.
        await revokeNativeTracking();
      }
      toast.success(`Always-on tracking ${enabled ? 'enabled' : 'disabled'}`);
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Could not update tracking');
    }
  };

  const handleRevoke = async () => {
    setRevoking(true);
    try {
      stopNativeLocationTracking();
      await revokeNativeTracking();
      toast.success('Background tracking revoked');
      await load();
    } catch (e) {
      console.error(e);
      toast.error('Could not revoke');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-xl font-bold">Always-On Tracking</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-5 p-4">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-orange-600 p-5 text-white shadow-lg">
          <ShieldCheck size={32} className="mb-2" />
          <h2 className="text-lg font-bold">Keep riding protected, screen off</h2>
          <p className="mt-1 text-sm text-white/85">
            {platform === 'android'
              ? 'The MotoVeya Android service can keep ride location and crash sensors active while the screen is locked.'
              : 'Always-on GPS and crash sensors require the installed MotoVeya Android app. A browser may pause location and motion sensors when it is backgrounded.'}
          </p>
        </div>

        <div>
          <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Required permissions</p>
          <div className="overflow-hidden rounded-2xl bg-card">
            {PERMISSION_STEPS.map((s, i) => (
              <div key={s.label} className={`flex items-start gap-3 px-4 py-3.5 ${i === PERMISSION_STEPS.length - 1 ? '' : 'border-b border-border'}`}>
                <s.icon size={20} className="mt-0.5 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium">{s.label}</p>
                  <p className="text-xs text-muted-foreground">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold">This device</p>
              <p className="text-xs capitalize text-muted-foreground">{platform} · {primaryDevice ? 'Registered' : 'Not registered'}</p>
            </div>
            {primaryDevice ? (
              <span className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${trackingOn ? 'bg-green-600 text-white' : 'bg-secondary text-muted-foreground'}`}>
                {trackingOn ? <Check size={13} /> : <Power size={13} />} {trackingOn ? 'Active' : 'Paused'}
              </span>
            ) : null}
          </div>

          {primaryDevice && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-secondary/60 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium">Always-on tracking</p>
                <p className="text-[11px] text-muted-foreground">Background location & crash detection</p>
              </div>
              <button
                onClick={() => handleToggle(!trackingOn)}
                className={`relative h-7 w-12 rounded-full transition-colors ${trackingOn ? 'bg-primary' : 'bg-muted'}`}
                aria-label="Toggle always-on tracking">
                <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-all ${trackingOn ? 'left-6' : 'left-1'}`} />
              </button>
            </div>
          )}

          {primaryDevice?.last_location_at && (
            <p className="mt-3 text-[11px] text-muted-foreground">
              Last background fix: {new Date(primaryDevice.last_location_at).toLocaleString('en-ZA')}
            </p>
          )}

          {primaryDevice ? (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-destructive active:bg-secondary disabled:opacity-50">
              {revoking ? <Loader2 size={16} className="animate-spin" /> : <Power size={16} />} Revoke & stop tracking
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={registering || !me}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground active:scale-[0.99] disabled:opacity-50">
              {registering ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Enable always-on tracking
            </button>
          )}
        </div>

        {token && primaryDevice && (
          <div className="rounded-2xl border border-dashed border-border bg-secondary/30 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              <AlertTriangle size={13} /> Background service
            </p>
            <p className="text-xs text-muted-foreground">
              This device is registered with MotoVeya's native tracking service. The authentication token is stored locally and is intentionally never displayed.
            </p>
            <ul className="mt-3 space-y-1 text-[11px] text-muted-foreground">
              <li>Live GPS updates continue while the screen is locked.</li>
              <li>Temporary network failures retain the latest fix for retry.</li>
              <li>Native crash detection remains active while the foreground service is running.</li>
            </ul>
          </div>
        )}

        {loading && <p className="text-center text-xs text-muted-foreground">Loading…</p>}
      </div>
    </div>
  );
}