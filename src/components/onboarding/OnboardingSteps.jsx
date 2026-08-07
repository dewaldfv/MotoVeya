import { motion } from 'framer-motion';
import {
  Bike, MapPin, Bell, Phone, Crown, Sparkles, Check, ShieldCheck, Navigation, Users, Calendar,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export const INTEREST_OPTIONS = [
  'Breakfast Runs', 'Charity Rides', 'Adventure Riding', 'Touring', 'Racing',
  'Adventure Bikes', 'Cruisers', 'Café Racers', 'Sport Bikes', 'Dual Sport', 'Enduro', 'Custom Bikes',
];

const RELATIONSHIPS = ['Spouse', 'Partner', 'Parent', 'Sibling', 'Child', 'Friend', 'Other'];

const StepHeader = ({ icon: Icon, title, subtitle }) => (
  <div className="mb-6">
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
      <Icon size={30} />
    </div>
    <h2 className="text-center text-2xl font-bold">{title}</h2>
    {subtitle && <p className="mt-2 text-center text-sm text-muted-foreground">{subtitle}</p>}
  </div>
);

const FeatureRow = ({ icon: Icon, title, desc }) => (
  <div className="flex items-start gap-3 rounded-2xl bg-card p-3">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon size={20} /></div>
    <div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{desc}</p></div>
  </div>
);

export function WelcomeStep({ onNext }) {
  const features = [
    { icon: Users, title: 'Motorcycle Community', desc: 'Connect with riders across South Africa' },
    { icon: Navigation, title: 'Navigation', desc: 'Turn-by-turn routes built for bikes' },
    { icon: ShieldCheck, title: 'Ride Safety', desc: 'Crash detection & distress alerts' },
    { icon: Calendar, title: 'Events', desc: 'Rallies, breakfast runs & ride outs' },
  ];
  return (
    <div>
      <StepHeader icon={Sparkles} title="Welcome to MotoGo" subtitle="Your bike. Anytime. Anywhere." />
      <div className="space-y-3">
        {features.map((f) => <FeatureRow key={f.title} {...f} />)}
      </div>
      <Button className="mt-6 min-h-[56px] w-full text-base" onClick={onNext}>Next</Button>
    </div>
  );
}

export function LocationStep({ onNext, saving }) {
  const request = async () => {
    try {
      if (navigator.geolocation) {
        await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 }));
      }
    } catch { /* user denied — continue anyway */ }
    onNext();
  };
  const items = [
    ['GPS Navigation', 'Turn-by-turn routing'],
    ['Live Ride Tracking', 'Share your position with friends'],
    ['Crash Detection', 'Auto-alert your emergency contact'],
    ['Nearby Events', 'Discover rides happening around you'],
  ];
  return (
    <div>
      <StepHeader icon={MapPin} title="Location Permission" subtitle="Used for navigation, tracking & nearby events" />
      <div className="space-y-3 text-sm">
        {items.map(([t, d]) => (
          <div key={t} className="flex items-start gap-3 rounded-2xl bg-card p-3"><MapPin size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="font-semibold">{t}</p><p className="text-muted-foreground">{d}</p></div></div>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" className="min-h-[56px] flex-1 text-base" disabled={saving} onClick={onNext}>Skip for now</Button>
        <Button className="min-h-[56px] flex-1 text-base" disabled={saving} onClick={request}>{saving ? 'Saving…' : 'Allow Location'}</Button>
      </div>
    </div>
  );
}

export function NotificationsStep({ onNext, saving }) {
  const request = async () => {
    try {
      if ('Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch { /* ignore */ }
    onNext();
  };
  const items = [
    ['Ride Alerts', 'Group ride updates & invitations'],
    ['Event Updates', 'Reminders for upcoming events'],
    ['Friend Requests', 'Know when riders want to connect'],
    ['Emergency Notifications', 'Critical distress alerts'],
  ];
  return (
    <div>
      <StepHeader icon={Bell} title="Notifications" subtitle="Stay informed on and off the road" />
      <div className="space-y-3 text-sm">
        {items.map(([t, d]) => (
          <div key={t} className="flex items-start gap-3 rounded-2xl bg-card p-3"><Bell size={18} className="mt-0.5 shrink-0 text-primary" /><div><p className="font-semibold">{t}</p><p className="text-muted-foreground">{d}</p></div></div>
        ))}
      </div>
      <div className="mt-6 flex gap-2">
        <Button variant="secondary" className="min-h-[56px] flex-1 text-base" disabled={saving} onClick={onNext}>Skip</Button>
        <Button className="min-h-[56px] flex-1 text-base" disabled={saving} onClick={request}>{saving ? 'Saving…' : 'Enable Notifications'}</Button>
      </div>
    </div>
  );
}

export function EmergencyStep({ form, set, onNext, saving }) {
  const canNext = form.emergency_contact_name.trim() && form.emergency_contact_phone.trim();
  return (
    <div>
      <StepHeader icon={Phone} title="Emergency Contact" subtitle="Used for crash detection & distress alerts" />
      <div className="space-y-3">
        <div><Label>Contact Name *</Label><Input value={form.emergency_contact_name} onChange={(e) => set('emergency_contact_name', e.target.value)} placeholder="Jane Doe" className="min-h-[48px]" /></div>
        <div><Label>Phone Number *</Label><Input type="tel" value={form.emergency_contact_phone} onChange={(e) => set('emergency_contact_phone', e.target.value)} placeholder="+27 82 123 4567" className="min-h-[48px]" /></div>
        <div>
          <Label>Relationship</Label>
          <select value={form.emergency_contact_relationship} onChange={(e) => set('emergency_contact_relationship', e.target.value)} className="flex min-h-[48px] w-full rounded-md border border-input bg-transparent px-3 text-base">
            <option value="">Select…</option>
            {RELATIONSHIPS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div><Label>Medical Notes</Label><Textarea value={form.medical_notes} onChange={(e) => set('medical_notes', e.target.value)} placeholder="Allergies, blood type, conditions (optional)" rows={2} /></div>
      </div>
      <Button className="mt-6 min-h-[56px] w-full text-base" disabled={!canNext || saving} onClick={onNext}>{saving ? 'Saving…' : 'Next'}</Button>
    </div>
  );
}

export function MotorcycleStep({ form, set, onNext, saving }) {
  const canNext = form.make.trim() && form.model.trim();
  return (
    <div>
      <StepHeader icon={Bike} title="Motorcycle Information" subtitle="Improves fuel, route & maintenance tracking" />
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Make *</Label><Input value={form.make} onChange={(e) => set('make', e.target.value)} placeholder="KTM" className="min-h-[48px]" /></div>
          <div><Label>Model *</Label><Input value={form.model} onChange={(e) => set('model', e.target.value)} placeholder="390 Adventure" className="min-h-[48px]" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => set('year', e.target.value)} placeholder="2024" className="min-h-[48px]" /></div>
          <div><Label>Engine Size (cc)</Label><Input type="number" value={form.engine_size_cc} onChange={(e) => set('engine_size_cc', e.target.value)} placeholder="373" className="min-h-[48px]" /></div>
        </div>
        <div><Label>Fuel Tank Capacity (L) — optional</Label><Input type="number" step="0.1" value={form.tank_capacity_l} onChange={(e) => set('tank_capacity_l', e.target.value)} placeholder="14.5" className="min-h-[48px]" /></div>
      </div>
      <Button className="mt-6 min-h-[56px] w-full text-base" disabled={!canNext || saving} onClick={onNext}>{saving ? 'Saving…' : 'Next'}</Button>
    </div>
  );
}

export function InterestsStep({ form, set, onNext, saving }) {
  const toggle = (i) => set('interests', form.interests.includes(i) ? form.interests.filter((x) => x !== i) : [...form.interests, i]);
  return (
    <div>
      <StepHeader icon={Sparkles} title="Choose Your Interests" subtitle="Personalizes your Events feed" />
      <div className="flex flex-wrap gap-2">
        {INTEREST_OPTIONS.map((i) => {
          const active = form.interests.includes(i);
          return (
            <button key={i} onClick={() => toggle(i)} className={`rounded-full border-2 px-4 py-2 text-sm font-medium transition-colors ${active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card'}`}>
              {active && <Check size={14} className="mr-1 inline" />}{i}
            </button>
          );
        })}
      </div>
      <Button className="mt-6 min-h-[56px] w-full text-base" disabled={saving} onClick={onNext}>{saving ? 'Saving…' : 'Next'}</Button>
    </div>
  );
}

export function SubscriptionStep({ set, onNext, saving }) {
  return (
    <div>
      <StepHeader icon={Crown} title="Choose Your Plan" subtitle="Upgrade anytime" />
      <div className="space-y-3">
        <div className="rounded-2xl border-2 border-border bg-card p-4">
          <p className="font-bold">Free</p>
          <p className="mt-1 text-sm text-muted-foreground">Navigation, Events, Crash Detection, 2-rider groups.</p>
          <p className="mt-1 text-lg font-black">R0<span className="text-sm font-normal text-muted-foreground">/month</span></p>
        </div>
        <div className="rounded-2xl border-2 border-primary bg-primary/5 p-4">
          <p className="font-bold text-primary">Premium</p>
          <p className="mt-1 text-sm text-muted-foreground">Up to 32-rider groups, Rider in Distress, friends list, premium navigation, emergency services, advanced analytics.</p>
          <p className="mt-1 text-lg font-black text-primary">R69.99<span className="text-sm font-normal text-muted-foreground">/month</span></p>
        </div>
      </div>
      <div className="mt-6 space-y-2">
        <Button className="min-h-[56px] w-full text-base" disabled={saving} onClick={() => { set('subscription', 'free'); onNext(); }}>Continue with Free</Button>
        <Button variant="outline" className="min-h-[56px] w-full text-base border-primary text-primary" disabled={saving} onClick={() => { set('subscription', 'premium'); onNext(); }}>Upgrade to Premium</Button>
      </div>
    </div>
  );
}

export function FinishStep({ form, onFinish, saving }) {
  return (
    <div className="text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200 }}
        className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-primary/10 text-primary"
      >
        <Bike size={56} />
      </motion.div>
      <h2 className="text-3xl font-black">You're ready to ride.</h2>
      <p className="mt-2 text-muted-foreground">Welcome to the community{form.nickname ? `, ${form.nickname}` : ''}. Let's hit the road.</p>
      <Button className="mt-8 min-h-[56px] w-full text-base" disabled={saving} onClick={onFinish}>{saving ? 'Finishing…' : 'Start Riding'}</Button>
    </div>
  );
}