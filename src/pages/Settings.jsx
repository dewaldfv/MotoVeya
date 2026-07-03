import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Palette, Smartphone, Monitor, RotateCw, Sun, Moon, Check, User as UserIcon, KeyRound, LogOut, Trash2, Shield, MapPin, FileText, Info, Heart } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAppSettings } from '@/hooks/useAppSettings';
import SettingsSection from '@/components/settings/SettingsSection';
import SettingsRow from '@/components/settings/SettingsRow';
import EditProfileDialog from '@/components/settings/EditProfileDialog';
import LegalSheet from '@/components/settings/LegalSheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const APP_VERSION = '1.0.0';

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: <Sun size={16} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  { value: 'auto', label: 'Auto', desc: 'Follows system', icon: <Smartphone size={16} /> },
];

const ORIENTATION_OPTIONS = [
  { value: 'portrait', label: 'Portrait', icon: <Smartphone size={16} /> },
  { value: 'landscape', label: 'Landscape', icon: <Monitor size={16} /> },
  { value: 'auto', label: 'Auto', desc: 'Free rotation', icon: <RotateCw size={16} /> },
];

function OptionRow({ option, current, onSelect }) {
  const isActive = current === option.value;
  return (
    <button onClick={() => onSelect(option.value)} className="flex w-full items-center justify-between px-4 py-3 transition-colors active:bg-secondary">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-muted-foreground">{option.icon}</span>
        <div className="text-left">
          <span className="block text-sm font-medium">{option.label}</span>
          {option.desc && <span className="block text-xs text-muted-foreground">{option.desc}</span>}
        </div>
      </div>
      {isActive && <Check size={20} className="text-primary" />}
    </button>
  );
}

export default function Settings() {
  const navigate = useNavigate();
  const { theme, setTheme, orientation, setOrientation } = useAppSettings();
  const [user, setUser] = useState(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [legalDoc, setLegalDoc] = useState(null);

  useEffect(() => {
    base44.auth.isAuthenticated().then(async (authed) => {
      if (authed) { const me = await base44.auth.me(); setUser(me); }
    }).catch(() => {});
  }, []);

  const handleLogout = () => base44.auth.logout('/');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.entities.User.delete(user.id);
      base44.auth.logout('/');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete account');
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-lg">
        <button onClick={() => navigate('/profile')} className="glove-target flex items-center justify-center rounded-full">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Settings</h1>
      </div>

      <div className="p-4">
        <SettingsSection title="Display" icon="🎨">
          <div className="px-4 py-2">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <Palette size={16} className="text-muted-foreground" /> Theme
            </div>
          </div>
          {THEME_OPTIONS.map((opt) => (
            <OptionRow key={opt.value} option={opt} current={theme} onSelect={setTheme} />
          ))}
        </SettingsSection>

        <SettingsSection title="Screen Orientation" icon="📱">
          <div className="px-4 py-2">
            <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
              <RotateCw size={16} className="text-muted-foreground" /> Orientation
            </div>
          </div>
          {ORIENTATION_OPTIONS.map((opt) => (
            <OptionRow key={opt.value} option={opt} current={orientation} onSelect={setOrientation} />
          ))}
        </SettingsSection>

        {user ? (
          <SettingsSection title="Account" icon="👤">
            <SettingsRow icon={<UserIcon size={16} />} label="Edit Profile" onClick={() => setEditProfileOpen(true)} />
            <SettingsRow icon={<KeyRound size={16} />} label="Change Password" onClick={() => navigate('/forgot-password')} />
            <SettingsRow icon={<LogOut size={16} />} label="Log Out" onClick={handleLogout} destructive />
            <SettingsRow icon={<Trash2 size={16} />} label="Delete Account" onClick={() => setDeleteDialogOpen(true)} destructive />
          </SettingsSection>
        ) : (
          <SettingsSection title="Account" icon="👤">
            <SettingsRow icon={<LogOut size={16} />} label="Log In" onClick={() => navigate('/login')} />
            <SettingsRow icon={<UserIcon size={16} />} label="Register" onClick={() => navigate('/register')} />
          </SettingsSection>
        )}

        <SettingsSection title="Privacy & Security" icon="🔒">
          <SettingsRow icon={<Shield size={16} />} label="Privacy Policy" onClick={() => setLegalDoc('privacy')} />
          <SettingsRow icon={<MapPin size={16} />} label="Location Services" value="Enabled" />
        </SettingsSection>

        <SettingsSection title="Legal" icon="📄">
          <SettingsRow icon={<FileText size={16} />} label="End User License Agreement" onClick={() => setLegalDoc('eula')} />
          <SettingsRow icon={<FileText size={16} />} label="Privacy Policy" onClick={() => setLegalDoc('privacy')} />
          <SettingsRow icon={<FileText size={16} />} label="Terms & Conditions" onClick={() => setLegalDoc('terms')} />
          <SettingsRow icon={<Info size={16} />} label="App Version" value={APP_VERSION} showChevron={false} />
        </SettingsSection>

        <SettingsSection title="About" icon="ℹ️">
          <SettingsRow icon={<Heart size={16} />} label="Built with ❤️ in South Africa" showChevron={false} />
          <SettingsRow icon={<Info size={16} />} label="Version" value={APP_VERSION} showChevron={false} />
        </SettingsSection>
      </div>

      <EditProfileDialog open={editProfileOpen} onOpenChange={setEditProfileOpen} />
      <LegalSheet doc={legalDoc} onClose={() => setLegalDoc(null)} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your MotoGo account. This action cannot be undone. Your ride history, bikes, and profile data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}