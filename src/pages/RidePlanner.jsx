import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2, ArrowUp, ArrowDown, Save, Navigation, Loader2, Calendar, CloudSun } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LocationSearchInput from '@/components/rides/LocationSearchInput';
import RidePlannerMap from '@/components/ride-planner/RidePlannerMap';
import WeatherCard from '@/components/ride-planner/WeatherCard';
import RangeWarning from '@/components/ride-planner/RangeWarning';
import StopSuggestions from '@/components/ride-planner/StopSuggestions';
import { savePendingNavigation } from '@/lib/rideCache';
import { getRouteWeather } from '@/lib/weather';
import { toast } from 'sonner';

const STORAGE_KEY = 'motogo_ride_plan_draft';

export default function RidePlanner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [suggestedStops, setSuggestedStops] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle | saving | saved | error
  const lastSavedSnapshot = useRef('');

  const planSnapshot = useMemo(
    () => JSON.stringify({ title, notes, plannedDate, waypoints }),
    [title, notes, plannedDate, waypoints]
  );

  const buildPayload = useCallback(() => ({
    title: title.trim(),
    waypoints: JSON.stringify(waypoints),
    notes: notes.trim(),
    planned_date: plannedDate ? new Date(plannedDate).toISOString() : undefined,
    weather: weather ? JSON.stringify(weather) : undefined,
  }), [title, waypoints, notes, plannedDate, weather]);

  const autoSave = useCallback(async (createIfMissing) => {
    if (!title.trim() || waypoints.length < 2) return;
    setAutoSaveStatus('saving');
    try {
      let id = currentPlanId;
      if (id) {
        await base44.entities.RidePlan.update(id, buildPayload());
      } else if (createIfMissing) {
        const plan = await base44.entities.RidePlan.create(buildPayload());
        id = plan.id;
        setCurrentPlanId(id);
      } else {
        setAutoSaveStatus('idle');
        return;
      }
      lastSavedSnapshot.current = planSnapshot;
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['ride-plans'] });
    } catch (e) {
      console.error(e);
      setAutoSaveStatus('error');
    }
  }, [title, waypoints, currentPlanId, planSnapshot, buildPayload, queryClient]);

  // Debounced auto-save while building the trip
  useEffect(() => {
    if (planSnapshot === lastSavedSnapshot.current) return;
    if (!title.trim() || waypoints.length < 2) return;
    setAutoSaveStatus('saving');
    const t = setTimeout(() => { autoSave(true); }, 6000);
    return () => clearTimeout(t);
  }, [planSnapshot, autoSave]);

  // Flush pending changes when the tab is hidden / user navigates away
  useEffect(() => {
    const onHide = () => { if (document.visibilityState === 'hidden') autoSave(false); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [autoSave]);

  // Load from shared link or local draft
  useEffect(() => {
    (async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const loadId = params.get('load');
        if (loadId) {
          const plan = await base44.entities.RidePlan.get(loadId);
          if (plan) {
            const wp = JSON.parse(plan.waypoints || '[]');
            setTitle(plan.title || '');
            setNotes(plan.notes || '');
            setPlannedDate(plan.planned_date ? plan.planned_date.slice(0, 10) : '');
            setWaypoints(wp);
            setCurrentPlanId(plan.id);
            lastSavedSnapshot.current = JSON.stringify({ title: plan.title || '', notes: plan.notes || '', plannedDate: plan.planned_date ? plan.planned_date.slice(0, 10) : '', waypoints: wp });
            setAutoSaveStatus('idle');
            toast.success('Shared route loaded — edits auto-save');
            window.history.replaceState({}, '', '/ride-planner');
            return;
          }
        }
      } catch (e) { /* ignore */ }
      try {
        const draft = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
        if (draft) {
          setTitle(draft.title || '');
          setNotes(draft.notes || '');
          setPlannedDate(draft.plannedDate || '');
          setWaypoints(Array.isArray(draft.waypoints) ? draft.waypoints : []);
          lastSavedSnapshot.current = JSON.stringify({ title: draft.title || '', notes: draft.notes || '', plannedDate: draft.plannedDate || '', waypoints: Array.isArray(draft.waypoints) ? draft.waypoints : [] });
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Persist draft locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, notes, plannedDate, waypoints }));
  }, [title, notes, plannedDate, waypoints]);

  // Fetch weather whenever waypoints or date change (debounced)
  const weatherKey = useMemo(
    () => `${plannedDate}|${waypoints.map((w) => `${w.lat},${w.lng}`).join('|')}`,
    [plannedDate, waypoints]
  );
  useEffect(() => {
    if (waypoints.length === 0) { setWeather(null); return; }
    let cancelled = false;
    setWeatherLoading(true);
    const t = setTimeout(async () => {
      try {
        const w = await getRouteWeather(waypoints, plannedDate);
        if (!cancelled) setWeather(w);
      } catch (e) { /* ignore */ } finally {
        if (!cancelled) setWeatherLoading(false);
      }
    }, 700);
    return () => { cancelled = true; clearTimeout(t); };
  }, [weatherKey]);

  const { data: plans = [], isLoading: plansLoading } = useQuery({
    queryKey: ['ride-plans'],
    queryFn: () => base44.entities.RidePlan.filter({}, '-created_date', 50),
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.RidePlan.create(data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ride-plans'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RidePlan.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ride-plans'] }),
  });

  const addWaypoint = (loc) => {
    setWaypoints((prev) => [...prev, { name: loc.name, lat: loc.lat, lng: loc.lng }]);
  };

  const updateWaypoint = (i, loc) => {
    setWaypoints((prev) => prev.map((w, idx) => (idx === i ? { ...w, lat: loc.lat, lng: loc.lng } : w)));
  };

  const removeWaypoint = (i) => setWaypoints((prev) => prev.filter((_, idx) => idx !== i));
  const moveUp = (i) => i > 0 && setWaypoints((prev) => {
    const next = [...prev]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; return next;
  });
  const moveDown = (i) => i < waypoints.length - 1 && setWaypoints((prev) => {
    const next = [...prev]; [next[i + 1], next[i]] = [next[i], next[i + 1]]; return next;
  });

  // Insert a suggested stop as a real waypoint, placed right after the leg's start.
  const addSuggestedStop = (loc, legIndex) => {
    setWaypoints((prev) => {
      const next = [...prev];
      const insertAt = Math.min(legIndex + 1, next.length);
      next.splice(insertAt, 0, { name: loc.name, lat: loc.lat, lng: loc.lng });
      return next;
    });
    toast.success(`Added "${loc.name}" to your route`);
  };

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Give your route a title'); return; }
    if (waypoints.length < 2) { toast.error('Add at least two waypoints'); return; }
    try {
      const payload = buildPayload();
      let id = currentPlanId;
      if (id) {
        await base44.entities.RidePlan.update(id, payload);
      } else {
        const plan = await saveMutation.mutateAsync(payload);
        id = plan.id;
        setCurrentPlanId(id);
      }
      lastSavedSnapshot.current = planSnapshot;
      setAutoSaveStatus('saved');
      queryClient.invalidateQueries({ queryKey: ['ride-plans'] });
      toast.success('Route saved');
    } catch (e) {
      console.error(e);
      toast.error('Could not save route');
    }
  };

  const loadPlan = (plan) => {
    try {
      const wp = JSON.parse(plan.waypoints || '[]');
      setTitle(plan.title);
      setNotes(plan.notes || '');
      setPlannedDate(plan.planned_date ? plan.planned_date.slice(0, 10) : '');
      setWaypoints(wp);
      setCurrentPlanId(plan.id);
      lastSavedSnapshot.current = JSON.stringify({ title: plan.title, notes: plan.notes || '', plannedDate: plan.planned_date ? plan.planned_date.slice(0, 10) : '', waypoints: wp });
      setAutoSaveStatus('idle');
      toast.success('Route loaded — edits auto-save');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error('Could not load route'); }
  };


  const handleStartRide = () => {
    if (waypoints.length < 2) { toast.error('Add at least two waypoints first'); return; }
    const dest = waypoints[waypoints.length - 1];
    const start = waypoints[0];
    savePendingNavigation({
      dest: { name: dest.name, lat: dest.lat, lng: dest.lng },
      start: { lat: start.lat, lng: start.lng },
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <CloudSun size={20} className="text-primary" /> Plan Ride
          {autoSaveStatus === 'saving' && <span className="flex items-center gap-1 text-xs font-normal text-muted-foreground"><Loader2 size={12} className="animate-spin" /> Saving…</span>}
          {autoSaveStatus === 'saved' && <span className="text-xs font-normal text-emerald-500">Saved</span>}
          {autoSaveStatus === 'error' && <span className="text-xs font-normal text-destructive">Save failed</span>}
        </h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="space-y-3 rounded-3xl border border-border bg-card p-4">
          <div>
            <Label>Route title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sunday Breakfast Run" className="mt-1" />
          </div>
          <div>
            <Label>Planned date (optional)</Label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-input bg-transparent px-3 py-2">
              <Calendar size={16} className="text-muted-foreground" />
              <input type="date" value={plannedDate} onChange={(e) => setPlannedDate(e.target.value)} className="flex-1 bg-transparent text-sm outline-none" />
            </div>
          </div>
          <div>
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Fuel stop at midway, lunch at the end" className="mt-1" />
          </div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-4">
          <Label className="mb-2 block">Add a waypoint</Label>
          <LocationSearchInput placeholder="Search for a place..." onSelect={addWaypoint} />
        </div>

        {waypoints.length > 0 && (
          <>
            <RidePlannerMap waypoints={waypoints} suggestedStops={suggestedStops} onWaypointDrag={updateWaypoint} />
            <WeatherCard weather={weather} loading={weatherLoading} plannedDate={plannedDate} />
            <RangeWarning waypoints={waypoints} />
            <StopSuggestions
              waypoints={waypoints}
              onAddStop={addSuggestedStop}
              onSuggestChange={setSuggestedStops}
            />
          </>
        )}

        {waypoints.length > 0 && (
          <div className="overflow-hidden rounded-3xl border border-border bg-card">
            {waypoints.map((w, i) => (
              <div key={i} className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-primary-foreground">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{w.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{w.lat.toFixed(4)}, {w.lng.toFixed(4)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button onClick={() => moveUp(i)} disabled={i === 0} className="rounded-lg p-1.5 text-muted-foreground disabled:opacity-30" aria-label="Move up"><ArrowUp size={16} /></button>
                  <button onClick={() => moveDown(i)} disabled={i === waypoints.length - 1} className="rounded-lg p-1.5 text-muted-foreground disabled:opacity-30" aria-label="Move down"><ArrowDown size={16} /></button>
                  <button onClick={() => removeWaypoint(i)} className="rounded-lg p-1.5 text-destructive" aria-label="Remove"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          onClick={handleStartRide}
          disabled={waypoints.length < 2}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          <Navigation size={20} /> Start Ride
        </Button>

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            variant="outline"
            disabled={saveMutation.isPending || !title.trim() || waypoints.length < 2}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold"
          >
            {saveMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}