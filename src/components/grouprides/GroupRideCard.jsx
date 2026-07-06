import { motion } from 'framer-motion';
import { Users, MapPin, Navigation, Clock, Fuel, Coffee, CloudRain, ChevronRight } from 'lucide-react';
import { RIDE_STATUS, haversine, formatDuration } from '@/lib/groupRide';

export default function GroupRideCard({ ride, participantCount = 0, userPos, index = 0, onOpen }) {
  const status = RIDE_STATUS[ride.status] || RIDE_STATUS.planning;
  const distRemaining = userPos && ride.destination_lat != null
    ? Math.round(haversine(userPos[0], userPos[1], ride.destination_lat, ride.destination_lng) * 10) / 10
    : ride.distance_remaining_km;
  const eta = distRemaining != null && distRemaining > 0 ? Math.max(1, Math.round(distRemaining / 0.6)) : null;

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3) }}
      onClick={onOpen}
      className="w-full rounded-3xl bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-2xl">{ride.icon || '🏍️'}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-bold">{ride.title}</h3>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${status.color}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dot}`} /> {status.label}
            </span>
          </div>
          {ride.group_name && <p className="truncate text-xs text-muted-foreground">{ride.group_name}</p>}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground"><Users size={13} className="text-primary" /> {participantCount} rider{participantCount !== 1 ? 's' : ''}</div>
        {ride.destination_name && <div className="flex items-center gap-1.5 text-muted-foreground"><MapPin size={13} className="text-primary" /> <span className="truncate">{ride.destination_name}</span></div>}
        {distRemaining != null && ride.status !== 'finished' && <div className="flex items-center gap-1.5 text-muted-foreground"><Navigation size={13} className="text-primary" /> {distRemaining} km left</div>}
        {eta != null && ride.status === 'riding' && <div className="flex items-center gap-1.5 text-muted-foreground"><Clock size={13} className="text-primary" /> {formatDuration(eta)}</div>}
        {ride.fuel_stop_name && <div className="flex items-center gap-1.5 text-muted-foreground"><Fuel size={13} className="text-amber-500" /> <span className="truncate">{ride.fuel_stop_name}</span></div>}
        {ride.rest_stop_name && <div className="flex items-center gap-1.5 text-muted-foreground"><Coffee size={13} className="text-blue-500" /> <span className="truncate">{ride.rest_stop_name}</span></div>}
        {ride.weather && <div className="flex items-center gap-1.5 text-muted-foreground"><CloudRain size={13} className="text-primary" /> <span className="truncate">{ride.weather}</span></div>}
      </div>

      <div className="mt-3 flex items-center justify-end text-xs font-medium text-primary">
        {ride.status === 'finished' ? 'View summary' : 'Open ride'} <ChevronRight size={14} />
      </div>
    </motion.button>
  );
}