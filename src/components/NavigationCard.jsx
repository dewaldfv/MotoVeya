import { Clock, Route as RouteIcon } from 'lucide-react';
import { getManeuverIcon, formatDistance, formatDuration } from '@/lib/navigation';

export default function NavigationCard({ step, distanceToManeuver, remainingDistance, remainingDuration, destinationName }) {
  if (!step) return null;
  const Icon = getManeuverIcon(step.maneuver);
  const eta = new Date(Date.now() + (remainingDuration || 0) * 1000);
  const etaStr = eta.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });
  const isArrive = step.maneuver?.type === 'arrive';
  const streetName = step.name || destinationName || (isArrive ? 'Destination' : 'Continue');

  return (
    <div
      className="absolute left-3 right-3 z-20 rounded-2xl bg-card/95 p-3 shadow-xl backdrop-blur-lg landscape:max-w-md"
      style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
          <Icon size={26} className="text-primary" strokeWidth={2.5} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xl font-black leading-tight">{formatDistance(distanceToManeuver)}</div>
          <div className="truncate text-sm font-medium text-muted-foreground">{streetName}</div>
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><Clock size={12} /> {etaStr}</span>
        <span className="flex items-center gap-1"><RouteIcon size={12} /> {formatDistance(remainingDistance)}</span>
        <span className="flex items-center gap-1"><Clock size={12} /> {formatDuration(remainingDuration)}</span>
      </div>
    </div>
  );
}