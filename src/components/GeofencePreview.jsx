import { MapPin, LogIn, LogOut, Shield } from 'lucide-react';

/**
 * A visual demonstration of how the geofence will look once saved.
 * Shows a stylized map preview with the pin and radius ring,
 * plus example entry/exit alert cards reflecting current form values.
 */
export default function GeofencePreview({ name, radius, enter, exit, groupNames = [], active = true }) {
  const displayName = name.trim() || 'Unnamed Place';
  const scope = groupNames.length > 0 ? groupNames.slice(0, 2).join(', ') + (groupNames.length > 2 ? ' +more' : '') : 'No group';
  // Scale radius to a visual ring size (5m → small, 100m → large), capped for the preview box
  const ringPct = Math.min(46, 14 + (radius / 100) * 32);

  return (
    <div className="mt-4 rounded-2xl border border-primary/15 bg-muted/30 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Shield size={13} className="text-primary" /> Preview
      </div>

      {/* Stylized map preview */}
      <div className="relative h-32 overflow-hidden rounded-xl bg-gradient-to-b from-emerald-50 to-emerald-100 dark:from-emerald-950/40 dark:to-emerald-900/30">
        {/* grid lines for map feel */}
        <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(0,0,0,.08) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
        {/* faux roads */}
        <div className="absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rotate-12 bg-white/60 dark:bg-white/10" />
        <div className="absolute bottom-0 left-1/3 top-0 w-1 bg-white/60 dark:bg-white/10" />
        {/* radius ring */}
        {active && (
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-primary/40 bg-primary/10"
            style={{ width: `${ringPct * 2}%`, aspectRatio: '1' }}
          />
        )}
        {/* center pin */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <div className="relative flex h-7 w-7 items-center justify-center">
            <div className="absolute h-7 w-7 animate-ping rounded-full bg-primary/20" style={{ animationDuration: '2s' }} />
            <div className="relative flex h-6 w-6 items-center justify-center rounded-full rounded-bl-none bg-primary shadow-lg" style={{ transform: 'rotate(-45deg)' }}>
              <MapPin size={12} className="text-primary-foreground" style={{ transform: 'rotate(45deg)' }} />
            </div>
          </div>
        </div>
        {/* place label */}
        <div className="absolute bottom-1.5 left-1.5 right-1.5 truncate rounded-md bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          {displayName} · {radius}m
        </div>
        {!active && (
          <div className="absolute right-1.5 top-1.5 rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-muted-foreground">Paused</div>
        )}
      </div>

      {/* Alert previews */}
      <p className="mb-2 mt-3 text-xs font-medium text-muted-foreground">When saved, riders will see alerts like:</p>
      <div className="space-y-2">
        <AlertCard
          icon={<LogIn size={14} />}
          enabled={enter && active}
          tone="enter"
          title={`${displayName} — arrival`}
          body={`You entered the ${radius}m zone at ${displayName}.`}
          scope={scope}
        />
        <AlertCard
          icon={<LogOut size={14} />}
          enabled={exit && active}
          tone="exit"
          title={`${displayName} — departure`}
          body={`You left the ${radius}m zone at ${displayName}.`}
          scope={scope}
        />
      </div>
      {!enter && !exit && (
        <p className="mt-2 text-center text-[11px] text-muted-foreground">No alerts — enable entry or exit notifications above.</p>
      )}
    </div>
  );
}

function AlertCard({ icon, enabled, tone, title, body, scope }) {
  const toneClass = enabled
    ? tone === 'enter'
      ? 'border-emerald-500/30 bg-emerald-500/5'
      : 'border-amber-500/30 bg-amber-500/5'
    : 'border-border bg-muted/20 opacity-50';
  const iconClass = enabled
    ? tone === 'enter'
      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
      : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
    : 'bg-muted text-muted-foreground';
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border p-2.5 ${toneClass}`}>
      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold">{title}</p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{enabled ? body : 'Disabled'}</p>
        {enabled && <p className="mt-0.5 text-[10px] font-medium text-muted-foreground/70">→ {scope}</p>}
      </div>
      {enabled && <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-emerald-500" />}
    </div>
  );
}