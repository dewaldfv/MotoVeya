import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function EditProfileDialog({ open, onOpenChange }) {
  const [form, setForm] = useState({ nickname: '', motorcycle_club: '', emergency_contact_name: '', emergency_contact_phone: '', medical_notes: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      base44.auth.isAuthenticated().then(async (authed) => {
        if (!authed) return;
        const me = await base44.auth.me();
        setForm({
          nickname: me.nickname || '',
          motorcycle_club: me.motorcycle_club || '',
          emergency_contact_name: me.emergency_contact_name || '',
          emergency_contact_phone: me.emergency_contact_phone || '',
          medical_notes: me.medical_notes || '',
        });
      });
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(form);
      toast.success('Profile updated');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit Profile</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="RoadCaptain" /></div>
          <div><Label>Motorcycle Club</Label><Input value={form.motorcycle_club} onChange={(e) => set('motorcycle_club', e.target.value)} placeholder="Outlaws MC" /></div>
          <div><Label>Emergency Contact Name</Label><Input value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} placeholder="Jane Doe" /></div>
          <div><Label>Emergency Contact Phone</Label><Input value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} placeholder="+27 82 000 0000" /></div>
          <div><Label>Medical Notes</Label><Input value={form.medical_notes} onChange={(e) => set('medical_notes', e.target.value)} placeholder="Allergic to penicillin" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}