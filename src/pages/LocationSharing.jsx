import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Clock, Gauge, ShieldAlert, Bell, Power, Battery } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import ActiveSessionCard from '@/components/location/ActiveSessionCard';
import { LOCATION_AUDIENCES, POST_RIDE_DURATIONS } from '@/lib/locationConfig';

const DEFAULTS = {
  background_sharing_enabled: false,
  location_audience: 'friends',
  post_ride_share_duration: 'immediate',
  gps_update_interval_sec: 10,
  share_live_location: true,
};

const GPS_PRESETS = [
  { sec: 20, label: 'Battery Saver', desc: 'Updates every 20s' },
  { sec: 10, label: 'Balanced', desc: 'Updates every 10s' },
  { sec: 5, label: 'High Accuracy', desc: 'Updates every 5s' },
];

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
    </div>
  );
}

function RadioRow({ icon: Icon, label, desc, selected, onSelect, last }) {
  return (
    <button onClick={onSelect} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-secondary ${last ? '' : 'border-b border-border'}`}>
      <Icon size={20} className="shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'}`}>
        {selected && <span className="h-2 w-2 rounded-full bg-primary-foreground" />}
      </span>
    </button>
  );
}

export default function LocationSharing() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [revokeAllOpen, setRevokeAllOpen] = useState(false);
  const [revoking, setRevoking] = useState(false);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await base44.auth.isAuthenticated() ? base44.auth.me() : null),
  });

  const { data: settings, isLoading } = useQuery({
    queryKey: ['privacy-settings'],
    queryFn: async () => {
      const existing = await base44.entities.PrivacySetting.filter({}, '-created_date', 1);
      return existing?.[0] || null;
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['location-sessions'],
    queryFn: async () => base44.entities.LocationSession.filter({ user_id: me.id, status: 'active' }, '-started_at', 50),
    enabled: !!me?.id,
    refetchInterval: 15000,
  });

  const current = { ...DEFAULTS, ...(settings || {}) };

  const update = async (field, value) => {
    try {
      if (settings?.id) {
        await base44.entities.PrivacySetting.update(settings.id, { [field]: value });
      } else {
        await base44.entities.PrivacySetting.create({ ...DEFAULTS, [field]: value });
      }
      await queryClient.invalidateQueries({ queryKey: ['privacy-settings'] });
    } catch (e) {
      console.error(e);
      toast.error('Could not update setting');
    }
  };

  const handleToggleBackground = async (enabled) => {
    await update('background_sharing_enabled', enabled);
    if (enabled && 'Notification' in window && Notification.permission === 'default') {
      try { await Notification.requestPermission(); } catch (e) {}
    }
    toast.success(`Background location sharing ${enabled ? 'enabled' : 'disabled'}`);
  };

  const revokeSession = async (sessionId) => {
    try {
      await base44.functions.invoke('revoke-location-session', { session_id: sessionId });
      await queryClient.invalidateQueries({ queryKey: ['location-sessions'] });
      toast.success('Session revoked');
    } catch (e) {
      toast.error('Could not revoke session');
    }
  };

  const revokeAll = async () => {
    setRevoking(true);
    try {
      await base44.functions.invoke('revoke-location-session', { all: true });
      await queryClient.invalidateQueries({ queryKey: ['location-sessions'] });
      setRevokeAllOpen(false);
      toast.success('All sessions revoked');
    } catch (e) {
      toast.error('Could not revoke sessions');
    } finally {
      setRevoking(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;

  const bgEnabled = current.background_sharing_enabled;

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-xl font-bold">Location Sharing</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        <p className="mb-6 px-1 text-sm text-muted-foreground">
          Control when and with whom your live location is shared while riding. Your location is never shared without your explicit consent, and you can revoke access at any time.
        </p>

        <Section title="🔋 Background Sharing">
          <div className="flex items-center gap-3 px-4 py-3.5">
            <MapPin size={20} className="text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Background Location Sharing</p>
              <p className="text-xs text-muted-foreground">Share your live location while riding, even when the screen is locked</p>
            </div>
            <Switch checked={bgEnabled} onCheckedChange={handleToggleBackground} />
          </div>
          {!bgEnabled && (
            <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
              When off, your location is not transmitted to other riders. Turn on to enable live sharing during rides and group rides.
            </p>
          )}
        </Section>

        {bgEnabled && (
          <>
            <Section title="👥 Who Can See You">
              {LOCATION_AUDIENCES.map((opt, i) => (
                <RadioRow key={opt.key} icon={opt.icon} label={opt.label} desc={opt.desc}
                  selected={current.location_audience === opt.key}
                  onSelect={() => update('location_audience', opt.key)}
                  last={i === LOCATION_AUDIENCES.length - 1} />
              ))}
            </Section>

            <Section title="⏱️ After a Ride Ends">
              {POST_RIDE_DURATIONS.map((opt, i) => (
                <RadioRow key={opt.key} icon={opt.icon} label={opt.label} desc={opt.desc}
                  selected={current.post_ride_share_duration === opt.key}
                  onSelect={() => update('post_ride_share_duration', opt.key)}
                  last={i === POST_RIDE_DURATIONS.length - 1} />
              ))}
            </Section>

            <Section title="📡 Update Frequency">
              {GPS_PRESETS.map((opt, i) => (
                <RadioRow key={opt.sec} icon={Gauge} label={opt.label} desc={opt.desc}
                  selected={current.gps_update_interval_sec === opt.sec}
                  onSelect={() => update('gps_update_interval_sec', opt.sec)}
                  last={i === GPS_PRESETS.length - 1} />
              ))}
              <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                Updates automatically speed up while moving and slow down when stationary to save battery.
              </p>
            </Section>

            <Section title="🟢 Active Sessions">
              {sessions.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No active location-sharing sessions. A session starts automatically when you begin a ride.
                </div>
              ) : (
                <>
                  {sessions.map((s) => (
                    <ActiveSessionCard key={s.id} session={s} onRevoke={revokeSession} />
                  ))}
                  <div className="px-4 py-3">
                    <Button variant="outline" className="w-full text-destructive" onClick={() => setRevokeAllOpen(true)}>
                      <Power size={16} className="mr-2" /> Revoke All Sessions
                    </Button>
                  </div>
                </>
              )}
            </Section>
          </>
        )}

        <Section title="🔒 Privacy & Battery">
          <div className="space-y-2 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            <p className="flex items-start gap-2"><ShieldAlert size={15} className="mt-0.5 shrink-0 text-primary" /> Your location is only visible to the audience you choose, and only while a session is active.</p>
            <p className="flex items-start gap-2"><Bell size={15} className="mt-0.5 shrink-0 text-primary" /> A notification appears while background tracking is active, as required by your device.</p>
            <p className="flex items-start gap-2"><Battery size={15} className="mt-0.5 shrink-0 text-primary" /> GPS frequency adjusts automatically based on your speed to conserve battery.</p>
          </div>
        </Section>

        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
          You can revoke sharing at any time. If you disable location permissions on your device, sharing stops immediately.
        </p>
      </div>

      <AlertDialog open={revokeAllOpen} onOpenChange={setRevokeAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke all location sessions?</AlertDialogTitle>
            <AlertDialogDescription>
              This will immediately stop sharing your live location with everyone. You can re-enable sharing from this page at any time.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={revokeAll} disabled={revoking} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {revoking ? 'Revoking...' : 'Revoke All'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}