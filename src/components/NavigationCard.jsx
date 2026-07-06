import { Clock, Route as RouteIcon, ChevronRight } from 'lucide-react';
import { getManeuverIcon, formatDistance, formatDuration } from '@/lib/navigation';

export default function NavigationCard({ step, followingStep = null, distanceToManeuver, remainingDistance, remainingDuration, destinationName, rideMode = false }) {
  if (!step) return null;
  const Icon = getManeuverIcon(step.maneuver);
  const NextIcon = followingStep ? getManeuverIcon(followingStep.maneuver) : null;
  const eta = new Date(Date.now() + (remainingDuration || 0) * 1000);
  const etaStr = eta.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  const isArrive = step.maneuver?.type === 'arrive';
  const streetName = step.name || destinationName || (isArrive ? 'Destination' : 'Continue');
  const nextStreet = followingStep?.name || (followingStep?.maneuver?.type === 'arrive' ? 'Destination' : '');

  return (
    <div
      className="absolute left-3 right-3 z-20 overflow-hidden rounded-3xl bg-card/97 shadow-2xl backdrop-blur-lg landscape:max-w-md"
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3 p-3">
        <div className={`flex shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground ${rideMode ? 'h-16 w-16' : 'h-14 w-14'}`}>
          <Icon size={rideMode ? 38 : 32} strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className={`font-black leading-none ${rideMode ? 'text-3xl' : 'text-2xl'}`}>{formatDistance(distanceToManeuver)}</div>
          <div className="mt-1 truncate text-sm font-semibold text-foreground">{streetName}</div>
        </div>
      </div>
      {NextIcon && (
        <div className="flex items-center gap-2 border-t border-border bg-muted/40 px-3 py-2">
          <NextIcon size={18} className="shrink-0 text-muted-foreground" strokeWidth={2.5} />
          <span className="truncate text-xs font-medium text-muted-foreground">Then {nextStreet || 'continue'}</span>
          <ChevronRight size={14} className="ml-auto shrink-0 text-muted-foreground" />
        </div>
      )}
      <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs font-semibold">
        <span className="flex items-center gap-1.5"><Clock size={13} className="text-primary" /> {etaStr}</span>
        <span className="flex items-center gap-1.5"><RouteIcon size={13} className="text-primary" /> {formatDistance(remainingDistance)}</span>
        <span className="flex items-center gap-1.5"><Clock size={13} className="text-primary" /> {formatDuration(remainingDuration)}</span>
      </div>
    </div>
  );
}