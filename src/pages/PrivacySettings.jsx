import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Bike, BarChart3, MapPin, Users, Route, Calendar, Trophy, Fuel, Lock, Camera } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

const DEFAULTS = {
  show_motorcycle: true,
  show_weekly_stats: true,
  share_live_location: true,
  location_group_rides_only: false,
  show_completed_rides: true,
  show_events: true,
  show_achievements: true,
  show_fuel_stats: false,
  show_photos: true,
};

function ToggleRow({ icon: Icon, label, desc, checked, onChange, locked, last }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3.5 ${last ? '' : 'border-b border-border'}`}>
      <Icon size={20} className={locked ? 'text-muted-foreground' : 'text-primary'} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {desc && <p className="text-xs text-muted-foreground">{desc}</p>}
      </div>
      {locked ? (
        <span className="flex items-center gap-1 text-xs text-muted-foreground"><Lock size={14} /> Private</span>
      ) : (
        <Switch checked={checked} onCheckedChange={onChange} disabled={locked} />
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="mb-6">
      <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</p>
      <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
    </div>
  );
}

export default function PrivacySettings() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['privacy-settings'],
    queryFn: async () => {
      const existing = await base44.entities.PrivacySetting.filter({}, '-created_date', 1);
      return existing?.[0] || null;
    },
  });

  const current = { ...DEFAULTS, ...(settings || {}) };

  const update = async (field, value) => {
    setSaving(true);
    try {
      if (settings?.id) {
        await base44.entities.PrivacySetting.update(settings.id, { [field]: value });
      } else {
        await base44.entities.PrivacySetting.create({ ...DEFAULTS, [field]: value });
      }
      await queryClient.invalidateQueries({ queryKey: ['privacy-settings'] });
    } catch (e) {
      console.error(e);
      toast.error('Could not update setting');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-lg">
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full" aria-label="Back">
          <ChevronLeft size={26} />
        </button>
        <h1 className="text-xl font-bold">Privacy Settings</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        <p className="mb-6 px-1 text-sm text-muted-foreground">
          Control exactly what your friends and fellow riders can see. Sensitive information like your phone number, email, and emergency contacts is always private.
        </p>

        <Section title="🏍️ Motorcycle">
          <ToggleRow icon={Bike} label="Show my motorcycle(s)" desc="Let friends see your bike make and model" checked={current.show_motorcycle} onChange={(v) => update('show_motorcycle', v)} />
        </Section>

        <Section title="📊 Statistics">
          <ToggleRow icon={BarChart3} label="Show weekly riding statistics" desc="Distance, ride time, and activity chart" checked={current.show_weekly_stats} onChange={(v) => update('show_weekly_stats', v)} />
          <ToggleRow icon={Fuel} label="Show fuel statistics" desc="Consumption, refills, and range" checked={current.show_fuel_stats} onChange={(v) => update('show_fuel_stats', v)} last />
        </Section>

        <Section title="📍 Live Location">
          <ToggleRow icon={MapPin} label="Share live location with friends" desc="Friends can see where you are on the map" checked={current.share_live_location} onChange={(v) => update('share_live_location', v)} />
          <ToggleRow icon={Users} label="Only during group rides" desc="Hide location except when riding in a shared group" checked={current.location_group_rides_only} onChange={(v) => update('location_group_rides_only', v)} last />
        </Section>

        <Section title="🗺️ Activity">
          <ToggleRow icon={Route} label="Show completed rides" desc="Your ride history and routes" checked={current.show_completed_rides} onChange={(v) => update('show_completed_rides', v)} />
          <ToggleRow icon={Calendar} label="Show attended events" desc="Events you've marked as attending" checked={current.show_events} onChange={(v) => update('show_events', v)} />
          <ToggleRow icon={Trophy} label="Show achievements and badges" desc="Riding milestones and awards" checked={current.show_achievements} onChange={(v) => update('show_achievements', v)} />
          <ToggleRow icon={Camera} label="Show ride photos" desc="Photos from your completed rides" checked={current.show_photos} onChange={(v) => update('show_photos', v)} last />
        </Section>

        <Section title="🔒 Always Private">
          <ToggleRow icon={Lock} label="Phone number" desc="Never shared with other riders" checked={false} onChange={() => {}} locked />
          <ToggleRow icon={Lock} label="Email address" desc="Never shared with other riders" checked={false} onChange={() => {}} locked />
          <ToggleRow icon={Lock} label="Emergency contacts" desc="Never shared with other riders" checked={false} onChange={() => {}} locked last />
        </Section>

        <p className="mt-2 px-1 text-center text-xs text-muted-foreground">
          Group ride live tracking is only visible to members while the ride is active. Once a ride ends, private info stays hidden.
        </p>
      </div>
    </div>
  );
}