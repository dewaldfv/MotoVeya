import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sun, Moon, Smartphone, RotateCw, KeyRound, LogOut, Trash2, Shield, ShieldCheck, Eye, FileText, ScrollText, Check, Bike, MapPin, Mic, Bell, Bookmark } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTheme } from '@/hooks/useTheme';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { isBackgroundTrackingEnabled, setBackgroundTrackingEnabled, hasSeenBgExplainer, setBgExplainerSeen } from '@/lib/rideCache';
import { usePremium } from '@/hooks/usePremium';
import SubscriptionCard from '@/components/SubscriptionCard';
import { enableNotifications, notificationsSupported, notificationPermission } from '@/lib/enableNotifications';
import { toast } from 'sonner';
import { getScreenOrientationPreference, setScreenOrientationPreference, applyScreenOrientation } from '@/lib/screenOrientation';

const APP_VERSION = '1.0.0';

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
    </div>);

}

function Row({ icon: Icon, label, value, onClick, danger, last }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${onClick ? 'active:bg-secondary' : ''} ${danger ? 'text-destructive' : ''} ${last ? '' : 'border-b border-border'}`}>
      {Icon && <Icon size={20} className={danger ? 'text-destructive' : 'text-primary'} />}
      <span className="flex-1 text-sm font-medium opacity-100">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {onClick && !value && <ChevronRight size={18} className="text-muted-foreground" />}
    </Comp>);

}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [user, setUser] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [autoRideEnabled, setAutoRideEnabled] = useState(localStorage.getItem('motogo_auto_ride_detection') !== 'false');
  const [bgTrackingEnabled, setBgTrackingEnabled] = useState(isBackgroundTrackingEnabled());
  const [showBgExplainer, setShowBgExplainer] = useState(false);
  const [autoJoinVoice, setAutoJoinVoice] = useState(false);
  const [notifPerm, setNotifPerm] = useState(() => notificationPermission());
  const [enablingNotif, setEnablingNotif] = useState(false);
  const [screenOrientation, setScreenOrientation] = useState(() => getScreenOrientationPreference());
  const { isPremium, refresh: refreshPremium } = usePremium();

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (authed) {
          const me = await base44.auth.me();
          setUser(me);
          setAutoJoinVoice(me.auto_join_voice || false);
        }
      } catch (e) {console.error(e);}
    })();
  }, []);

  const handleLogout = () => base44.auth.logout('/');

  const handleDelete = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await base44.entities.User.delete(user.id);
      base44.auth.logout('/');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete account');
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  const themeOptions = [
  { key: 'light', label: 'Light Mode', icon: Sun },
  { key: 'dark', label: 'Dark Mode', icon: Moon },
  { key: 'auto', label: 'Auto (System)', icon: Smartphone }];


  const goLegal = (doc) => navigate(`/legal/${doc}`);

  const handleScreenOrientationChange = async (value) => {
    setScreenOrientation(value);
    setScreenOrientationPreference(value);
    const applied = await applyScreenOrientation(value);
    if (value !== 'auto' && !applied) {
      toast.info('Your browser/device controls screen rotation for this mode.');
    } else {
      toast.success(`Screen orientation: ${value === 'auto' ? 'Auto' : value === 'portrait' ? 'Portrait' : 'Landscape'}`);
    }
  };

  const toggleAutoJoinVoice = async (checked) => {
    setAutoJoinVoice(checked);
    try {
      await base44.auth.updateMe({ auto_join_voice: checked });
      toast.success(`Auto-Join Voice ${checked ? 'enabled' : 'disabled'}`);
    } catch (e) {
      setAutoJoinVoice(!checked);
      toast.error('Could not update setting');
    }
  };

  const toggleAutoRide = () => {
    const newValue = !autoRideEnabled;
    setAutoRideEnabled(newValue);
    localStorage.setItem('motogo_auto_ride_detection', newValue ? 'true' : 'false');
    toast.success(`Auto Ride Detection ${newValue ? 'enabled' : 'disabled'}`);
  };

  useEffect(() => {
    if (isBackgroundTrackingEnabled() && !hasSeenBgExplainer()) setShowBgExplainer(true);
  }, []);

  const toggleBgTracking = (checked) => {
    setBgTrackingEnabled(checked);
    setBackgroundTrackingEnabled(checked);
    if (checked && !hasSeenBgExplainer()) {
      setShowBgExplainer(true);
    } else {
      toast.success(`Background Tracking ${checked ? 'enabled' : 'disabled'}`);
    }
  };

  const dismissBgExplainer = () => {
    setBgExplainerSeen();
    setShowBgExplainer(false);
    toast.success('Background Tracking enabled');
  };

  const handleEnableNotifications = async () => {
    setEnablingNotif(true);
    try {
      const result = await enableNotifications();
      setNotifPerm(result);
      if (result === 'granted') toast.success('Notifications enabled');
      else if (result === 'denied') toast.error('Notifications blocked');
      else if (result === 'unsupported') toast.error('Notifications not supported on this device');
    } catch (e) {
      toast.error('Could not enable notifications');
    } finally {
      setEnablingNotif(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        {isPremium && (
          <Section title="👑 Subscription">
            <div className="p-4">
              <SubscriptionCard onCancelled={refreshPremium} />
            </div>
          </Section>
        )}

        <Section title="🎨 Display">
          {themeOptions.map((opt, i) =>
          <button
            key={opt.key}
            onClick={() => setTheme(opt.key)}
            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-secondary ${i === themeOptions.length - 1 ? '' : 'border-b border-border'}`}>
            
              <opt.icon size={20} className="text-primary" />
              <span className="flex-1 text-sm font-medium">{opt.label}</span>
              {theme === opt.key && <Check size={20} className="text-primary" />}
            </button>
          )}
        </Section>

        <Section title="📱 Screen Orientation">
          {[['auto', 'Portrait - Locked', 'Follows your device'], ['landscape', 'Auto Rotate', 'Lock landscape']].map(([value, label, description], i) => (
            <button
              key={value}
              type="button"
              onClick={() => handleScreenOrientationChange(value)}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-secondary ${i < 1 ? 'border-b border-border' : ''}`}
            >
              <RotateCw size={20} className="text-primary" />
              <div className="flex-1">
                <span className="text-sm font-medium">{label}</span>
                <p className="text-[11px] text-muted-foreground">{description}</p>
              </div>
              {screenOrientation === value && <Check size={20} className="text-primary" />}
            </button>
          ))}
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Auto allows MotoVeya to follow your device. Landscape locks the app where supported. Your phone's system Rotation Lock can still override Auto.
          </p>
        </Section>

        <Section title="🔔 Notifications">
          {notificationsSupported() ? (
            notifPerm === 'granted' ? (
              <Row icon={Bell} label="Notifications Enabled ✓" value="On" last />
            ) : notifPerm === 'denied' ? (
              <>
                <Row icon={Bell} label="Notifications Blocked" value="Off" last />
                <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  Blocked — update site permissions to allow notifications.
                </p>
              </>
            ) : (
              <>
                <Row icon={Bell} label="Enable Notifications" onClick={enablingNotif ? undefined : handleEnableNotifications} last />
                <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                  Get push alerts for new messages and ride invites, even when the app is closed.
                </p>
              </>
            )
          ) : (
            <Row icon={Bell} label="Notifications Not Supported" value="—" last />
          )}
        </Section>

        <Section title="📍 Saved Places">
          <Row icon={Bookmark} label="Saved Places" value="Manage" onClick={() => navigate('/saved-places')} last />
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Manage your saved locations, geofence radius, group arrival/departure alerts, and active status.
          </p>
        </Section>

        <Section title="🏍️ Riding">
          <Row icon={Bike} label="Auto Ride Detection" value={autoRideEnabled ? 'On' : 'Off'} onClick={toggleAutoRide} />
          <div className="flex w-full items-center gap-3 px-4 py-3.5">
            <Mic size={20} className="text-primary" />
            <div className="flex-1">
              <span className="text-sm font-medium">Auto-Join Group Voice</span>
              <p className="text-[11px] text-muted-foreground">Connect automatically when a group ride starts</p>
            </div>
            <Switch checked={autoJoinVoice} onCheckedChange={toggleAutoJoinVoice} />
          </div>
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Automatically starts a ride when you begin moving above 15 km/h, and prompts you to end the ride after 5 minutes of being stationary.
          </p>
        </Section>

        <Section title="🔋 Background & Pocket Mode">
          <div className="flex w-full items-center gap-3 px-4 py-3.5">
            <Smartphone size={20} className="text-primary" />
            <span className="flex-1 text-sm font-medium">Background Ride Tracking</span>
            <Switch checked={bgTrackingEnabled} onCheckedChange={toggleBgTracking} />
          </div>
          <Row icon={ShieldCheck} label="Always-On Tracking (Native)" value="Manage" onClick={() => navigate('/background-tracking')} />
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Keeps tracking your ride while the app is in your pocket or the screen is locked. Required for navigation, crash detection, and emergency alerts.
          </p>
        </Section>

        <Section title="👤 Account">
          <Row icon={KeyRound} label="Change Password" onClick={() => navigate('/forgot-password')} />
          <Row icon={LogOut} label="Log Out" onClick={handleLogout} danger />
          <Row icon={Trash2} label="Delete Account" onClick={() => setDeleteOpen(true)} danger last />
        </Section>

        <Section title="🔒 Privacy & Security">
          <Row icon={MapPin} label="Location Sharing" onClick={() => navigate('/location-sharing')} />
          <Row icon={Eye} label="Privacy Settings" onClick={() => navigate('/privacy')} />
          <Row icon={Shield} label="Privacy Policy" onClick={() => goLegal('privacy')} last />
        </Section>

        <Section title="📄 Legal">
          <Row icon={FileText} label="Privacy Policy" onClick={() => goLegal('privacy')} />
          <Row icon={FileText} label="End User License Agreement" onClick={() => goLegal('eula')} />
          <Row icon={ScrollText} label="Terms & Conditions" onClick={() => goLegal('terms')} />
          <Row icon={FileText} label="Refund Policy" onClick={() => goLegal('refund')} />
          <Row icon={FileText} label="Cookie Policy" onClick={() => goLegal('cookies')} />
          <Row icon={FileText} label="Legal Notice" onClick={() => goLegal('legal')} last />
        </Section>

        <Section title="ℹ️ About">
          <Row icon={FileText} label="App Version" value={APP_VERSION} last />
        </Section>

        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">MotoVeya 🇿🇦 — Made in South Africa</p>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your MotoVeya account. This action cannot be undone. Your ride history, bikes, and profile data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showBgExplainer} onOpenChange={setShowBgExplainer}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Background Location Required</AlertDialogTitle>
            <AlertDialogDescription>
              MotoVeya needs background location access to provide:
              <br />• Turn-by-turn navigation while your screen is off
              <br />• Crash detection while the phone is in your pocket
              <br />• Emergency alerts with your exact location
              <br />• Accurate ride recording (distance, speed, route)
              <br /><br />
              When prompted, select "Always Allow" to keep tracking active even when your screen is locked.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={dismissBgExplainer}>Got it</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>);

}