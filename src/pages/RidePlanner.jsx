import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2, ArrowUp, ArrowDown, Save, Share2, Navigation, Loader2, Calendar, CloudSun } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import LocationSearchInput from '@/components/rides/LocationSearchInput';
import RidePlannerMap from '@/components/ride-planner/RidePlannerMap';
import WeatherCard from '@/components/ride-planner/WeatherCard';
import RangeWarning from '@/components/ride-planner/RangeWarning';
import StopSuggestions from '@/components/ride-planner/StopSuggestions';
import { savePendingNavigation } from '@/lib/rideCache';
import { getRouteWeather } from '@/lib/weather';
import { calculatePlannedRoute } from '@/lib/ridePlanning';
import { toast } from 'sonner';

const STORAGE_KEY = 'motogo_ride_plan_draft';

export default function RidePlanner() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [plannedDate, setPlannedDate] = useState('');
  const [waypoints, setWaypoints] = useState([]);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [weather, setWeather] = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [suggestedStops, setSuggestedStops] = useState([]);
  const [currentPlanId, setCurrentPlanId] = useState(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState('idle'); // idle | saving | saved | error
  const [sharedRoute, setSharedRoute] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLoading, setShareLoading] = useState(false);
  const [user, setUser] = useState(null);
  const lastSavedSnapshot = useRef('');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  const planSnapshot = useMemo(
    () => JSON.stringify({ title, notes, plannedDate, waypoints, routeData }),
    [title, notes, plannedDate, waypoints, routeData]
  );

  const buildPayload = useCallback(() => ({
    title: title.trim(),
    waypoints: JSON.stringify(waypoints),
    route_data: routeData ? JSON.stringify(routeData) : undefined,
    route_distance_km: routeData?.distance_km,
    route_duration_minutes: routeData?.duration_minutes,
    route_engine: routeData?.engine || undefined,
    notes: notes.trim(),
    planned_date: plannedDate ? new Date(plannedDate).toISOString() : undefined,
    weather: weather ? JSON.stringify(weather) : undefined,
  }), [title, waypoints, routeData, notes, plannedDate, weather]);

  const autoSave = useCallback(async (createIfMissing) => {
    if (sharedRoute || !title.trim() || waypoints.length < 2) return;
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
  }, [title, waypoints, currentPlanId, planSnapshot, buildPayload, queryClient, sharedRoute]);

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
        const shareId = params.get('share');
        if (shareId) {
          const shared = await base44.entities.RidePlanShare.get(shareId);
          if (!shared || shared.revoked_at || (shared.expires_at && new Date(shared.expires_at) < new Date())) throw new Error('Share expired or revoked');
          const wp = JSON.parse(shared.waypoints || '[]');
          setTitle(shared.title || '');
          setNotes(shared.notes || '');
          setPlannedDate(shared.planned_date ? shared.planned_date.slice(0, 10) : '');
          setWaypoints(wp);
          setWeather(shared.weather ? JSON.parse(shared.weather) : null);
          setRouteData(shared.route_data ? JSON.parse(shared.route_data) : null);
          setSharedRoute(true);
          setCurrentPlanId(null);
          lastSavedSnapshot.current = JSON.stringify({ title: shared.title || '', notes: shared.notes || '', plannedDate: shared.planned_date ? shared.planned_date.slice(0, 10) : '', waypoints: wp });
          setAutoSaveStatus('idle');
          toast.success(`Shared route loaded from ${shared.shared_with_name || 'MotoVeya rider'}`);
          window.history.replaceState({}, '', '/ride-planner');
          return;
        }
        if (loadId) {
          const plan = await base44.entities.RidePlan.get(loadId);
          if (plan) {
            const wp = JSON.parse(plan.waypoints || '[]');
            setTitle(plan.title || '');
            setNotes(plan.notes || '');
            setPlannedDate(plan.planned_date ? plan.planned_date.slice(0, 10) : '');
            setWaypoints(wp);
            setRouteData(plan.route_data ? JSON.parse(plan.route_data) : null);
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
          setRouteData(draft.routeData || null);
          lastSavedSnapshot.current = JSON.stringify({ title: draft.title || '', notes: draft.notes || '', plannedDate: draft.plannedDate || '', waypoints: Array.isArray(draft.waypoints) ? draft.waypoints : [] });
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);

  // Persist draft locally
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ title, notes, plannedDate, waypoints, routeData }));
  }, [title, notes, plannedDate, waypoints, routeData]);

  // Calculate the real road route using the same OSRM engine used by live navigation.
  // This is the authoritative distance/time source for fuel and ride planning.
  const routeKey = useMemo(() => waypoints.map((w) => `${w.lat},${w.lng}`).join('|'), [waypoints]);
  useEffect(() => {
    if (waypoints.length < 2) { setRouteData(null); return; }
    let cancelled = false;
    setRouteLoading(true);
    const t = setTimeout(async () => {
      try {
        const route = await calculatePlannedRoute(waypoints);
        if (!cancelled) setRouteData(route);
      } catch (e) {
        console.error('Ride planner routing:', e);
        if (!cancelled) { setRouteData(null); toast.error('Could not calculate the road route'); }
      } finally {
        if (!cancelled) setRouteLoading(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(t); };
  }, [routeKey]);

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
      let id = sharedRoute ? null : currentPlanId;
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
      setSharedRoute(false);
      toast.success(sharedRoute ? 'Route saved as your copy' : 'Route saved');
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
      setRouteData(plan.route_data ? JSON.parse(plan.route_data) : null);
      setCurrentPlanId(plan.id);
      lastSavedSnapshot.current = JSON.stringify({ title: plan.title, notes: plan.notes || '', plannedDate: plan.planned_date ? plan.planned_date.slice(0, 10) : '', waypoints: wp });
      setAutoSaveStatus('idle');
      toast.success('Route loaded — edits auto-save');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { toast.error('Could not load route'); }
  };


  const handleShareRoute = async (friend) => {
    if (!title.trim() || waypoints.length < 2) { toast.error('Save a route with at least two waypoints first'); return; }
    setShareLoading(true);
    try {
      let planId = currentPlanId;
      if (!planId) {
        const plan = await base44.entities.RidePlan.create(buildPayload());
        planId = plan.id;
        setCurrentPlanId(planId);
      } else {
        await base44.entities.RidePlan.update(planId, buildPayload());
      }
      const shared = await base44.entities.RidePlanShare.create({
        ride_plan_id: planId,
        owner_id: user.id,
        shared_with_user_id: friend.user_id,
        shared_with_name: friend.user_name,
        permission: 'view',
        title: title.trim(),
        waypoints: JSON.stringify(waypoints),
        notes: notes.trim(),
        planned_date: plannedDate ? new Date(plannedDate).toISOString() : undefined,
        weather: weather ? JSON.stringify(weather) : undefined,
        share_token: crypto.randomUUID(),
      });
      const url = `${window.location.origin}/ride-planner?share=${shared.id}`;
      try {
        await base44.entities.Notification.create({ recipient_id: friend.user_id, type: 'ride_invite', title: 'Route shared with you', body: `${user.nickname || user.full_name || 'A rider'} shared "${title.trim()}" with you.`, data: JSON.stringify({ type: 'route_share', share_id: shared.id, url }) });
      } catch (e) { console.error('route share notification', e); }
      setShareOpen(false);
      if (navigator.share) {
        try { await navigator.share({ title: `MotoVeya: ${title.trim()}`, text: `Route shared with you by ${user.nickname || user.full_name || 'a rider'}`, url }); } catch (e) { /* cancelled */ }
      } else {
        await navigator.clipboard?.writeText(url);
        toast.success(`Route shared with ${friend.user_name || 'rider'} and link copied`);
      }
    } catch (e) { console.error(e); toast.error('Could not share route'); }
    finally { setShareLoading(false); }
  };

  const handleStartRide = () => {
    if (waypoints.length < 2) { toast.error('Add at least two waypoints first'); return; }
    const dest = waypoints[waypoints.length - 1];
    const start = waypoints[0];
    savePendingNavigation({
      dest: { name: dest.name, lat: dest.lat, lng: dest.lng },
      start: { lat: start.lat, lng: start.lng },
      waypoints: waypoints.map((w) => ({ name: w.name, lat: w.lat, lng: w.lng })),
      routeData,
      autoStart: false,
    });
    navigate('/');
  };

  const { data: activeShares = [] } = useQuery({
    queryKey: ['ride-plan-shares', currentPlanId],
    queryFn: () => base44.entities.RidePlanShare.filter({ ride_plan_id: currentPlanId }, '-created_date', 50),
    enabled: !!currentPlanId && !sharedRoute,
  });

  const revokeShareMutation = useMutation({
    mutationFn: (id) => base44.entities.RidePlanShare.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ride-plan-shares', currentPlanId] }),
  });

  const { data: friendRows = [] } = useQuery({
    queryKey: ['ride-plan-share-friends', user?.id],
    queryFn: () => base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 100),
    enabled: !!user?.id && !sharedRoute,
  });

  const friends = friendRows.map((f) => f.requester_id === user?.id
    ? { user_id: f.recipient_id, user_name: f.recipient_name || 'Friend' }
    : { user_id: f.requester_id, user_name: f.requester_name || 'Friend' }
  ).filter((f, i, arr) => f.user_id && arr.findIndex((x) => x.user_id === f.user_id) === i);

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
            <RidePlannerMap waypoints={waypoints} routeData={routeData} routeLoading={routeLoading} suggestedStops={suggestedStops} onWaypointDrag={updateWaypoint} />
            {routeLoading && <div className="rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">Calculating actual road route…</div>}
            {routeData && <div className="grid grid-cols-2 gap-3 rounded-2xl border border-border bg-card p-4 text-sm">
              <div><p className="text-xs text-muted-foreground">Road distance</p><p className="font-bold">{routeData.distance_km.toFixed(1)} km</p></div>
              <div><p className="text-xs text-muted-foreground">Estimated riding time</p><p className="font-bold">{Math.floor(routeData.duration_minutes / 60)}h {Math.round(routeData.duration_minutes % 60)}m</p></div>
            </div>}
            <WeatherCard weather={weather} loading={weatherLoading} plannedDate={plannedDate} />
            <RangeWarning waypoints={waypoints} routeData={routeData} />
            <StopSuggestions
              waypoints={waypoints}
              routeData={routeData}
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

        {sharedRoute && <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">Shared route — view only.</span> Save a copy if you want to edit it.
        </div>}

        <Button
          onClick={handleStartRide}
          disabled={waypoints.length < 2}
          className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
        >
          <Navigation size={20} /> Start Ride
        </Button>

        {activeShares.length > 0 && !sharedRoute && <div className="rounded-2xl border border-border bg-card p-4">
          <p className="mb-2 text-sm font-bold">Shared With</p>
          <div className="space-y-2">
            {activeShares.filter((s) => !s.revoked_at).map((share) => (
              <div key={share.id} className="flex items-center justify-between rounded-xl bg-secondary p-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{share.shared_with_name || 'MotoVeya rider'}</p>
                  <p className="text-xs text-muted-foreground">View only</p>
                </div>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => revokeShareMutation.mutate(share.id)} disabled={revokeShareMutation.isPending}>Revoke</Button>
              </div>
            ))}
          </div>
        </div>}

        <div className="flex gap-3">
          <Button
            onClick={handleSave}
            variant="outline"
            disabled={saveMutation.isPending || !title.trim() || waypoints.length < 2}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold"
          >
            {saveMutation.isPending ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
            {sharedRoute ? 'Save Copy' : 'Save'}
          </Button>
          {!sharedRoute && <Button
            onClick={() => setShareOpen(true)}
            variant="secondary"
            disabled={!title.trim() || waypoints.length < 2 || shareLoading}
            className="flex min-h-[56px] flex-1 items-center justify-center gap-2 rounded-2xl text-base font-bold"
          >
            {shareLoading ? <Loader2 size={20} className="animate-spin" /> : <Share2 size={20} />}
            Share
          </Button>}
        </div>
      </div>

      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Share Route</DialogTitle></DialogHeader>
          {friends.length === 0 ? (
            <div className="rounded-2xl bg-secondary p-4 text-center text-sm text-muted-foreground">
              Add and accept a MotoVeya friend before sharing a private route.
            </div>
          ) : (
            <div className="max-h-[50vh] space-y-2 overflow-y-auto">
              {friends.map((friend) => (
                <button key={friend.user_id} type="button" onClick={() => handleShareRoute(friend)} disabled={shareLoading} className="flex w-full items-center justify-between rounded-2xl border border-border bg-card p-3 text-left hover:bg-secondary disabled:opacity-50">
                  <span className="font-semibold">{friend.user_name}</span>
                  <Badge variant="secondary">View</Badge>
                </button>
              ))}
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setShareOpen(false)}>Cancel</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}