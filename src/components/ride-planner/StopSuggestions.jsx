import { useState, useEffect, useRef } from 'react';
import { Fuel, UtensilsCrossed, Plus, MapPin, Loader2, CheckCircle2, Navigation } from 'lucide-react';
import { useBikeRange, suggestStopPoints, findNearbyStops } from '@/lib/stopSuggestions';

export default function StopSuggestions({ waypoints = [], routeData = null, onAddStop, onSuggestChange }) {
  const { safeRange, rangeKm } = useBikeRange();
  const [results, setResults] = useState({}); // { [stopKey]: { loading, candidates, error } }
  const [added, setAdded] = useState(new Set());
  const onSuggestChangeRef = useRef(onSuggestChange);
  onSuggestChangeRef.current = onSuggestChange;

  const stopPoints = suggestStopPoints(waypoints, safeRange, routeData);

  // Lift the recommended stop points up so the map can render them.
  useEffect(() => {
    onSuggestChangeRef.current?.(stopPoints);
  }, [JSON.stringify(stopPoints)]);

  // Fetch nearby candidates for each stop point (debounced).
  useEffect(() => {
    if (!stopPoints.length) { setResults({}); return; }
    let cancelled = false;
    setResults((prev) => {
      const next = {};
      stopPoints.forEach((sp) => {
        next[sp.key] = prev[sp.key] || { loading: true, candidates: [], error: null };
      });
      return next;
    });
    const t = setTimeout(async () => {
      const entries = await Promise.all(
        stopPoints.map(async (sp) => {
          try {
            const candidates = await findNearbyStops(sp, sp.type);
            return [sp.key, { loading: false, candidates, error: null }];
          } catch (e) {
            return [sp.key, { loading: false, candidates: [], error: 'Could not load nearby stops' }];
          }
        })
      );
      if (!cancelled) {
        setResults((prev) => {
          const next = { ...prev };
          entries.forEach(([k, v]) => { next[k] = v; });
          return next;
        });
      }
    }, 500);
    return () => { cancelled = true; clearTimeout(t); };
  }, [JSON.stringify(stopPoints)]);

  const handleAdd = (sp, candidate) => {
    onAddStop?.(
      { name: candidate.name, lat: candidate.lat, lng: candidate.lng },
      sp.legIndex
    );
    setAdded((prev) => new Set(prev).add(`${sp.key}-${candidate.id}`));
  };

  if (!rangeKm || waypoints.length < 2) return null;
  if (stopPoints.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Fuel size={16} className="text-primary" /> Stop suggestions
        </div>
        <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
          Your route is within a comfortable range — no fuel or pub stops required.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 px-1 text-sm font-bold">
        <Fuel size={16} className="text-primary" /> Suggested stops along your route
      </div>
      {stopPoints.map((sp) => {
        const res = results[sp.key] || { loading: true, candidates: [], error: null };
        const Icon = sp.type === 'fuel' ? Fuel : UtensilsCrossed;
        const accent = sp.type === 'fuel' ? 'text-amber-500' : 'text-violet-500';
        return (
          <div key={sp.key} className="rounded-2xl border border-border bg-card p-4">
            <div className="flex items-start gap-2">
              <Icon size={18} className={`mt-0.5 shrink-0 ${accent}`} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-snug">{sp.reason}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={11} /> Near {sp.lat.toFixed(3)}, {sp.lng.toFixed(3)} — verify on the map above
                </p>
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {res.loading && (
                <div className="flex items-center gap-2 rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" /> Searching nearby {sp.type === 'fuel' ? 'fuel stations' : 'pubs & cafés'}…
                </div>
              )}
              {!res.loading && res.error && (
                <p className="rounded-xl bg-destructive/10 p-2.5 text-xs text-destructive">{res.error}</p>
              )}
              {!res.loading && !res.error && res.candidates.length === 0 && (
                <p className="rounded-xl bg-muted/50 p-2.5 text-xs text-muted-foreground">
                  No {sp.type === 'fuel' ? 'fuel stations' : 'eateries'} found nearby. Add a custom waypoint instead.
                </p>
              )}
              {!res.loading && res.candidates.map((c) => {
                const isAdded = added.has(`${sp.key}-${c.id}`);
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-xl border border-border bg-background/40 p-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="flex items-center gap-1 text-xs text-muted-foreground capitalize">
                        <Navigation size={10} /> {c.amenity || (sp.type === 'fuel' ? 'fuel' : 'food')} · {Math.round(c.distKm)} km off-route
                      </p>
                    </div>
                    <button
                      onClick={() => handleAdd(sp, c)}
                      disabled={isAdded}
                      className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-60"
                    >
                      {isAdded ? <CheckCircle2 size={14} /> : <Plus size={14} />}
                      {isAdded ? 'Added' : 'Add'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}