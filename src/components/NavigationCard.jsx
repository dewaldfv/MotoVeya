import { ChevronRight } from 'lucide-react';
import { getManeuverIcon, formatDistance } from '@/lib/navigation';

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
    <div className="motoveya-nav-card">
      <div className="motoveya-nav-card__main">
        <div className={`motoveya-nav-icon ${rideMode ? 'motoveya-nav-icon--large' : ''}`}>
          <Icon size={rideMode ? 34 : 30} strokeWidth={2.7} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="motoveya-nav-distance">{formatDistance(distanceToManeuver)}</div>
          <div className="truncate text-[13px] font-bold text-white/90">{streetName}</div>
        </div>
        <div className="motoveya-nav-eta">
          <span>{etaStr}</span>
          <span>{formatDistance(remainingDistance)}</span>
        </div>
      </div>
      {NextIcon && (
        <div className="motoveya-nav-next">
          <NextIcon size={16} strokeWidth={2.6} />
          <span className="truncate">Then {nextStreet || 'continue'}</span>
          <ChevronRight size={14} className="ml-auto shrink-0 text-white/35" />
        </div>
      )}
      <div className="motoveya-nav-progress">
        <span />
      </div>
    </div>
  );
}