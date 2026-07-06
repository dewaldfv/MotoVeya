import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Sun, Moon, Smartphone, RotateCw, User, KeyRound, LogOut, Trash2, Shield, FileText, ScrollText, Check, Bike } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useTheme } from '@/hooks/useTheme';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { isBackgroundTrackingEnabled, setBackgroundTrackingEnabled, hasSeenBgExplainer, setBgExplainerSeen } from '@/lib/rideCache';
import { toast } from 'sonner';

const APP_VERSION = '1.0.0';

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
    </div>
  );
}

function Row({ icon: Icon, label, value, onClick, danger, last }) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp onClick={onClick} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${onClick ? 'active:bg-secondary' : ''} ${danger ? 'text-destructive' : ''} ${last ? '' : 'border-b border-border'}`}>
      {Icon && <Icon size={20} className={danger ? 'text-destructive' : 'text-primary'} />}
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value && <span className="text-sm text-muted-foreground">{value}</span>}
      {onClick && !value && <ChevronRight size={18} className="text-muted-foreground" />}
    </Comp>
  );
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

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (authed) setUser(await base44.auth.me());
      } catch (e) { console.error(e); }
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
    { key: 'auto', label: 'Auto (System)', icon: Smartphone },
  ];

  const goLegal = (doc) => navigate(`/legal/${doc}`);

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

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        <Section title="🎨 Display">
          {themeOptions.map((opt, i) => (
            <button
              key={opt.key}
              onClick={() => setTheme(opt.key)}
              className={`flex w-full items-center gap-3 px-4 py-3.5 text-left active:bg-secondary ${i === themeOptions.length - 1 ? '' : 'border-b border-border'}`}
            >
              <opt.icon size={20} className="text-primary" />
              <span className="flex-1 text-sm font-medium">{opt.label}</span>
              {theme === opt.key && <Check size={20} className="text-primary" />}
            </button>
          ))}
        </Section>

        <Section title="📱 Screen Orientation">
          <Row icon={RotateCw} label="Auto-Rotate" value="Follows device" />
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            The app rotates automatically with your device. If Rotation Lock is enabled on your phone, the app respects that and stays in the current orientation.
          </p>
        </Section>

        <Section title="🏍️ Riding">
          <Row icon={Bike} label="Auto Ride Detection" value={autoRideEnabled ? 'On' : 'Off'} onClick={toggleAutoRide} last />
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
          <p className="px-4 py-3 text-xs leading-relaxed text-muted-foreground">
            Keeps tracking your ride while the app is in your pocket or the screen is locked. Required for navigation, crash detection, and emergency alerts.
          </p>
        </Section>

        <Section title="👤 Account">
          <Row icon={User} label="Edit Profile" onClick={() => navigate('/onboarding')} />
          <Row icon={KeyRound} label="Change Password" onClick={() => navigate('/forgot-password')} />
          <Row icon={LogOut} label="Log Out" onClick={handleLogout} danger />
          <Row icon={Trash2} label="Delete Account" onClick={() => setDeleteOpen(true)} danger last />
        </Section>

        <Section title="🔒 Privacy & Security">
          <Row icon={Shield} label="Privacy Policy" onClick={() => goLegal('privacy')} />
        </Section>

        <Section title="📄 Legal">
          <Row icon={FileText} label="End User License Agreement" onClick={() => goLegal('eula')} />
          <Row icon={Shield} label="Privacy Policy" onClick={() => goLegal('privacy')} />
          <Row icon={ScrollText} label="Terms & Conditions" onClick={() => goLegal('terms')} last />
        </Section>

        <Section title="ℹ️ About">
          <Row icon={FileText} label="App Version" value={APP_VERSION} last />
        </Section>

        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">MotoGo 🇿🇦 — Made in South Africa</p>
      </div>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your MotoGo account. This action cannot be undone. Your ride history, bikes, and profile data will be lost.
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
              MotoGo needs background location access to provide:
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
    </div>
  );
}