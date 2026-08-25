import { ChevronDown, ChevronUp, Compass, Fuel, Gauge, MapPin, Route as Road } from 'lucide-react';
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
}) {
  const overLimit = speedLimit != null && speed > speedLimit;
  const moving = speed >= 20;

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

        <div className="motoveya-ride-hud__main">
          <div className="motoveya-speed-block">
            <Gauge size={16} className={overLimit ? 'text-red-400' : 'text-[#ff7800]'} />
            <span className={`motoveya-speed-value ${overLimit ? 'text-red-400' : ''}`}>{Math.round(speed)}</span>
            <span className="motoveya-speed-unit">KM/H</span>
          </div>

          <div className="motoveya-road-block">
            <div className="flex items-center gap-1.5 text-white/45">
              <Road size={12} />
              <span className="text-[9px] font-bold uppercase tracking-[0.18em]">{recalculating ? 'Route' : 'Road'}</span>
            </div>
            <div className="truncate text-sm font-bold text-white">{recalculating ? 'Recalculating…' : (roadName || 'Ride')}</div>
            <div className="mt-1 flex items-center gap-2 text-[9px] font-semibold text-white/45">
              <span>{headingToCompass(heading)} {heading != null && !isNaN(heading) ? `${Math.round(((heading % 360) + 360) % 360)}°` : ''}</span>
              {speedLimit != null && <span className={overLimit ? 'text-red-400' : ''}>LIMIT {speedLimit}</span>}
            </div>
          </div>

          <div className="motoveya-range-block">
            <Fuel size={14} className={fuelRange != null && fuelRange < 50 ? 'text-red-400' : 'text-[#ff7800]'} />
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-white/45">Range</span>
            <strong>{fuelRange != null ? fuelRange : '—'}</strong>
            <span className="text-[8px] font-semibold text-white/40">KM</span>
          </div>
        </div>

        <div className="motoveya-ride-hud__status">
          <span className={`motoveya-status-dot ${moving ? 'motoveya-status-dot--moving' : ''}`} />
          <span>{moving ? 'RIDING' : 'READY'}</span>
          {gpsWeak && <span className="text-amber-300">GPS WEAK</span>}
          {overLimit && <span className="text-red-400">OVER LIMIT</span>}
          {fuelRemaining != null && expanded && <span className="ml-auto">FUEL {fuelRemaining}</span>}
        </div>

        {expanded && (
          <div className="motoveya-ride-hud__details">
            <div><Compass size={13} /><span>HEADING</span><strong>{headingToCompass(heading)}</strong></div>
            <div><MapPin size={13} /><span>ROAD</span><strong className="truncate">{roadName || '—'}</strong></div>
            <div><Fuel size={13} /><span>RANGE</span><strong>{fuelRange != null ? `${fuelRange} km` : '—'}</strong></div>
          </div>
        )}
      </div>
    </div>
  );
}
