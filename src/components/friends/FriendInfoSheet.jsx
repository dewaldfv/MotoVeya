import { useNavigate } from 'react-router-dom';
import { Phone, Navigation, Activity, Battery, Clock, Gauge, AlertTriangle, MapPin } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import RiderAvatar from '@/components/community/RiderAvatar';

const STATUS_CONFIG = {
  active: { label: 'Active & Moving', className: 'bg-blue-500 text-white' },
  inactive: { label: 'Stationary', className: 'bg-gray-600 text-white' },
  distress: { label: 'In Distress', className: 'bg-red-500 text-white' },
};

const STATIONARY_SPEED = 5;
const ACTIVE_WINDOW_MS = 2 * 60 * 1000;

function computeStatus(f) {
  if (f?.is_distress) return 'distress';
  const speed = f?.speed_kmh || 0;
  const ageMs = f?.last_updated ? Date.now() - new Date(f.last_updated).getTime() : Infinity;
  if (speed > STATIONARY_SPEED && ageMs < ACTIVE_WINDOW_MS) return 'active';
  return 'inactive';
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function DetailRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <Icon size={16} className="text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="ml-auto text-sm font-medium">{value}</span>
    </div>
  );
}

export default function FriendInfoSheet({ friend, userPos, onClose, onNavigate }) {
  const navigate = useNavigate();
  const open = !!friend;
  const status = friend ? computeStatus(friend) : 'inactive';
  const config = STATUS_CONFIG[status];
  const distance = open && userPos && friend.lat != null ? haversineKm(userPos[0], userPos[1], friend.lat, friend.lng) : null;
  const name = friend?.name || 'Rider';
  const distLabel = distance == null ? '—' : distance < 1 ? `${Math.round(distance * 1000)} m` : `${distance.toFixed(1)} km`;

  return (
    <BottomSheet open={open} onClose={onClose} title="Friend">
      {friend && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <RiderAvatar src={friend.avatar_url} name={name} size={48} />
            <div className="min-w-0 flex-1">
              <p className="font-bold">{name}</p>
              <Badge className={config.className}>{config.label}</Badge>
            </div>
          </div>

          {status === 'distress' && (
            <div className="flex items-center gap-2 rounded-2xl bg-red-500/10 p-3 text-red-600 dark:text-red-400">
              <AlertTriangle size={20} className="shrink-0" />
              <p className="text-sm font-medium">This rider has triggered a distress alert. Reach out or navigate to them now.</p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl bg-secondary">
            <DetailRow icon={Gauge} label="Speed" value={`${Math.round(friend.speed_kmh || 0)} km/h`} />
            <DetailRow icon={MapPin} label="Distance from you" value={distLabel} />
            <DetailRow icon={Battery} label="Battery" value={friend.battery_level != null ? `${friend.battery_level}%` : '—'} />
            <DetailRow icon={Clock} label="Last updated" value={timeAgo(friend.last_updated)} />
          </div>

          {status === 'distress' && (
            <Button variant="outline" className="min-h-[48px] w-full text-base" onClick={() => { onClose?.(); navigate(`/rider/${friend.user_id}`); }}>
              <Activity size={18} className="mr-2" /> Check Status
            </Button>
          )}

          <div className="flex gap-2 pt-1">
            {status === 'distress' && friend.phone && (
              <Button size="lg" variant="secondary" className="min-h-[56px] flex-1 text-base" onClick={() => window.open(`tel:${friend.phone}`)}>
                <Phone size={18} className="mr-2" /> Call
              </Button>
            )}
            <Button size="lg" className="min-h-[56px] flex-1 text-base" onClick={() => onNavigate?.(friend)}>
              <Navigation size={18} className="mr-2" /> Navigate
            </Button>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}