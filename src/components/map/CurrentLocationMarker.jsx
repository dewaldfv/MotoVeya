import MapLibreCircle from '@/components/MapLibreCircle';
import CustomMapMarker from '@/components/CustomMapMarker';
import useCurrentLocation from '@/hooks/useCurrentLocation';

/**
 * The rider's own position on a map.
 * Keeps the last known fix visible and labels it when it can no longer be
 * trusted (no recent fix, permission lost, or a coarse accuracy radius).
 */
export default function CurrentLocationMarker({
  position: overridePosition = null,
  enabled = true,
  zIndex = 1100,
  showStatus = true,
}) {
  // A screen that already tracks the device itself (an active group ride) can
  // pass its live position instead of starting a second watcher.
  const location = useCurrentLocation({ enabled: enabled && !overridePosition });
  const position = overridePosition || location.position;
  const accuracy = overridePosition ? null : location.accuracy;
  const stale = overridePosition ? false : location.stale;
  const statusLabel = overridePosition ? 'Current location' : location.statusLabel;

  if (!position) return null;

  const dot = stale ? 'bg-slate-400' : 'bg-primary';
  const ring = stale ? 'border-slate-300' : 'border-white';

  return (
    <>
      {accuracy != null && accuracy > 0 && accuracy < 5000 && (
        <MapLibreCircle
          id="current-location-accuracy"
          center={position}
          radius={accuracy}
          strokeColor={stale ? '#94a3b8' : '#3b82f6'}
          strokeOpacity={0.35}
          strokeWeight={1}
          fillColor={stale ? '#94a3b8' : '#3b82f6'}
          fillOpacity={0.14}
        />
      )}
      <CustomMapMarker position={position} zIndex={zIndex}>
        <div className="relative flex flex-col items-center justify-center">
          <span
            className={`block h-4 w-4 rounded-full border-2 ${ring} ${dot} shadow-lg`}
            aria-label={statusLabel}
          />
          {stale && (
            <span className={`absolute left-1/2 top-4 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-[2px] text-[10px] font-semibold shadow-sm ${showStatus ? '' : 'sr-only'}`} style={{ borderColor: 'rgba(148,163,184,0.5)', background: 'rgba(15,23,42,0.85)', color: '#e2e8f0' }}>
              {statusLabel}
            </span>
          )}
        </div>
      </CustomMapMarker>
    </>
  );
}