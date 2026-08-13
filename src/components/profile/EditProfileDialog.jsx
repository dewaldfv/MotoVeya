import { useState, useEffect } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function EditProfileDialog({ user, open, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    setForm({
      nickname: user.nickname || '',
      motorcycle_club: user.motorcycle_club || '',
      bio: user.bio || '',
      phone: user.phone || '',
    });
  }, [open, user]);

  if (!open || !form) return null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe(form);
      toast.success('Profile updated');
      onSaved?.(form);
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Could not update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Pencil size={18} /> Edit Profile</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="RoadCaptain" /></div>
          <div><Label>Motorcycle Club</Label><Input value={form.motorcycle_club} onChange={(e) => set('motorcycle_club', e.target.value)} placeholder="The Wild Bunch SA" /></div>
          <div><Label>Phone</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="082 123 4567" /></div>
          <div><Label>Bio</Label><Textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} rows={3} placeholder="Tell other riders about yourself..." /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}