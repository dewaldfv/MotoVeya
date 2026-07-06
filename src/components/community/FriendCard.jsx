import { motion } from 'framer-motion';
import { MapPin } from 'lucide-react';
import RiderAvatar from './RiderAvatar';
import StatusBadge from './StatusBadge';
import StreakBadge from './StreakBadge';
import MiniActivityChart from './MiniActivityChart';
import RiderQuickActions from './RiderQuickActions';
import { formatDistance, formatDuration, formatRelativeDate, onlineStatus } from '@/lib/riderStats';

export default function FriendCard({ rider, friend, user, index = 0, onOpen, onShowLocation, onNavigate, onInvite }) {
  const name = rider?.nickname || rider?.full_name || (friend?.requester_id === user?.id ? friend?.recipient_name : friend?.requester_name) || 'Rider';
  const status = onlineStatus(rider?.weekly?.last_ride_date);
  const locShared = friend?.location_shared && friend?.last_lat != null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className="rounded-3xl bg-card p-4 shadow-sm"
    >
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <div className="relative">
          <RiderAvatar src={rider?.avatar_url} name={name} size={52} />
          <span className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${status.dot}`} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate font-bold">{name}</p>
            <StreakBadge streak={rider?.streak} />
          </div>
          <StatusBadge status={status} />
          {rider?.bike_make && <p className="truncate text-xs text-muted-foreground">{rider.bike_make} {rider.bike_model || ''}</p>}
        </div>
      </button>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl bg-secondary/60 p-2">
          <p className="text-sm font-black text-primary">{formatDistance(rider?.weekly?.distance_km)}</p>
          <p className="text-[10px] text-muted-foreground">This week</p>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-2">
          <p className="text-sm font-black text-primary">{formatDuration(rider?.weekly?.ride_time_min)}</p>
          <p className="text-[10px] text-muted-foreground">Ride time</p>
        </div>
        <div className="rounded-2xl bg-secondary/60 p-2">
          <p className="text-sm font-black text-primary">{rider?.weekly?.ride_count || 0}</p>
          <p className="text-[10px] text-muted-foreground">Rides</p>
        </div>
      </div>

      <div className="mt-3 rounded-2xl bg-secondary/40 p-2">
        <MiniActivityChart activity={rider?.weekly?.activity} />
      </div>

      <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Last ride: {formatRelativeDate(rider?.weekly?.last_ride_date)}</span>
        {locShared && <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><MapPin size={11} /> Location shared</span>}
      </div>

      <div className="mt-3">
        <RiderQuickActions rider={rider} compact onShowLocation={onShowLocation} onNavigate={onNavigate} onInvite={onInvite} />
      </div>
    </motion.div>
  );
}