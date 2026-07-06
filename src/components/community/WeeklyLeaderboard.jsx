import { useState } from 'react';
import { Trophy, Route, Clock, Calendar, Flame } from 'lucide-react';
import RiderAvatar from './RiderAvatar';

const METRICS = [
  { key: 'distance', label: 'Distance', icon: Route, get: (r) => r?.weekly?.distance_km || 0, fmt: (v) => `${Math.round(v)} km` },
  { key: 'time', label: 'Ride Time', icon: Clock, get: (r) => r?.weekly?.ride_time_min || 0, fmt: (v) => (v >= 60 ? `${Math.floor(v / 60)}h ${v % 60}m` : `${v}m`) },
  { key: 'events', label: 'Events', icon: Calendar, get: (r) => r?.events_count || 0, fmt: (v) => `${v}` },
  { key: 'streak', label: 'Streak', icon: Flame, get: (r) => r?.streak || 0, fmt: (v) => `${v}d` },
];

export default function WeeklyLeaderboard({ riders = [], onSelect }) {
  const [metric, setMetric] = useState('distance');
  const active = METRICS.find((m) => m.key === metric);
  const sorted = [...riders].sort((a, b) => active.get(b) - active.get(a)).slice(0, 10);
  const nameOf = (r) => r?.nickname || r?.full_name || 'Rider';
  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div className="rounded-3xl bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Trophy size={18} className="text-primary" />
        <h3 className="font-bold">Weekly Leaderboard</h3>
      </div>
      <div className="mb-3 flex gap-1.5 overflow-x-auto no-scrollbar">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${metric === m.key ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}
          >
            <m.icon size={12} /> {m.label}
          </button>
        ))}
      </div>
      <div className="space-y-2">
        {sorted.map((r, i) => (
          <button key={r.user_id} onClick={() => onSelect(r)} className="flex w-full items-center gap-3 rounded-2xl bg-secondary/40 p-2 text-left active:scale-[0.98]">
            <span className="w-5 text-center text-sm font-black">{i < 3 ? medals[i] : i + 1}</span>
            <RiderAvatar src={r.avatar_url} name={nameOf(r)} size={32} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{nameOf(r)}</span>
            <span className="text-sm font-bold text-primary">{active.fmt(active.get(r))}</span>
          </button>
        ))}
        {sorted.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">No activity yet this week</p>}
      </div>
    </div>
  );
}