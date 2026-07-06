import { Route, Clock, Gauge, Fuel, Camera, CloudRain, Trophy, Users } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import RiderAvatar from '@/components/community/RiderAvatar';
import { formatDuration } from '@/lib/groupRide';

function Stat({ icon: Icon, value, label }) {
  return (
    <div className="rounded-2xl bg-secondary/50 p-3 text-center">
      <Icon size={18} className="mx-auto mb-1 text-primary" />
      <p className="text-lg font-black">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

export default function RideSummarySheet({ open, onClose, ride, summary }) {
  if (!summary) return null;
  const s = typeof summary === 'string' ? JSON.parse(summary) : summary;
  return (
    <BottomSheet open={open} onClose={onClose} title="Ride Summary">
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 p-4 text-center">
          <Trophy size={28} className="mx-auto mb-1 text-primary" />
          <p className="font-black">{ride?.title}</p>
          <p className="text-xs text-muted-foreground">{ride?.group_name}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Stat icon={Route} value={`${s.distance_km} km`} label="Distance" />
          <Stat icon={Clock} value={formatDuration(s.duration_minutes)} label="Duration" />
          <Stat icon={Gauge} value={`${s.average_speed_kmh} km/h`} label="Avg speed" />
          <Stat icon={Gauge} value={`${s.max_speed_kmh} km/h`} label="Max speed" />
        </div>

        {s.weather && (
          <div className="flex items-center gap-2 rounded-2xl bg-secondary/50 p-3 text-sm">
            <CloudRain size={16} className="text-primary" /> {s.weather}
          </div>
        )}

        {s.achievements?.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-semibold text-muted-foreground">Achievements</p>
            <div className="grid grid-cols-3 gap-2">
              {s.achievements.map((a, i) => (
                <div key={i} className="rounded-2xl bg-secondary/50 p-2 text-center">
                  <div className="text-2xl">{a.emoji}</div>
                  <p className="text-[10px] font-bold">{a.label}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Users size={12} /> Attendance ({s.attendance?.length || 0})</p>
          <div className="space-y-1.5">
            {(s.attendance || []).map((a) => (
              <div key={a.user_id} className="flex items-center gap-2 rounded-2xl bg-secondary/50 p-2">
                <RiderAvatar name={a.name} size={28} />
                <span className="flex-1 text-sm font-medium">{a.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{a.role}</span>
                <span className="text-xs font-bold text-primary">{Math.round(a.distance_km)} km</span>
              </div>
            ))}
          </div>
        </div>

        {s.photos?.length > 0 && (
          <div>
            <p className="mb-2 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Camera size={12} /> Photos ({s.photos.length})</p>
            <div className="grid grid-cols-3 gap-2">
              {s.photos.map((url, i) => (
                <div key={i} className="aspect-square overflow-hidden rounded-xl">
                  <img src={url} alt="Ride" className="h-full w-full object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </BottomSheet>
  );
}