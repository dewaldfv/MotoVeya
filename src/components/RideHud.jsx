import { Gauge, Compass, Fuel, Route as Road, Loader2, AlertTriangle } from 'lucide-react';

const COMPASS = [
  { label: 'N', min: 348.75, max: 11.25 },
  { label: 'NNE', min: 11.25, max: 33.75 },
  { label: 'NE', min: 33.75, max: 56.25 },
  { label: 'ENE', min: 56.25, max: 78.75 },
  { label: 'E', min: 78.75, max: 101.25 },
  { label: 'ESE', min: 101.25, max: 123.75 },
  { label: 'SE', min: 123.75, max: 146.25 },
  { label: 'SSE', min: 146.25, max: 168.75 },
  { label: 'S', min: 168.75, max: 191.25 },
  { label: 'SSW', min: 191.25, max: 213.75 },
  { label: 'SW', min: 213.75, max: 236.25 },
  { label: 'WSW', min: 236.25, max: 258.75 },
  { label: 'W', min: 258.75, max: 281.25 },
  { label: 'WNW', min: 281.25, max: 303.75 },
  { label: 'NW', min: 303.75, max: 326.25 },
  { label: 'NNW', min: 326.25, max: 348.75 },
];

export function headingToCompass(deg) {
  if (deg == null || isNaN(deg)) return '—';
  const d = ((deg % 360) + 360) % 360;
  for (const c of COMPASS) {
    if (c.label === 'N') {
      if (d >= c.min || d < c.max) return c.label;
    } else if (d >= c.min && d < c.max) {
      return c.label;
    }
  }
  return '—';
}

export default function RideHud({
  speed = 0,
  heading = null,
  roadName = null,
  fuelRange = null,
  fuelRemaining = null,
  lowFuel = false,
  recalculating = false,
  gpsWeak = false,
  speedLimit = null,
}) {
  const overLimit = speedLimit != null && speed > speedLimit;
  return (
    <div className="flex items-stretch gap-1.5 rounded-2xl bg-card/95 p-1.5 shadow-xl backdrop-blur-lg landscape:max-w-lg">
      {/* Speed */}
      <div className="flex min-w-[88px] flex-col items-center justify-center rounded-xl bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <Gauge size={12} className={overLimit ? 'text-destructive' : 'text-primary'} />
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Speed</span>
        </div>
        <span className={`text-2xl font-black leading-none ${overLimit ? 'text-destructive' : 'text-foreground'}`}>
          {Math.round(speed)}
        </span>
        <span className="text-[8px] font-semibold text-muted-foreground">
          km/h{speedLimit != null ? ` / ${speedLimit}` : ''}
        </span>
      </div>

      {/* Heading */}
      <div className="flex min-w-[72px] flex-col items-center justify-center rounded-xl bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <Compass size={12} className="text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Heading</span>
        </div>
        <span className="text-2xl font-black leading-none text-foreground">{headingToCompass(heading)}</span>
        <span className="text-[8px] font-semibold text-muted-foreground">
          {heading != null && !isNaN(heading) ? `${Math.round(((heading % 360) + 360) % 360)}°` : '—'}
        </span>
      </div>

      {/* Road */}
      <div className="flex min-w-[110px] max-w-[160px] flex-col justify-center rounded-xl bg-muted/40 px-3 py-1.5">
        <div className="flex items-center gap-1">
          <Road size={12} className="text-primary" />
          <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Road</span>
        </div>
        <span className="truncate text-sm font-bold leading-tight text-foreground">
          {recalculating ? 'Recalculating…' : (roadName || '—')}
        </span>
        {recalculating && <Loader2 size={10} className="mt-0.5 animate-spin text-primary" />}
      </div>

      {/* Fuel */}
      {fuelRange !== null && (
        <div className={`flex min-w-[72px] flex-col items-center justify-center rounded-xl px-3 py-1.5 ${lowFuel ? 'bg-destructive/15' : 'bg-muted/40'}`}>
          <div className="flex items-center gap-1">
            <Fuel size={12} className={lowFuel ? 'text-destructive' : 'text-primary'} />
            <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Range</span>
          </div>
          <span className={`text-2xl font-black leading-none ${lowFuel ? 'text-destructive' : 'text-foreground'}`}>
            {fuelRange}
          </span>
          <span className="text-[8px] font-semibold text-muted-foreground">km</span>
        </div>
      )}

      {/* Status badges */}
      {(gpsWeak || overLimit || recalculating) && (
        <div className="flex flex-col items-center justify-center gap-1">
          {recalculating && (
            <span className="flex items-center gap-1 rounded-full bg-primary/20 px-2 py-0.5 text-[9px] font-bold text-primary">
              <Loader2 size={9} className="animate-spin" /> Recalc
            </span>
          )}
          {gpsWeak && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-white">
              GPS Weak
            </span>
          )}
          {overLimit && (
            <span className="flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[9px] font-bold text-white">
              <AlertTriangle size={9} /> Over
            </span>
          )}
        </div>
      )}
    </div>
  );
}