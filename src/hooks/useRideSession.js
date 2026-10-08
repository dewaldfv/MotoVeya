import { useState, useEffect, useRef, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useBackgroundTracking } from '@/hooks/useBackgroundTracking';
import { useCrashDetection, requestMotionPermission } from '@/hooks/useCrashDetection';
import { useAutoRideStop } from '@/hooks/useAutoRideStop';
import { useAutoRideStart } from '@/hooks/useAutoRideStart';
import { useEmergencyBeacon } from '@/hooks/useEmergencyBeacon';
import { useEmergencyCancellation } from '@/hooks/useEmergencyCancellation';
import { useSpeedLimit } from '@/hooks/useSpeedLimit';
import { saveRideState, getActiveRide, clearActiveRide, savePendingRide, getPendingRides, clearPendingRide } from '@/lib/rideCache';
import { cacheEmergencyData, getPendingEmergency, clearPendingEmergency } from '@/lib/emergencyCache';
import { processRouteData, getRouteProgress, haversine } from '@/lib/navigation';
import { toast } from 'sonner';
import { notifyFriendsOfRide } from '@/lib/rideInvite';
import { startNativeLocationTracking, stopNativeLocationTracking } from '@/lib/nativeTracking';

const SA_CENTER = [-26.2041, 28.0473];

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve([pos.coords.latitude, pos.coords.longitude]),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function useRideSession({ user, bike, fuelProfile, services = [], autoDetectEnabled = true, notifyFriends = true }) {
  const [rideStatus, setRideStatus] = useState('idle');
  const [userPos, setUserPos] = useState(() => {
    try {
      const cached = JSON.parse(localStorage.getItem('motogo_last_location') || 'null');
      return Array.isArray(cached) && cached.length >= 2 && cached.every((v, i) => i > 1 || typeof v === 'number') ? cached : null;
    } catch {
      return null;
    }
  });
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [destination, setDestination] = useState(null);
  const [destInput, setDestInput] = useState('');
  const [routeData, setRouteData] = useState(null);
  const [replayMode, setReplayMode] = useState(false);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routePreference, setRoutePreference] = useState(() => {
    try {
      const saved = localStorage.getItem('motoveya_route_preference') || 'fastest';
      return saved === 'alternative' ? 'rider_roads' : saved;
    } catch { return 'fastest'; }
  });
  const [crashCountdown, setCrashCountdown] = useState(null);
  const [crashPhase, setCrashPhase] = useState(null);
  const [crashAlertId, setCrashAlertId] = useState(null);
  const [distressAlertId, setDistressAlertId] = useState(null);
  const [distressActive, setDistressActive] = useState(false);
  const [emergencyContactsNotified, setEmergencyContactsNotified] = useState(false);
  const [nearbyRidersNotified, setNearbyRidersNotified] = useState(false);
  const [crashIndicators, setCrashIndicators] = useState(null);
  const [severity, setSeverity] = useState('medium');
  // Post-crash recovery state: the SOS location stays fixed while the rider
  // remains red until 1 km of validated safe movement has been completed.
  const [crashRecovery, setCrashRecovery] = useState(null);
  const [autoStopCountdown, setAutoStopCountdown] = useState(null);
  const [ending, setEnding] = useState(false);
  const [nearbyService, setNearbyService] = useState(null);
  const [dismissedServiceIds, setDismissedServiceIds] = useState(new Set());
  const [fuelRemaining, setFuelRemaining] = useState(null);
  const [fuelRange, setFuelRange] = useState(null);
  const [recalculating, setRecalculating] = useState(false);
  const [routeWarnings, setRouteWarnings] = useState([]);
  const [externalWarnings, setExternalWarnings] = useState([]);
  const [reportingWarning, setReportingWarning] = useState(false);

  const lastPosRef = useRef(null);
  const positionsRef = useRef([]);
  const crashRecoveryRef = useRef(null);
  const resolveEmergencyRef = useRef(null);
  const startTimeRef = useRef(Date.now());
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecalcRef = useRef(0);
  const warningPosRef = useRef(null);
  const beacon = useEmergencyBeacon();
  const speedLimit = useSpeedLimit(rideStatus === 'active' ? userPos : null);

  const speedRef = useRef(speed);
  const headingRef = useRef(heading);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => { headingRef.current = heading; }, [heading]);

  const { gpsConfig, gpsWeak, markGpsUpdate } = useBackgroundTracking({
    enabled: localStorage.getItem('motogo_background_tracking') !== 'false',
    isActive: rideStatus === 'active',
    isNavigating: !!routeData,
    stats: { speed, duration, distance },
  });

  // Resume cached ride on mount
  useEffect(() => {
    const pending = getPendingRides();
    if (pending.length > 0) {
      (async () => {
        let synced = 0;
        for (const ride of pending) {
          try {
            await base44.entities.Ride.create(ride.data);
            clearPendingRide(ride.id);
            synced++;
          } catch (e) { console.error(e); }
        }
        if (synced > 0) toast.success(`Synced ${synced} offline ride${synced > 1 ? 's' : ''}`);
      })();
    }
    const cached = getActiveRide();
    if (cached && Date.now() - cached.savedAt < 4 * 3600 * 1000) {
      positionsRef.current = cached.positions || [];
      lastPosRef.current = cached.positions?.[cached.positions.length - 1] || null;
      startTimeRef.current = cached.startTime || Date.now();
      setDistance(cached.distance || 0);
      setDuration(cached.duration || 0);
      setMaxSpeed(cached.maxSpeed || 0);
      setDestination(cached.destination || null);
      setDestInput(cached.destination?.name || '');
      setRouteData(cached.routeData || null);
      setReplayMode(!!cached.routeData?.replayMode);
      setRideStatus('active');
      toast.info('Resuming active ride');
    } else if (cached) {
      clearActiveRide();
    }
  }, []);

  // Idle GPS tracking — keeps the rider marker live on the map
  useEffect(() => {
    if (rideStatus !== 'idle' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const nextPos = [pos.coords.latitude, pos.coords.longitude, pos.coords.altitude];
        setUserPos(nextPos);
        try { localStorage.setItem('motogo_last_location', JSON.stringify(nextPos)); } catch {}
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) setHeading(pos.coords.heading);
        if (pos.coords.accuracy != null) setAccuracy(pos.coords.accuracy);
        const spd = pos.coords.speed != null && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : 0;
        setSpeed(Math.round(spd));
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [rideStatus]);

  // Active GPS tracking — adaptive config + stats recording
  useEffect(() => {
    if (rideStatus !== 'active' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        markGpsUpdate();
        const newPos = [pos.coords.latitude, pos.coords.longitude, pos.coords.altitude];
        setUserPos(newPos);
        try { localStorage.setItem('motogo_last_location', JSON.stringify(newPos)); } catch {}
        positionsRef.current.push(newPos);
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) setHeading(pos.coords.heading);
        if (pos.coords.accuracy != null) setAccuracy(pos.coords.accuracy);
        // Android/WebView can report coords.speed as 0/null even with a valid
        // high-accuracy GPS fix. Derive speed from consecutive GPS fixes.
        let spd = pos.coords.speed != null && Number.isFinite(pos.coords.speed) && pos.coords.speed > 0
          ? pos.coords.speed * 3.6
          : 0;
        if (lastPosRef.current?.__timestamp && spd < 1) {
          const elapsedSec = (pos.timestamp - lastPosRef.current.__timestamp) / 1000;
          if (elapsedSec > 0) {
            const derivedSpeed = haversine(lastPosRef.current[0], lastPosRef.current[1], newPos[0], newPos[1]) * 3600 / elapsedSec;
            if (Number.isFinite(derivedSpeed)) spd = derivedSpeed;
          }
        }
        setSpeed(Math.round(spd));
        setMaxSpeed((prev) => (spd > prev ? Math.round(spd) : prev));
        if (lastPosRef.current) {
          const d = haversine(lastPosRef.current[0], lastPosRef.current[1], newPos[0], newPos[1]);
          if (d > 0.005) setDistance((prev) => prev + d);

          // After a confirmed crash, only count validated movement at >=10 km/h
          // toward the 1 km recovery threshold. This prevents GPS jitter or a
          // stationary rider from clearing the Rider Down state.
          const recovery = crashRecoveryRef.current;
          const gpsAccuracy = pos.coords.accuracy ?? 999;
          if (recovery && recovery.active && spd >= 10 && gpsAccuracy <= 50 && d > 0.005 && d < 0.5) {
            const nextSafeDistance = recovery.safeDistanceKm + d;
            crashRecoveryRef.current = { ...recovery, safeDistanceKm: nextSafeDistance };
            setCrashRecovery((prev) => prev ? { ...prev, safeDistanceKm: nextSafeDistance } : prev);
            if (nextSafeDistance >= 1) {
              // Resolve asynchronously after the current GPS update so the
              // current position is retained and the SOS alert can be closed.
              resolveEmergencyRef.current?.({ autoRecovered: true });
            }
          }
        }
        newPos.__timestamp = pos.timestamp || Date.now();
        lastPosRef.current = newPos;

        // Single authoritative GPS stream: consumers such as live sharing receive
        // this exact fix instead of opening their own competing watchPosition().
        try {
          window.dispatchEvent(new CustomEvent('motoveya:ride-location', {
            detail: {
              lat: newPos[0],
              lng: newPos[1],
              speed: spd,
              heading: pos.coords.heading != null && !isNaN(pos.coords.heading) ? pos.coords.heading : null,
              accuracy: pos.coords.accuracy ?? null,
              timestamp: pos.timestamp || Date.now(),
            }
          }));
        } catch {}
      },
      () => {},
      gpsConfig
    );
    watchIdRef.current = watchId;
    return () => { navigator.geolocation.clearWatch(watchId); watchIdRef.current = null; };
  }, [rideStatus, gpsConfig, markGpsUpdate]);

  // Duration timer
  useEffect(() => {
    if (rideStatus !== 'active') return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    timerRef.current = timer;
    return () => { clearInterval(timer); timerRef.current = null; };
  }, [rideStatus]);

  // Battery
  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        setBatteryLevel(Math.round(b.level * 100));
        const update = () => setBatteryLevel(Math.round(b.level * 100));
        b.addEventListener('levelchange', update);
      }).catch(() => {});
    }
  }, []);

  // Fuel calculation
  useEffect(() => {
    const consumption = fuelProfile?.adaptive_l_per_100km || bike?.fuel_consumption_l_per_100km;
    if (bike && bike.tank_capacity_l && consumption) {
      const consumed = distance * (consumption / 100);
      const remaining = Math.max(0, bike.tank_capacity_l - consumed);
      const range = remaining > 0 ? (remaining / consumption) * 100 : 0;
      setFuelRemaining(Math.round(remaining * 10) / 10);
      setFuelRange(Math.round(range));
    }
  }, [distance, bike, fuelProfile]);

  // Crash countdown
  useEffect(() => {
    if (crashCountdown === null) return;
    if (crashCountdown <= 0) { handleCrashConfirmed(); return; }
    const t = setTimeout(() => setCrashCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [crashCountdown]);

  // Crash detection
  useCrashDetection({
    enabled: rideStatus === 'active',
    speed,
    onCrashDetected: (data) => {
      setCrashIndicators(data.indicators);
      setSeverity(data.severity);
      if (data.severity === 'high') {
        handleCrashConfirmed(data.severity, data.indicators);
      } else {
        setCrashCountdown(data.severity === 'medium' ? 15 : 30);
        setCrashPhase('countdown');
      }
    },
  });

  // Auto ride stop
  useAutoRideStop({
    enabled: autoDetectEnabled,
    isActive: rideStatus === 'active',
    speed,
    userPos,
    onPromptStop: () => setAutoStopCountdown(30),
    isCountingDown: autoStopCountdown !== null,
  });

  // Save ride state periodically
  useEffect(() => {
    if (rideStatus !== 'active') return;
    const interval = setInterval(() => {
      saveRideState({
        positions: positionsRef.current,
        distance, duration, maxSpeed,
        startTime: startTimeRef.current,
        destination, routeData,
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [rideStatus, distance, duration, maxSpeed, destination, routeData]);

  // GPS dead reckoning fallback
  useEffect(() => {
    if (rideStatus !== 'active' || !gpsWeak) return;
    const interval = setInterval(() => {
      const s = speedRef.current;
      const h = headingRef.current;
      const lastPos = lastPosRef.current;
      if (lastPos && s > 0 && h != null) {
        const distKm = (s / 3.6) * 5 / 1000;
        const bearing = h * Math.PI / 180;
        const lat1 = lastPos[0] * Math.PI / 180;
        const lng1 = lastPos[1] * Math.PI / 180;
        const R = 6371;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(distKm / R) + Math.cos(lat1) * Math.sin(distKm / R) * Math.cos(bearing));
        const lng2 = lng1 + Math.atan2(Math.sin(bearing) * Math.sin(distKm / R) * Math.cos(lat1), Math.cos(distKm / R) - Math.sin(lat1) * Math.sin(lat2));
        const estimated = [lat2 * 180 / Math.PI, lng2 * 180 / Math.PI, lastPos[2]];
        setUserPos(estimated);
        try { localStorage.setItem('motogo_last_location', JSON.stringify(estimated)); } catch {}
        const d = haversine(lastPos[0], lastPos[1], estimated[0], estimated[1]);
        if (d > 0.005) {
          setDistance((prev) => prev + d);
          positionsRef.current.push(estimated);
          lastPosRef.current = estimated;
        }
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [rideStatus, gpsWeak]);

  // Auto stop countdown
  useEffect(() => {
    if (autoStopCountdown === null) return;
    if (autoStopCountdown <= 0) { setAutoStopCountdown(null); handleEndRide(); return; }
    const t = setTimeout(() => setAutoStopCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [autoStopCountdown]);

  useEffect(() => {
    if (autoStopCountdown !== null && speed >= 15) {
      setAutoStopCountdown(null);
      toast.info('Movement detected — continuing ride');
    }
  }, [speed, autoStopCountdown]);

  // Rider Down live location updates
  useEffect(() => {
    if ((!crashPhase && !distressActive) || !crashAlertId || !userPos) return;
    const updateLocation = async () => {
      try {
        await base44.functions.invoke('update-emergency-location', {
          alert_id: crashAlertId,
          lat: userPos[0],
          lng: userPos[1],
        });
        if (distressAlertId) {
          await base44.entities.DistressAlert.update(distressAlertId, {
            last_lat: userPos[0],
            last_lng: userPos[1],
            last_updated: new Date().toISOString(),
          });
        }
      } catch (e) { console.error(e); }
    };
    updateLocation();
    const interval = setInterval(updateLocation, 10000);
    return () => clearInterval(interval);
  }, [crashPhase, distressActive, crashAlertId, distressAlertId, userPos]);

  // Online sync (pending rides + emergency)
  useEffect(() => {
    const handleOnline = async () => {
      const pendingRides = getPendingRides();
      for (const ride of pendingRides) {
        try {
          await base44.entities.Ride.create(ride.data);
          clearPendingRide(ride.id);
        } catch (e) { console.error(e); }
      }
      const cached = getPendingEmergency();
      if (!cached) return;
      for (let i = 0; i < 3; i++) {
        try {
          const res = await base44.functions.invoke('trigger-emergency-response', cached);
          if (res.data?.alert?.id) {
            clearPendingEmergency();
            setCrashAlertId(res.data.alert.id);
            setEmergencyContactsNotified(res.data?.contact_notified || false);
            setNearbyRidersNotified(res.data?.nearby_notified > 0 || false);
            break;
          }
        } catch (e) {
          if (i < 2) await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
        }
      }
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);

  // Route warnings are shared across MotoVeya, not restricted to a group ride.
  // Poll every 15s while navigating so riders joining the same road see fresh warnings.
  useEffect(() => { warningPosRef.current = userPos; }, [userPos]);
  useEffect(() => {
    if (rideStatus !== 'active' || !userPos) { setRouteWarnings([]); setExternalWarnings([]); return; }
    let cancelled = false;
    const loadWarnings = async () => {
      const pos = warningPosRef.current;
      if (!pos) return;
      try {
        const route = routeData?.coordinates || [];
        const res = await base44.functions.invoke('get-route-warnings', {
          lat: pos[0],
          lng: pos[1],
          route: route.length > 300 ? route.filter((_, i) => i % Math.ceil(route.length / 300) === 0) : route,
        });
        if (!cancelled) setRouteWarnings(res.data?.warnings || []);
        try {
          const external = await base44.functions.invoke('get-external-route-warnings', {
            lat: pos[0], lng: pos[1],
            route: route.length > 300 ? route.filter((_, i) => i % Math.ceil(route.length / 300) === 0) : route,
          });
          if (!cancelled) setExternalWarnings(external.data?.warnings || []);
        } catch (e) { if (!cancelled) console.error('External route warnings:', e); }
      } catch (e) { if (!cancelled) console.error('Route warnings:', e); }
    };
    loadWarnings();
    const timer = setInterval(loadWarnings, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [rideStatus, routeData]);

  const handleReportWarning = async (warningType) => {
    if (!userPos || reportingWarning) return;
    setReportingWarning(true);
    const labels = {
      traffic: 'Traffic / Congestion', obstruction: 'Road Obstruction', accident: 'Accident Ahead',
      weather: 'Severe Weather', mechanical: 'Mechanical Problem', unexpected_stop: 'Unexpected Stop', other: 'Warning',
    };
    try {
      const now = new Date();
      const expires = new Date(now.getTime() + 60 * 60 * 1000);
      const warning = await base44.entities.WarningAlert.create({
        rider_id: user?.id,
        rider_name: user?.nickname || user?.full_name || 'Rider',
        lat: userPos[0],
        lng: userPos[1],
        warning_type: warningType.type || warningType,
        title: warningType.title || labels[warningType.type] || 'Warning',
        message: `${labels[warningType.type] || 'Warning'} reported by a rider`,
        status: 'active',
        reported_at: now.toISOString(),
        expires_at: expires.toISOString(),
        route_name: navProgress?.nextStep?.name || destination?.name || 'Current route',
        heading: heading,
      });
      setRouteWarnings((prev) => [{ ...warning, distance_from_rider_km: 0, is_self: true }, ...prev]);
      toast.success('Warning shared with riders on this route');
    } catch (e) {
      console.error(e);
      toast.error('Could not share warning');
    } finally {
      setReportingWarning(false);
    }
  };

  // Route progress
  const navProgress = useMemo(() => {
    if (!routeData || !userPos) return null;
    return getRouteProgress(routeData, userPos);
  }, [routeData, userPos]);

  // Off-route handling. Normal navigation recalculates through OSRM. Exact Replay
  // deliberately NEVER reroutes: the recorded GPS track is the route. A deviation
  // warning is still shown so the rider knows they have left the original track.
  useEffect(() => {
    if (rideStatus !== 'active' || !routeData || !destination || !userPos) return;
    if (routeData.replayMode) return;
    const route = routeData.coordinates;
    if (!route || route.length < 2) return;
    // Find the nearest point on the route to the rider.
    let minDist = Infinity;
    for (let i = 0; i < route.length; i++) {
      const d = haversine(userPos[0], userPos[1], route[i][0], route[i][1]);
      if (d < minDist) minDist = d;
    }
    // Wider tolerance at higher speeds (GPS jitter + wider roads), tighter when slow.
    const threshold = speed > 60 ? 0.4 : speed > 20 ? 0.25 : 0.15;
    if (minDist > threshold && Date.now() - lastRecalcRef.current > 20000 && !recalculating) {
      lastRecalcRef.current = Date.now();
      setRecalculating(true);
      (async () => {
        try {
          const recalcParams = new URLSearchParams({ overview: 'full', geometries: 'geojson', steps: 'true', continue_straight: 'false' });
          if (routePreference === 'avoid_motorways') recalcParams.set('exclude', 'motorway');
          if (routePreference === 'rider_roads' || routePreference === 'alternative') recalcParams.set('alternatives', 'true');
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${destination.lng},${destination.lat}?${recalcParams.toString()}`);
          const data = await res.json();
          if (data.routes?.[0]) {
            const routes = data.routes || [];
            const selected = routePreference === 'rider_roads' ? selectMotorcycleRoute(routes) : routes[0];
            if (selected) setRouteData(processRouteData({ routes: [selected] }));
            toast.info('Off route — recalculating...');
          }
        } catch (e) {
          console.error(e);
        } finally {
          setRecalculating(false);
        }
      })();
    }
  }, [userPos, rideStatus, routeData, destination, speed, recalculating, routePreference]);

  // Nearby service on route
  useEffect(() => {
    if (rideStatus !== 'active' || !routeData || !services.length) { setNearbyService(null); return; }
    const route = routeData.coordinates;
    if (!route || route.length < 2) { setNearbyService(null); return; }
    let nearest = null;
    let nearestDist = Infinity;
    for (const svc of services) {
      if (dismissedServiceIds.has(svc.id)) continue;
      let minRouteDist = Infinity;
      for (let i = 0; i < route.length; i += 5) {
        const d = haversine(svc.lat, svc.lng, route[i][0], route[i][1]);
        if (d < minRouteDist) minRouteDist = d;
      }
      if (minRouteDist <= 2) {
        const distToRider = userPos ? haversine(svc.lat, svc.lng, userPos[0], userPos[1]) : Infinity;
        if (distToRider > 0.15 && distToRider < nearestDist) {
          nearestDist = distToRider;
          nearest = svc;
        }
      }
    }
    setNearbyService(nearest);
  }, [userPos, routeData, rideStatus, services, dismissedServiceIds]);

  // --- Handlers ---

  const scoreMotorcycleRoute = (route) => {
    // OSRM does not expose a "scenic" or "motorcycle fun" route mode. Score
    // the actual candidate using road-class metadata when available, then
    // fall back to distance/duration signals. This keeps the feature honest.
    let score = 0;
    for (const leg of route.legs || []) {
      for (const step of leg.steps || []) {
        const km = Math.max(0, Number(step.distance || 0)) / 1000;
        const classes = new Set();
        for (const intersection of step.intersections || []) {
          for (const c of intersection.classes || []) classes.add(String(c).toLowerCase());
        }
        const name = String(step.name || '').toLowerCase();
        if (classes.has('motorway')) score -= km * 14;
        else if (classes.has('trunk')) score -= km * 6;
        else if (classes.has('primary')) score -= km * 2;
        else if (classes.has('secondary')) score += km * 2;
        else if (classes.has('tertiary')) score += km * 4;
        else score += km * 5;
        if (!classes.size && /motorway|freeway|toll/.test(name)) score -= km * 4;
      }
    }
    const distanceKm = Math.max(0, Number(route.distance || 0)) / 1000;
    const durationMin = Math.max(0, Number(route.duration || 0)) / 60;
    score += Math.min(distanceKm, 120) * 0.4;
    score -= Math.max(0, durationMin - distanceKm * 1.8) * 0.08;
    return score;
  };

  const selectMotorcycleRoute = (routes = []) => {
    if (!routes.length) return null;
    return [...routes].sort((a, b) => scoreMotorcycleRoute(b) - scoreMotorcycleRoute(a))[0] || routes[0];
  };

  const fetchRoute = async (origin, dest, routeWaypoints = [], preference = routePreference) => {
    setRouteLoading(true);
    try {
      const intermediate = (Array.isArray(routeWaypoints) ? routeWaypoints : [])
        .filter((p) => Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng)))
        .filter((p) => !(Number(p.lat) === Number(origin[0]) && Number(p.lng) === Number(origin[1])))
        .filter((p) => !(Number(p.lat) === Number(dest.lat) && Number(p.lng) === Number(dest.lng)));
      const points = [
        `${origin[1]},${origin[0]}`,
        ...intermediate.map((p) => `${p.lng},${p.lat}`),
        `${dest.lng},${dest.lat}`,
      ];
      const params = new URLSearchParams({
        overview: 'full',
        geometries: 'geojson',
        steps: 'true',
        continue_straight: 'false',
      });
      if (preference === 'avoid_motorways') params.set('exclude', 'motorway');
      if (preference === 'rider_roads' || preference === 'alternative') params.set('alternatives', 'true');
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${points.join(';')}?${params.toString()}`);
      const data = await res.json();
      if (data.routes?.[0]) {
        let selectedRoute = data.routes[0];
        if (preference === 'rider_roads') selectedRoute = selectMotorcycleRoute(data.routes);
        else if (preference === 'alternative' && data.routes.length > 1) {
          selectedRoute = [...data.routes].sort((a, b) => b.distance - a.distance)[0];
        }
        setRouteData(processRouteData({ routes: [selectedRoute] }));
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not calculate route');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleDestination = async (dest, routeOptions = {}) => {
    setDestination(dest);
    setDestInput(dest.name);
    const preference = routeOptions.preference || routePreference;
    try {
      const origin = routeOptions.start
        ? [routeOptions.start.lat, routeOptions.start.lng]
        : await getCurrentPosition();
      setUserPos(origin);
      await fetchRoute(origin, dest, routeOptions.waypoints || [], preference);
    } catch (e) {
      console.error(e);
      toast.error('Could not get your location. Enable GPS and try again.');
    }
  };

  useEffect(() => {
    try { localStorage.setItem('motoveya_route_preference', routePreference); } catch {}
  }, [routePreference]);

  const clearDestination = () => {
    setDestination(null);
    setDestInput('');
    setRouteData(null);
  };

  const handleAddStop = async (svc) => {
    if (!userPos || !destination) return;
    setRouteLoading(true);
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${svc.lng},${svc.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setRouteData(processRouteData(data));
        setDismissedServiceIds(new Set([...dismissedServiceIds, svc.id]));
        toast.success(`Added stop: ${svc.name}`);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not add stop');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleDismissService = () => {
    if (nearbyService) setDismissedServiceIds(new Set([...dismissedServiceIds, nearbyService.id]));
    setNearbyService(null);
  };

  const handleSimulateCrash = () => {
    setCrashIndicators({ highGForce: true, suddenDecel: true });
    setSeverity('medium');
    setCrashCountdown(15);
    setCrashPhase('countdown');
  };

  const handleCancelCrash = () => {
    setCrashCountdown(null);
    setCrashPhase(null);
    setSeverity('medium');
    beacon.stop();
    if (userPos) {
      base44.entities.CrashAlert.create({
        rider_id: user?.id, rider_name: user?.nickname || user?.full_name || 'Rider',
        lat: userPos[0], lng: userPos[1], timestamp: new Date().toISOString(),
        status: 'false_alarm', severity, crash_indicators: crashIndicators ? JSON.stringify(crashIndicators) : 'manual',
      }).catch(() => {});
    }
    setCrashIndicators(null);
  };

  const handleCrashConfirmed = async (overrideSeverity, overrideIndicators) => {
    const sev = overrideSeverity || severity;
    setCrashCountdown(null);
    setCrashPhase('active');
    const crashPos = userPos || SA_CENTER;
    const recoveryState = { active: true, crashLat: crashPos[0], crashLng: crashPos[1], safeDistanceKm: 0 };
    crashRecoveryRef.current = recoveryState;
    setCrashRecovery(recoveryState);
    beacon.start();
    const pos = crashPos;
    const emergencyData = {
      lat: pos[0], lng: pos[1],
      rider_name: user?.nickname || user?.full_name || 'Rider',
      is_premium: user?.subscription_tier === 'premium',
      indicators: overrideIndicators ?? crashIndicators,
      severity: sev,
      speed_at_impact: speed,
      heading_at_impact: heading,
      battery_level: batteryLevel,
      bike_make: bike?.make,
      bike_model: bike?.model,
      bike_year: bike?.year,
    };
    cacheEmergencyData(emergencyData);
    for (let i = 0; i < 5; i++) {
      try {
        const res = await base44.functions.invoke('trigger-emergency-response', emergencyData);
        const data = res.data;
        if (data?.alert?.id) {
          setCrashAlertId(data.alert.id);
          setDistressAlertId(data?.distress_alert_id || null);
          setEmergencyContactsNotified(data?.contact_notified || false);
          setNearbyRidersNotified(data?.nearby_notified > 0 || false);
          clearPendingEmergency();
          setDistressActive(true);
          return;
        }
      } catch (e) {
        console.error('Emergency send attempt ' + (i + 1) + ' failed:', e);
        if (i < 4) await new Promise((r) => setTimeout(r, 5000 * (i + 1)));
      }
    }
    toast.error('Could not send Rider Down alert. Will retry when connected.');
    setDistressActive(true);
  };

  const handleResolveEmergency = async ({ autoRecovered = false } = {}) => {
    beacon.stop();
    if (crashAlertId) {
      try { await base44.entities.CrashAlert.update(crashAlertId, { status: 'resolved' }); } catch (e) { console.error(e); }
    }
    if (distressAlertId) {
      try { await base44.entities.DistressAlert.update(distressAlertId, { status: 'resolved', last_updated: new Date().toISOString() }); } catch (e) { console.error(e); }
    }
    setCrashPhase(null);
    setCrashAlertId(null);
    setDistressAlertId(null);
    setDistressActive(false);
    setEmergencyContactsNotified(false);
    setNearbyRidersNotified(false);
    setCrashIndicators(null);
    setSeverity('medium');
    crashRecoveryRef.current = null;
    setCrashRecovery(null);
    if (autoRecovered) toast.success('1 km of safe movement completed — Rider Down alert cleared');
  };

  useEffect(() => {
    resolveEmergencyRef.current = handleResolveEmergency;
  }, [handleResolveEmergency]);

  const { voiceSupported, voiceListening } = useEmergencyCancellation({
    enabled: crashPhase === 'countdown' || crashPhase === 'active',
    onCancel: () => {
      if (crashPhase === 'countdown') handleCancelCrash();
      else if (crashPhase === 'active') handleResolveEmergency();
    },
  });

  const handleDistress = async () => {
    const pos = userPos || SA_CENTER;
    try {
      const res = await base44.functions.invoke('trigger-emergency-response', {
        lat: pos[0],
        lng: pos[1],
        rider_name: user?.nickname || user?.full_name || 'Rider',
        severity: 'medium',
        battery_level: batteryLevel,
        bike_make: bike?.make,
        bike_model: bike?.model,
        bike_year: bike?.year,
      });
      if (res.data?.alert?.id) {
        setCrashAlertId(res.data.alert.id);
        setDistressAlertId(res.data?.distress_alert_id || null);
        setEmergencyContactsNotified(res.data?.contact_notified || false);
        setNearbyRidersNotified(res.data?.nearby_notified > 0 || false);
        setDistressActive(true);
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not send Rider Down alert');
    }
  };

  const startRide = async (destOverride, originOverride, routeWaypoints = [], replayTrack = null) => {
    const motionPermissionGranted = await requestMotionPermission();
    if (!motionPermissionGranted) {
      toast.warning('Motion-sensor access is unavailable or denied. Browser-based crash detection may not run on this device.');
    }
    setSpeed(0); setMaxSpeed(0); setDistance(0); setDuration(0);
    setHeading(null); setAccuracy(null); setDistressActive(false);
    setReplayMode(!!replayTrack);
    crashRecoveryRef.current = null; setCrashRecovery(null);
    positionsRef.current = []; lastPosRef.current = null;
    startTimeRef.current = Date.now();
    setRideStatus('active');
    // Start the native Android foreground location service immediately when a ride begins.
    // Web geolocation remains active for the UI; native tracking continues with the screen locked.
    startNativeLocationTracking().then((result) => {
      if (!result.started && result.native) console.warn('MotoVeya native foreground tracking could not start');
    }).catch((e) => console.warn('Native foreground tracking unavailable:', e));
    const dest = destOverride || destination;
    if (replayTrack?.coordinates?.length >= 2) {
      const track = replayTrack.coordinates;
      const replayDestination = dest || {
        lat: Number(track[track.length - 1][0]),
        lng: Number(track[track.length - 1][1]),
        name: replayTrack.destinationName || 'Replay finish'
      };
      setDestination(replayDestination);
      setDestInput(replayDestination.name);
      setRouteData({
        coordinates: track.map((p) => [Number(p[0]), Number(p[1])]),
        steps: [],
        distance: Number(replayTrack.distanceMeters) || 0,
        duration: Number(replayTrack.durationSeconds) || 0,
        replayMode: true,
        sourceRideId: replayTrack.sourceRideId || null,
      });
      try {
        const origin = originOverride || await getCurrentPosition();
        setUserPos(origin);
      } catch (e) {
        console.error(e);
        toast.error('Could not get GPS for replay');
      }
    } else if (dest) {
      if (destOverride) { setDestination(destOverride); setDestInput(destOverride.name); }
      try {
        const origin = originOverride || await getCurrentPosition();
        setUserPos(origin);
        await fetchRoute(origin, dest, routeWaypoints);
      } catch (e) {
        console.error(e);
        toast.error('Could not get GPS for route');
      }
    }
    if (notifyFriends && dest && user?.subscription_tier === 'premium') {
      notifyFriendsOfRide(user, dest)
        .then((n) => { if (n > 0) toast.success(`Ride invite sent to ${n} friend${n > 1 ? 's' : ''}`); })
        .catch((e) => console.error(e));
    }
  };

  const handleEndRide = async () => {
    setEnding(true);
    stopNativeLocationTracking();
    beacon.stop();
    if (crashAlertId) {
      try { await base44.entities.CrashAlert.update(crashAlertId, { status: 'resolved' }); } catch (e) { console.error(e); }
    }
    if (distressAlertId) {
      try { await base44.entities.DistressAlert.update(distressAlertId, { status: 'resolved', last_updated: new Date().toISOString() }); } catch (e) { console.error(e); }
    }
    if (watchIdRef.current) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    const mins = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
    const avg = mins > 0 ? distance / (mins / 60) : 0;
    const fuelUsed = bike ? distance * (bike.fuel_consumption_l_per_100km / 100) : 0;
    const rideData = {
      title: destination ? `Ride to ${destination.name}` : 'Free Ride',
      start_lat: positionsRef.current[0]?.[0], start_lng: positionsRef.current[0]?.[1],
      end_lat: userPos?.[0], end_lng: userPos?.[1],
      distance_km: Math.round(distance * 100) / 100, duration_minutes: mins,
      completed_at: new Date().toISOString(),
      average_speed_kmh: Math.round(avg * 10) / 10, max_speed_kmh: maxSpeed,
      fuel_consumed_l: Math.round(fuelUsed * 10) / 10,
      route_polyline: JSON.stringify(positionsRef.current), bike_id: bike?.id,
      status: 'completed', ride_date: new Date(startTimeRef.current).toISOString(),
    };
    try {
      await base44.entities.Ride.create(rideData);
      if (user) {
        await base44.auth.updateMe({
          total_distance_km: Math.round(((user.total_distance_km || 0) + distance) * 100) / 100,
          total_rides: (user.total_rides || 0) + 1,
        });
      }
      toast.success('Trip saved to Ride History');
    } catch (e) {
      console.error(e);
      savePendingRide(rideData);
      toast.error('Offline — trip will sync when reconnected');
    } finally {
      clearActiveRide();
      setRouteData(null);
      setReplayMode(false);
      setDestination(null);
      setDestInput('');
      setSpeed(0); setMaxSpeed(0); setDistance(0); setDuration(0);
      setHeading(null); setAccuracy(null); setDistressActive(false);
      crashRecoveryRef.current = null; setCrashRecovery(null);
      setCrashPhase(null); setCrashAlertId(null); setDistressAlertId(null);
      setEmergencyContactsNotified(false); setNearbyRidersNotified(false); setCrashIndicators(null);
      setSeverity('medium');
      setAutoStopCountdown(null);
      setNearbyService(null); setDismissedServiceIds(new Set());
      positionsRef.current = []; lastPosRef.current = null;
      setRideStatus('idle');
      setEnding(false);
    }
  };

  // Auto ride start — detects movement and starts a ride automatically
  const startRideRef = useRef(startRide);
  useEffect(() => { startRideRef.current = startRide; });
  useAutoRideStart({
    enabled: autoDetectEnabled && rideStatus === 'idle',
    onAutoStart: () => {
      toast.info('Ride Started Automatically');
      startRideRef.current();
    },
  });

  const lowFuel = fuelRange !== null && fuelRange < 50;
  const isActive = rideStatus === 'active';
  const rideMode = isActive && speed > 15;

  return {
    rideStatus, userPos, heading, accuracy, speed, maxSpeed, distance, duration,
    batteryLevel, fuelRemaining, fuelRange, lowFuel,
    destination, destInput, routeData, routeLoading, navProgress,
    crashPhase, crashCountdown, severity, distressActive, crashRecovery,
    autoStopCountdown, gpsWeak, ending, speedLimit, beacon,
    emergencyContactsNotified, nearbyRidersNotified, crashIndicators,
    nearbyService, voiceSupported, voiceListening,
    routeWarnings: [...routeWarnings, ...externalWarnings], reportingWarning,
    isActive, rideMode, recalculating,
    setDestInput, setDestination, setAutoStopCountdown, clearDestination,
    routePreference, setRoutePreference, replayMode,
    handleDestination, handleAddStop, handleDismissService, handleReportWarning,
    handleSimulateCrash, handleCancelCrash, handleResolveEmergency,
    handleDistress, startRide, endRide: handleEndRide,
    navigateTo: (dest, origin, routeWaypoints = [], replayTrack = null) => { startRide(dest, origin, routeWaypoints, replayTrack); },
  };
}