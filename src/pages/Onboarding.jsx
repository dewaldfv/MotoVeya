import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, ChevronLeft, Bike as BikeIcon, Phone, Crown, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STEPS = ['Profile', 'Motorcycle', 'Emergency', 'Plan'];

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nickname: '', motorcycle_club: '', bio: '',
    make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '',
    emergency_contact_name: '', emergency_contact_phone: '', medical_notes: '',
    subscription: 'free',
  });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const canNext = () => {
    if (step === 0) return form.nickname.trim();
    if (step === 1) return form.make.trim() && form.model.trim();
    if (step === 2) return form.emergency_contact_name.trim() && form.emergency_contact_phone.trim();
    return true;
  };

  const handleComplete = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        nickname: form.nickname, motorcycle_club: form.motorcycle_club, bio: form.bio,
        emergency_contact_name: form.emergency_contact_name, emergency_contact_phone: form.emergency_contact_phone,
        medical_notes: form.medical_notes, subscription_tier: form.subscription, subscription_status: form.subscription === 'premium' ? 'active' : 'none',
        onboarding_completed: true,
      });
      await base44.entities.Bike.create({
        make: form.make, model: form.model, year: Number(form.year) || undefined,
        engine_size_cc: Number(form.engine_size_cc) || undefined, tank_capacity_l: Number(form.tank_capacity_l) || undefined,
        fuel_consumption_l_per_100km: Number(form.fuel_consumption_l_per_100km) || undefined, is_primary: true,
      });
      await base44.entities.Subscription.create({ plan: form.subscription, status: 'active', amount_zar: form.subscription === 'premium' ? 69.99 : 0, start_date: new Date().toISOString(), auto_renew: true });
      toast.success('Welcome to MotoGo!');
      navigate('/');
    } catch (e) {
      console.error(e);
      toast.error('Failed to save. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-md">
        <div className="mb-6 mt-4 flex items-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? 'bg-primary' : 'bg-secondary'}`} />
          ))}
        </div>

        <h1 className="mb-1 text-2xl font-bold">{STEPS[step]}</h1>
        <p className="mb-6 text-sm text-muted-foreground">Step {step + 1} of {STEPS.length}</p>

        {step === 0 && (
          <div className="space-y-3">
            <div><Label>Nickname / Rider Name *</Label><Input value={form.nickname} onChange={(e) => set('nickname', e.target.value)} placeholder="GhostRider" className="min-h-[48px]" /></div>
            <div><Label>Motorcycle Club</Label><Input value={form.motorcycle_club} onChange={(e) => set('motorcycle_club', e.target.value)} placeholder="Optional" className="min-h-[48px]" /></div>
            <div><Label>Bio</Label><Textarea value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder="Tell other riders about yourself" rows={3} /></div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary"><BikeIcon size={20} /><span className="font-semibold">Your Motorcycle</span></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make *</Label><Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="KTM" className="min-h-[48px]" /></div>
              <div><Label>Model *</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="390 Adventure" className="min-h-[48px]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" className="min-h-[48px]" /></div>
              <div><Label>Engine (cc)</Label><Input type="number" value={form.engine_size_cc} onChange={(e) => set('engine_size_cc', e.target.value)} placeholder="373" className="min-h-[48px]" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tank (L)</Label><Input type="number" step="0.1" value={form.tank_capacity_l} onChange={(e) => set('tank_capacity_l', e.target.value)} placeholder="14.5" className="min-h-[48px]" /></div>
              <div><Label>L/100km</Label><Input type="number" step="0.1" value={form.fuel_consumption_l_per_100km} onChange={(e) => set('fuel_consumption_l_per_100km', e.target.value)} placeholder="3.5" className="min-h-[48px]" /></div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary"><Phone size={20} /><span className="font-semibold">Emergency Contact</span></div>
            <div><Label>Contact Name *</Label><Input value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} placeholder="Jane Doe" className="min-h-[48px]" /></div>
            <div><Label>Phone Number *</Label><Input type="tel" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} placeholder="+27 82 123 4567" className="min-h-[48px]" /></div>
            <div><Label>Medical Notes</Label><Textarea value={form.medical_notes} onChange={(e) => set('medical_notes', e.target.value)} placeholder="Allergies, blood type, conditions (optional)" rows={2} /></div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-primary"><Crown size={20} /><span className="font-semibold">Choose Your Plan</span></div>
            <button onClick={() => set('subscription', 'free')} className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${form.subscription === 'free' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className="flex items-center justify-between"><span className="font-bold">Free Rider</span>{form.subscription === 'free' && <Check size={20} className="text-primary" />}</div>
              <p className="mt-1 text-sm text-muted-foreground">Navigation, fuel calculator, crash detection, 2-rider groups.</p>
              <p className="mt-1 text-lg font-black">R0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            </button>
            <button onClick={() => set('subscription', 'premium')} className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${form.subscription === 'premium' ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <div className="flex items-center justify-between"><span className="font-bold text-primary">Premium Rider</span>{form.subscription === 'premium' && <Check size={20} className="text-primary" />}</div>
              <p className="mt-1 text-sm text-muted-foreground">Everything in Free + Rider In Distress, emergency services, 32-rider groups, friends network.</p>
              <p className="mt-1 text-lg font-black text-primary">R69.99<span className="text-sm font-normal text-muted-foreground">/month</span></p>
            </button>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          {step > 0 && <Button variant="secondary" className="min-h-[56px] px-6" onClick={() => setStep(step - 1)}><ChevronLeft size={20} /></Button>}
          {step < STEPS.length - 1 ? (
            <Button className="min-h-[56px] flex-1 text-base" disabled={!canNext()} onClick={() => setStep(step + 1)}>Next <ChevronRight size={20} /></Button>
          ) : (
            <Button className="min-h-[56px] flex-1 text-base" disabled={saving} onClick={handleComplete}>{saving ? 'Saving...' : 'Start Riding'}</Button>
          )}
        </div>
      </div>
    </div>
  );
}