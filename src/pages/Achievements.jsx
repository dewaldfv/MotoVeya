import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, Trophy, Lock, Flame, CheckCircle2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Progress } from '@/components/ui/progress';
import LoginPrompt from '@/components/LoginPrompt';
import { evaluateAchievements } from '@/lib/achievements';

function AchievementCard({ item, index }) {
  const pct = Math.round(item.progress * 100);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className={`rounded-3xl border p-4 ${
        item.current >= item.threshold
          ? 'border-primary/30 bg-primary/5'
          : item.current > 0
          ? 'border-amber-500/30 bg-amber-500/5'
          : 'border-border bg-card'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ${
          item.current >= item.threshold
            ? 'bg-primary/15'
            : item.current > 0
            ? 'bg-amber-500/15'
            : 'bg-muted grayscale'
        }`}>
          {item.current >= item.threshold ? item.emoji : <span className="opacity-50">{item.emoji}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-bold">{item.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">{item.description}</p>
          <div className="mt-3">
            <Progress value={pct} className="h-2" />
            <div className="mt-1.5 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {item.current} / {item.threshold}{item.unit ? ` ${item.unit}` : ''}
              </span>
              <span className={item.current >= item.threshold ? 'font-semibold text-primary' : 'text-muted-foreground'}>
                {pct}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function Section({ icon, title, subtitle, items, accent }) {
  if (!items.length) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1">
        <div className={`flex h-8 w-8 items-center justify-center rounded-full ${accent}`}>{icon}</div>
        <div>
          <h2 className="font-bold leading-tight">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <span className="ml-auto rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">{items.length}</span>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => <AchievementCard key={item.id} item={item} index={i} />)}
      </div>
    </div>
  );
}

export default function Achievements() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) { setLoading(false); return; }
        const me = await base44.auth.me();
        setUser(me);
      } catch (e) { console.error(e); } finally { setLoading(false); }
    })();
  }, []);

  const { data: rides = [] } = useQuery({
    queryKey: ['achievements-rides', user?.id],
    queryFn: () => base44.entities.Ride.filter({ created_by_id: user.id }, '-ride_date', 500),
    enabled: !!user?.id,
  });
  const { data: refills = [] } = useQuery({
    queryKey: ['achievements-refills', user?.id],
    queryFn: () => base44.entities.FuelRefill.filter({}, '-refill_date', 500),
    enabled: !!user?.id,
  });
  const { data: friends = [] } = useQuery({
    queryKey: ['achievements-friends', user?.id],
    queryFn: () => base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 200),
    enabled: !!user?.id,
  });
  const { data: memberships = [] } = useQuery({
    queryKey: ['achievements-memberships', user?.id],
    queryFn: () => base44.entities.GroupMember.filter({ user_id: user.id, status: 'active' }, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { collected, inProgress, locked } = useMemo(() => {
    const totalRides = user?.total_rides || rides.length;
    const totalDistance = Math.round(user?.total_distance_km || rides.reduce((s, r) => s + (r.distance_km || 0), 0));
    const maxSpeed = Math.max(0, ...rides.map((r) => r.max_speed_kmh || 0));
    return evaluateAchievements({
      totalRides,
      totalDistance,
      maxSpeed,
      refills: refills.length,
      friends: friends.length,
      groups: memberships.length,
      emergencyContacts: user?.emergency_contact_name ? 1 : 0,
    });
  }, [user, rides, refills, friends, memberships]);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt message="Log in to view your achievements" />;

  const total = collected.length + inProgress.length + locked.length;

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-2xl p-4 space-y-5">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-sm active:scale-95">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-xl font-bold">Achievements</h1>
            <p className="text-sm text-muted-foreground">{collected.length} of {total} unlocked</p>
          </div>
        </div>

        <div className="rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/20">
              <Trophy className="text-primary" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-end gap-1">
                <span className="text-3xl font-black text-primary">{collected.length}</span>
                <span className="pb-1 text-sm text-muted-foreground">/ {total} unlocked</span>
              </div>
              <Progress value={Math.round((collected.length / total) * 100)} className="mt-2 h-2" />
            </div>
          </div>
        </div>

        <Section
          icon={<CheckCircle2 size={16} className="text-primary" />}
          title="Collected"
          subtitle="Badges you've earned"
          items={collected}
          accent="bg-primary/15" />

        <Section
          icon={<Flame size={16} className="text-amber-500" />}
          title="In Progress"
          subtitle="Keep riding to unlock these"
          items={inProgress}
          accent="bg-amber-500/15" />

        <Section
          icon={<Lock size={16} className="text-muted-foreground" />}
          title="Locked"
          subtitle="Not started yet"
          items={locked}
          accent="bg-muted" />
      </div>
    </div>
  );
}