import { ChevronDown, ChevronUp, ChevronRight, Compass, Fuel, Gauge, MapPin } from 'lucide-react';
import { getManeuverIcon, formatDistance, formatDuration } from '@/lib/navigation';
import { headingToCompass } from './RideHud';

export default function ImmersiveRideHud({
  speed = 0,
  heading = null,
  roadName = null,
  fuelRange = null,
  fuelRemaining = null,
  speedLimit = null,
  expanded = false,
  onToggle,
  gpsWeak = false,
  recalculating = false,
  nextStep = null,
  followingStep = null,
  distanceToManeuver = null,
  remainingDistance = null,
  remainingDuration = 0,
  destinationName = null,
}) {
  const overLimit = speedLimit != null && speed > speedLimit;
  const moving = speed >= 20;
  const NavIcon = nextStep ? getManeuverIcon(nextStep.maneuver) : null;
  const NextIcon = followingStep ? getManeuverIcon(followingStep.maneuver) : null;
  const streetName = nextStep?.name || destinationName || (nextStep?.maneuver?.type === 'arrive' ? 'Destination' : 'Continue');
  const nextStreet = followingStep?.name || (followingStep?.maneuver?.type === 'arrive' ? 'Destination' : '');
  const eta = new Date(Date.now() + (remainingDuration || 0) * 1000);
  const etaStr = eta.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="pointer-events-auto w-[calc(100vw-1.5rem)] max-w-[560px]">
      <div className={`motoveya-ride-hud ${expanded ? 'motoveya-ride-hud--expanded' : ''}`}>
        <button
          onClick={onToggle}
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white/70 backdrop-blur-md transition-colors active:scale-95"
          aria-label={expanded ? 'Collapse ride dashboard' : 'Expand ride dashboard'}
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
        </button>

        <div className="motoveya-ride-hud__main motoveya-nav-hud__main">
          {NavIcon ? (
            <div className="motoveya-nav-icon motoveya-nav-icon--compact">
              <NavIcon size={28} strokeWidth={2.7} />
            </div>
          ) : (
            <div className="motoveya-nav-icon motoveya-nav-icon--compact bg-white/10 text-white/60">{recalculating ? <Gauge size={22} /> : <MapPin size={22} />}</div>
          )}
          <div className="min-w-0 flex-1">
            <div className="motoveya-nav-distance">{recalculating ? '…' : formatDistance(distanceToManeuver)}</div>
            <div className="truncate text-[12px] font-bold text-white/90">{recalculating ? 'Recalculating route…' : streetName}</div>
          </div>
          <div className="motoveya-nav-eta">
            <span>{etaStr}</span>
            <span>{formatDistance(remainingDistance)}</span>
            <span>{formatDuration(remainingDuration)}</span>
          </div>
          <button
            onClick={onToggle}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/5 text-white/55 active:scale-95"
            aria-label={expanded ? 'Hide ride information' : 'Show ride information'}
          >
            {expanded ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>

        {NextIcon && (
          <div className="motoveya-nav-next">
            <NextIcon size={14} strokeWidth={2.6} />
            <span className="truncate">Then {nextStreet || 'continue'}</span>
            <ChevronRight size={13} className="ml-auto shrink-0 text-white/30" />
          </div>
        )}
        <div className="motoveya-nav-progress"><span /></div>

        {expanded && (
          <div className="motoveya-ride-hud__details">
            <div><Gauge size={13} /><span>SPEED</span><strong className={overLimit ? 'text-red-400' : ''}>{Math.round(speed)} km/h</strong></div>
            <div><Compass size={13} /><span>HEADING</span><strong>{headingToCompass(heading)}</strong></div>
            <div><Fuel size={13} /><span>RANGE</span><strong>{fuelRange != null ? `${fuelRange} km` : '—'}</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}
