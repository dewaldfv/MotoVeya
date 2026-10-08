import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Shield, Route as RouteIcon, AlertTriangle, Siren, TrendingUp, Bike as BikeIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoginPrompt from '@/components/LoginPrompt';

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-ZA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

export default function SafetyDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { const ok = await base44.auth.isAuthenticated(); if (ok) setUser(await base44.auth.me()); }
      catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const { data: rides = [] } = useQuery({
    queryKey: ['safety-rides', user?.id],
    queryFn: () => base44.entities.Ride.filter({}, '-ride_date', 200),
    enabled: !!user?.id,
  });

  const { data: crashAlerts = [], refetch: refetchCrash } = useQuery({
    queryKey: ['safety-crash', user?.id],
    queryFn: () => base44.entities.CrashAlert.filter({ rider_id: user.id }, '-timestamp', 100),
    enabled: !!user?.id,
  });

  // Automatically clear weekly false-alarm crash alerts when the dashboard opens,
  // then refetch so the score reflects only valid incidents.
  useEffect(() => {
    if (!user?.id) return;
    base44.functions.invoke('clear-false-crash-alerts', {})
      .then(() => refetchCrash())
      .catch(() => { /* non-fatal — score calc already excludes false alarms */ });
  }, [user?.id, refetchCrash]);

  const { data: distressAlerts = [] } = useQuery({
    queryKey: ['safety-distress', user?.id],
    queryFn: () => base44.entities.DistressAlert.filter({ rider_id: user.id }, '-timestamp', 100),
    enabled: !!user?.id,
  });

  const stats = useMemo(() => {
    const totalDistance = Math.round(user?.total_distance_km || rides.reduce((s, r) => s + (r.distance_km || 0), 0));
    const totalRides = user?.total_rides || rides.length;
    const totalIncidents = user?.total_incidents || 0;
    const validCrashes = crashAlerts.filter((a) => a.status !== 'false_alarm');
    const crashCount = validCrashes.length;
    const distressCount = distressAlerts.length;
    const resolved = [...crashAlerts, ...distressAlerts].filter((a) => a.status === 'resolved' || a.status === 'false_alarm').length;
    const safetyScore = Math.max(0, 100 - (crashCount * 10) - (distressCount * 5));
    return { totalDistance, totalRides, totalIncidents, crashCount, distressCount, resolved, safetyScore };
  }, [user, rides, crashAlerts, distressAlerts]);

  const timeline = useMemo(() => {
    const merged = [
      ...crashAlerts.map((a) => ({ ...a, kind: 'crash' })),
      ...distressAlerts.map((a) => ({ ...a, kind: 'distress' })),
    ];
    return merged.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [crashAlerts, distressAlerts]);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt />;

  const scoreColor = stats.safetyScore >= 80 ? 'text-green-500' : stats.safetyScore >= 50 ? 'text-orange-500' : 'text-red-500';

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Safety Dashboard</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center gap-4 rounded-3xl bg-gradient-to-br from-primary/15 to-transparent p-4">
          <div className="relative flex h-20 w-20 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" className="text-secondary" />
              <circle cx="40" cy="40" r="34" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(stats.safetyScore / 100) * 213.6} 213.6`} className={scoreColor} />
            </svg>
            <span className={`text-xl font-black ${scoreColor}`}>{stats.safetyScore}</span>
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold">Riding Safety Score</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {stats.safetyScore >= 80 ? 'Excellent — keep it up.' : stats.safetyScore >= 50 ? 'Fair — review your safety habits.' : 'Needs attention — ride defensively.'}
            </p>
          </div>
          <Shield size={28} className="shrink-0 text-primary" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <StatCard icon={RouteIcon} label="Total Distance" value={`${stats.totalDistance.toLocaleString()} km`} />
          <StatCard icon={BikeIcon} label="Total Rides" value={stats.totalRides} />
          <StatCard icon={AlertTriangle} label="Crash Alerts" value={stats.crashCount} accent="text-red-500" />
          <StatCard icon={Siren} label="Distress Alerts" value={stats.distressCount} accent="text-orange-500" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Incidents logged</p>
            <p className="text-lg font-black">{stats.totalIncidents}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground">Resolved alerts</p>
            <p className="text-lg font-black text-green-500">{stats.resolved}</p>
          </div>
        </div>

        <div>
          <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
            <TrendingUp size={16} /> Alert History
          </h3>
          {timeline.length === 0 ? (
            <div className="rounded-3xl border border-border bg-card p-8 text-center">
              <Shield size={40} className="mx-auto text-green-500" />
              <p className="mt-3 text-sm text-muted-foreground">No safety alerts triggered. Ride safe!</p>
            </div>
          ) : (
            <div className="space-y-2">
              {timeline.map((a) => (
                <div key={`${a.kind}-${a.id}`} className="rounded-2xl border border-border bg-card p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full ${a.kind === 'crash' ? 'bg-red-500/15' : 'bg-orange-500/15'}`}>
                        {a.kind === 'crash' ? <AlertTriangle size={16} className="text-red-500" /> : <Siren size={16} className="text-orange-500" />}
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{a.kind === 'crash' ? 'Crash Alert' : 'Distress Alert'}</p>
                        <p className="text-xs text-muted-foreground">{fmtDateTime(a.timestamp)}</p>
                      </div>
                    </div>
                    <Badge variant={a.status === 'resolved' || a.status === 'false_alarm' ? 'secondary' : 'destructive'} className="text-[10px] capitalize">
                      {a.status?.replace('_', ' ')}
                    </Badge>
                  </div>
                  {(a.lat != null || a.last_lat != null) && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Location: {(a.last_lat ?? a.lat)?.toFixed(4)}, {(a.last_lng ?? a.lng)?.toFixed(4)}
                      {a.speed_at_impact != null && ` · Impact speed: ${Math.round(a.speed_at_impact)} km/h`}
                    </p>
                  )}
                  {a.reason && <p className="mt-1 text-sm text-foreground/90">{a.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        <Button variant="secondary" className="flex min-h-[48px] w-full items-center justify-center gap-2" onClick={() => navigate('/safety-guidelines')}>
          <Shield size={18} /> Read Safety Guidelines
        </Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent = 'text-primary' }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Icon size={20} className={accent} />
      <div className="min-w-0">
        <p className="truncate text-lg font-black">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}