import { useState, useEffect } from 'react';
import { Shield, Siren, Phone, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import BottomSheet from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function EmergencySafetySheet({ user, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [crashDetection, setCrashDetection] = useState(false);
  const [sosActive, setSosActive] = useState(false);
  const [sosSending, setSosSending] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setForm({
      emergency_contact_name: user.emergency_contact_name || '',
      emergency_contact_phone: user.emergency_contact_phone || '',
      emergency_contact_email: user.emergency_contact_email || '',
      emergency_contact_relationship: user.emergency_contact_relationship || '',
      medical_notes: user.medical_notes || '',
      medical_aid: user.medical_aid || '',
    });
    setCrashDetection(localStorage.getItem('motogo_crash_detection_enabled') !== 'false');
  }, [open, user]);

  if (!open || !form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const toggleCrash = (checked) => {
    setCrashDetection(checked);
    localStorage.setItem('motogo_crash_detection_enabled', checked ? 'true' : 'false');
    window.dispatchEvent(new Event('motoveya:crash-detection-changed'));
    try { window.MotoVeyaNative?.setNativeCrashDetectionEnabled?.(checked); } catch {}
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(form);
      toast.success('Emergency details saved');
      onSaved?.(form);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Could not save details');
    } finally {
      setSaving(false);
    }
  };

  const triggerSOS = async () => {
    setSosSending(true);
    try {
      const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(
        (p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }),
        () => rej(new Error('loc')),
        { enableHighAccuracy: true, timeout: 8000 }
      ));
      await base44.functions.invoke('trigger-emergency-response', {
        lat: pos.lat,
        lng: pos.lng,
        rider_name: user.nickname || user.full_name,
        severity: 'high',
      });
      setSosActive(true);
      toast.success('Emergency alert sent');
    } catch (e) {
      console.error(e);
      toast.error('Could not send SOS — allow location access');
    } finally {
      setSosSending(false);
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="Emergency & Safety">
      <div className="space-y-5">
        {sosActive ? (
          <div className="rounded-2xl bg-destructive/10 p-4 text-center">
            <Siren size={36} className="mx-auto mb-2 animate-pulse text-destructive" />
            <p className="font-bold text-destructive">Emergency Active</p>
            <p className="mt-1 text-sm text-muted-foreground">Your live location has been shared with your emergency contact.</p>
            <a href="tel:112" className="mt-3 flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive text-base font-bold text-destructive-foreground">
              <Phone size={20} /> Call 112
            </a>
            <Button variant="outline" className="mt-2 w-full" onClick={() => setSosActive(false)}>I'm Safe — End Rider Down Alert</Button>
          </div>
        ) : (
          <button
            onClick={triggerSOS}
            disabled={sosSending}
            className="flex min-h-[64px] w-full items-center justify-center gap-2 rounded-2xl bg-destructive text-lg font-bold text-destructive-foreground transition-transform active:scale-95 disabled:opacity-60"
          >
            {sosSending ? <Loader2 size={22} className="animate-spin" /> : <Siren size={22} />}
            {sosSending ? 'Sending...' : 'RIDER DOWN — Alert Nearby Riders'}
          </button>
        )}

        <div>
          <p className="mb-2 text-sm font-bold">Crash Detection</p>
          <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
            <Shield size={20} className="text-primary" />
            <span className="flex-1 text-sm font-medium">Auto crash detection</span>
            <Switch checked={crashDetection} onCheckedChange={toggleCrash} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">Emergency Contact</p>
          <div className="space-y-2">
            <div><Label>Contact Name</Label><Input value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} placeholder="Jane Doe" /></div>
            <div><Label>Phone</Label><Input value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} placeholder="082 123 4567" /></div>
            <div><Label>Email</Label><Input value={form.emergency_contact_email} onChange={(e) => set('emergency_contact_email', e.target.value)} placeholder="jane@example.com" /></div>
            <div><Label>Relationship</Label><Input value={form.emergency_contact_relationship} onChange={(e) => set('emergency_contact_relationship', e.target.value)} placeholder="Spouse" /></div>
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-bold">Medical Info</p>
          <div className="space-y-2">
            <div><Label>Medical Aid</Label><Input value={form.medical_aid} onChange={(e) => set('medical_aid', e.target.value)} placeholder="e.g. Discovery Health" /></div>
            <div><Label>Medical Notes</Label><Textarea value={form.medical_notes} onChange={(e) => set('medical_notes', e.target.value)} rows={3} placeholder="Allergies, conditions, blood type..." /></div>
          </div>
        </div>

        <Button className="min-h-[48px] w-full" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Details'}
        </Button>
      </div>
    </BottomSheet>
  );
}