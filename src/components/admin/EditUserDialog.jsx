import { useEffect, useState } from 'react';
import { Crown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function EditUserDialog({ user, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    setForm({
      nickname: user.nickname || '',
      motorcycle_club: user.motorcycle_club || '',
      avatar_url: user.avatar_url || '',
      cover_url: user.cover_url || '',
      bio: user.bio || '',
      isPremium: user.subscription_tier === 'premium',
    });
  }, [user]);

  if (!user || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = {
        nickname: form.nickname,
        motorcycle_club: form.motorcycle_club,
        avatar_url: form.avatar_url,
        cover_url: form.cover_url,
        bio: form.bio,
        subscription_tier: form.isPremium ? 'premium' : 'free',
        subscription_status: form.isPremium ? 'active' : 'none',
      };
      await base44.entities.User.update(user.id, updates);

      // Ensure a Subscription record reflects the admin's choice
      try {
        const subs = await base44.entities.Subscription.filter({ user_id: user.id }, '-created_date', 5);
        if (subs.length > 0) {
          await base44.entities.Subscription.update(subs[0].id, {
            plan: form.isPremium ? 'premium' : 'free',
            status: 'active',
          });
        } else {
          await base44.entities.Subscription.create({
            user_id: user.id,
            plan: form.isPremium ? 'premium' : 'free',
            status: 'active',
            amount_zar: form.isPremium ? 89.99 : 0,
            purchase_date: new Date().toISOString(),
            auto_renew: true,
          });
        }
      } catch (e) {
        console.error('Subscription sync failed', e);
      }

      toast.success(`${user.full_name || user.nickname || 'User'} updated`);
      onSaved();
      onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update user');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {user.full_name || user.nickname || 'User'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nickname</Label>
            <Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Motorcycle Club</Label>
            <Input value={form.motorcycle_club} onChange={(e) => set('motorcycle_club', e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Avatar URL</Label>
            <Input value={form.avatar_url} onChange={(e) => set('avatar_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Cover URL</Label>
            <Input value={form.cover_url} onChange={(e) => set('cover_url', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <Label>Bio</Label>
            <Textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Optional" rows={3} />
          </div>
          <div className="flex items-center justify-between rounded-2xl bg-card p-3">
            <div className="flex items-center gap-2">
              <Crown size={20} className="text-primary" />
              <div>
                <p className="font-semibold">Premium Rider</p>
                <p className="text-xs text-muted-foreground">Grant or revoke Premium access</p>
              </div>
            </div>
            <Switch checked={form.isPremium} onCheckedChange={(v) => set('isPremium', v)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button disabled={saving} onClick={handleSave}>{saving ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}