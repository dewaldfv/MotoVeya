import { Battery, Satellite, Crown, Shield, Gauge } from 'lucide-react';
import RiderAvatar from '@/components/community/RiderAvatar';
import { RIDING_STATUS } from '@/lib/groupRide';

export default function RiderStatusCard({ p, isSelf, onAction }) {
  const rs = RIDING_STATUS[p.riding_status] || RIDING_STATUS.stopped;
  const batteryColor = p.battery_level == null ? 'text-muted-foreground' : p.battery_level <= 15 ? 'text-destructive' : p.battery_level <= 30 ? 'text-amber-500' : 'text-emerald-500';
  const gpsColor = p.gps_status === 'lost' ? 'text-destructive' : p.gps_status === 'weak' ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className={`w-64 shrink-0 rounded-2xl bg-card p-3 shadow-sm ${isSelf ? 'ring-2 ring-primary' : ''}`}>
      <div className="flex items-center gap-2">
        <div className="relative">
          <RiderAvatar src={p.avatar_url} name={p.user_name} size={40} />
          {p.role === 'leader' && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[8px]">👑</span>}
          {p.role === 'sweep' && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-slate-600 text-[8px]">🛡️</span>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{p.user_name}{isSelf && ' (You)'}</p>
          <p className="truncate text-[11px] text-muted-foreground">{p.bike_make} {p.bike_model || ''}</p>
        </div>
        <span className={`flex items-center gap-1 text-[10px] font-medium ${rs.color}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${rs.dot}`} /> {rs.label}
        </span>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
        <div className="rounded-lg bg-secondary/50 py-1">
          <p className="text-xs font-bold">{Math.round(p.speed_kmh || 0)}</p>
          <p className="text-[9px] text-muted-foreground">km/h</p>
        </div>
        <div className="rounded-lg bg-secondary/50 py-1">
          <p className="text-xs font-bold">{p.distance_from_leader_km != null ? p.distance_from_leader_km : '—'}</p>
          <p className="text-[9px] text-muted-foreground">km to lead</p>
        </div>
        <div className="rounded-lg bg-secondary/50 py-1">
          <p className="text-xs font-bold">{p.distance_km != null ? Math.round(p.distance_km) : 0}</p>
          <p className="text-[9px] text-muted-foreground">ridden</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px]">
        <span className={`flex items-center gap-1 ${batteryColor}`}><Battery size={12} /> {p.battery_level != null ? `${p.battery_level}%` : '—'}</span>
        <span className={`flex items-center gap-1 ${gpsColor}`}><Satellite size={12} /> {p.gps_status || 'good'}</span>
      </div>

      {onAction && (
        <button onClick={onAction} className="mt-2 w-full rounded-lg bg-secondary py-1.5 text-[11px] font-medium">Manage</button>
      )}
    </div>
  );
}