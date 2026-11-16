import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Selections that grant one access directly rather than a whole package.
const FEATURE_GRANTS = ['premium_rider', 'provider'];

const GRANT_OPTIONS = [
  { value: 'none', label: 'No manual grant' },
  { value: 'premium_rider', label: 'Premium Rider' },
  { value: 'provider', label: 'Service Provider' },
  { value: 'organizer', label: 'Organizer' },
  { value: 'organizer_plus', label: 'Organizer+' },
  { value: 'provider_plus', label: 'Provider+' },
  { value: 'gold', label: 'Gold' },
];
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
      planGrant: user.plan_grant && user.plan_grant !== 'none'
        ? user.plan_grant
        : user.provider_grant === 'admin'
          ? 'provider'
          : user.subscription_tier === 'premium' ? 'premium_rider' : 'none',
    });
  }, [user]);

  if (!user || !form) return null;

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // A paid provider keeps their access when the admin grant is removed.
  const hasPaidProviderPackage = async () => {
    try {
      const subs = await base44.entities.Subscription.filter({ user_id: user.id, plan: 'provider' }, '-created_date', 10);
      const now = Date.now();
      return (subs.items || subs).some((s) => (
        ['active', 'trialing', 'cancelled', 'past_due'].includes(s.status)
        && (!s.expiry_date || new Date(s.expiry_date).getTime() > now)
      ));
    } catch (e) {
      console.error('Provider subscription lookup failed', e);
      return true;
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const packageGrant = FEATURE_GRANTS.includes(form.planGrant) ? 'none' : form.planGrant;
      // A package grant carries its own rider access, so a paid rider tier is left untouched.
      const riderPremium = form.planGrant === 'premium_rider'
        || (packageGrant !== 'none' && user.subscription_tier === 'premium');

      const updates = {
        nickname: form.nickname,
        motorcycle_club: form.motorcycle_club,
        avatar_url: form.avatar_url,
        cover_url: form.cover_url,
        bio: form.bio,
        subscription_tier: riderPremium ? 'premium' : 'free',
        subscription_status: riderPremium ? 'active' : 'none',
        plan_grant: packageGrant,
      };

      if (form.planGrant === 'provider') {
        updates.account_type = 'provider';
        updates.provider_status = 'active';
        updates.provider_expiry = null;
        updates.provider_grant = 'admin';
      } else if (user.provider_grant === 'admin') {
        updates.provider_grant = 'none';
        if (!(await hasPaidProviderPackage())) {
          updates.account_type = 'rider';
          updates.provider_status = 'none';
          updates.provider_expiry = null;
        }
      }

      await base44.entities.User.update(user.id, updates);

      // Ensure a Subscription record reflects the admin's choice
      try {
        const subs = await base44.entities.Subscription.filter({ user_id: user.id }, '-created_date', 5);
        if (subs.length > 0) {
          await base44.entities.Subscription.update(subs[0].id, {
            plan: riderPremium ? 'premium' : 'free',
            status: 'active',
          });
        } else {
          await base44.entities.Subscription.create({
            user_id: user.id,
            plan: riderPremium ? 'premium' : 'free',
            status: 'active',
            amount_zar: riderPremium ? 69.99 : 0,
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
          <div className="rounded-2xl bg-card p-3">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} className="text-primary" />
              <div>
                <p className="font-semibold">Plan access grant</p>
                <p className="text-xs text-muted-foreground">
                  Grant rider, provider or a package without payment. Their paid subscription stays as it is.
                </p>
              </div>
            </div>
            <Select value={form.planGrant} onValueChange={(v) => set('planGrant', v)}>
              <SelectTrigger className="mt-3 min-h-[48px]">
                <SelectValue placeholder="No manual grant" />
              </SelectTrigger>
              <SelectContent>
                {GRANT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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