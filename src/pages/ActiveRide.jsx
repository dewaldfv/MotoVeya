import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Navigation, AlertTriangle, X, Fuel, Search, ChevronLeft, Layers, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import NavMapView from '@/components/NavMapView';
import NavigationCard from '@/components/NavigationCard';
import Speedometer from '@/components/Speedometer';
import NavActionButtons from '@/components/NavActionButtons';
import EmergencyOverlay from '@/components/EmergencyOverlay';
import { useCrashDetection, requestMotionPermission } from '@/hooks/useCrashDetection';
import { useEmergencyBeacon } from '@/hooks/useEmergencyBeacon';
import { useEmergencyCancellation } from '@/hooks/useEmergencyCancellation';
import { useAutoRideStop } from '@/hooks/useAutoRideStop';
import AutoStopCountdown from '@/components/AutoStopCountdown';
import { useBackgroundTracking } from '@/hooks/useBackgroundTracking';
import { saveRideState, getActiveRide, clearActiveRide, savePendingRide, getPendingRides, clearPendingRide } from '@/lib/rideCache';
import { cacheEmergencyData, getPendingEmergency, clearPendingEmergency } from '@/lib/emergencyCache';
import LayersSheet from '@/components/LayersSheet';
import { processRouteData, getRouteProgress, haversine } from '@/lib/navigation';
import { getServiceCategory, formatDistance } from '@/lib/serviceCategories';
import { toast } from 'sonner';

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

export default function ActiveRide() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialDest = location.state?.destination;
  const initialSearch = location.state?.searchText;

  const [user, setUser] = useState(null);
  const [bike, setBike] = useState(null);
  const [userPos, setUserPos] = useState(null);
  const [speed, setSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fuelRemaining, setFuelRemaining] = useState(null);
  const [fuelRange, setFuelRange] = useState(null);
  const [fuelProfile, setFuelProfile] = useState(null);
  const [destInput, setDestInput] = useState(initialSearch || '');
  const [destination, setDestination] = useState(initialDest || null);
  const [routeData, setRouteData] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [crashCountdown, setCrashCountdown] = useState(null);
  const [distressActive, setDistressActive] = useState(false);
  const [crashPhase, setCrashPhase] = useState(null);
  const [crashAlertId, setCrashAlertId] = useState(null);
  const [emergencyContactsNotified, setEmergencyContactsNotified] = useState(false);
  const [nearbyRidersNotified, setNearbyRidersNotified] = useState(false);
  const [crashIndicators, setCrashIndicators] = useState(null);
  const [severity, setSeverity] = useState('medium');
  const [batteryLevel, setBatteryLevel] = useState(null);
  const [autoStopCountdown, setAutoStopCountdown] = useState(null);
  const [ending, setEnding] = useState(false);
  const [heading, setHeading] = useState(null);
  const [accuracy, setAccuracy] = useState(null);
  const [rideStatus, setRideStatus] = useState('idle');
  const [layer, setLayer] = useState('standard');
  const [layersOpen, setLayersOpen] = useState(false);
  const [services, setServices] = useState([]);
  const [nearbyService, setNearbyService] = useState(null);
  const [dismissedServiceIds, setDismissedServiceIds] = useState(new Set());

  const lastPosRef = useRef(null);
  const positionsRef = useRef([]);
  const startTimeRef = useRef(Date.now());
  const watchIdRef = useRef(null);
  const timerRef = useRef(null);
  const lastRecalcRef = useRef(0);
  const beacon = useEmergencyBeacon();

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) return;
        const me = await base44.auth.me();
        setUser(me);
        const bikes = await base44.entities.Bike.filter({ is_primary: true }, '-created_date', 1);
        let primaryBike = bikes[0];
        if (!primaryBike) { const allBikes = await base44.entities.Bike.list('-created_date', 1); primaryBike = allBikes[0]; }
        if (primaryBike) {
          setBike(primaryBike);
          try {
            const profiles = await base44.entities.FuelProfile.filter({ bike_id: primaryBike.id }, '-last_calculated', 1);
            if (profiles.length > 0) setFuelProfile(profiles[0]);
          } catch (e) { console.error(e); }
        }
      } catch (e) { console.error(e); }
    })();
  }, []);

  useEffect(() => {
    if (initialDest) handleDestination(initialDest);
    else if (initialSearch) { setDestInput(initialSearch); handleSearch(initialSearch); }
  }, []);

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
      setRideStatus('active');
      toast.info('Resuming active ride');
      return;
    } else if (cached) {
      clearActiveRide();
    }
    if (!location.state?.autoStart) return;
    if (localStorage.getItem('motogo_auto_ride_detection') === 'false') return;
    toast.info('Ride Started Automatically');
    handleStartRide();
  }, []);

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

  useEffect(() => {
    if (rideStatus !== 'active' || !navigator.geolocation) return;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        markGpsUpdate();
        const newPos = [pos.coords.latitude, pos.coords.longitude, pos.coords.altitude];
        setUserPos(newPos);
        positionsRef.current.push(newPos);
        if (pos.coords.heading != null && !isNaN(pos.coords.heading)) setHeading(pos.coords.heading);
        if (pos.coords.accuracy != null) setAccuracy(pos.coords.accuracy);
        const spd = pos.coords.speed != null && pos.coords.speed > 0 ? pos.coords.speed * 3.6 : 0;
        setSpeed(Math.round(spd));
        setMaxSpeed((prev) => (spd > prev ? Math.round(spd) : prev));
        if (lastPosRef.current) {
          const d = haversine(lastPosRef.current[0], lastPosRef.current[1], newPos[0], newPos[1]);
          if (d > 0.005) setDistance((prev) => prev + d);
        }
        lastPosRef.current = newPos;
      },
      () => {},
      gpsConfig
    );
    watchIdRef.current = watchId;
    return () => { navigator.geolocation.clearWatch(watchId); watchIdRef.current = null; };
  }, [rideStatus, gpsConfig]);

  useEffect(() => {
    if (rideStatus !== 'active') return;
    const timer = setInterval(() => setDuration((d) => d + 1), 1000);
    timerRef.current = timer;
    return () => { clearInterval(timer); timerRef.current = null; };
  }, [rideStatus]);

  useEffect(() => {
    if (navigator.getBattery) {
      navigator.getBattery().then((b) => {
        setBatteryLevel(Math.round(b.level * 100));
        const update = () => setBatteryLevel(Math.round(b.level * 100));
        b.addEventListener('levelchange', update);
      }).catch(() => {});
    }
  }, []);

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

  useEffect(() => {
    if (crashCountdown === null) return;
    if (crashCountdown <= 0) { handleCrashConfirmed(); return; }
    const t = setTimeout(() => setCrashCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [crashCountdown]);

  useCrashDetection({
    enabled: rideStatus === 'active',
    speed,
    onCrashDetected: (data) => {
      setCrashIndicators(data.indicators);
      setSeverity(data.severity);
      if (data.severity === 'high') {
        handleCrashConfirmed(data.severity);
      } else {
        setCrashCountdown(data.severity === 'medium' ? 15 : 30);
        setCrashPhase('countdown');
      }
    },
  });

  useAutoRideStop({
    enabled: localStorage.getItem('motogo_auto_ride_detection') !== 'false',
    isActive: rideStatus === 'active',
    speed,
    userPos,
    onPromptStop: () => setAutoStopCountdown(30),
    isCountingDown: autoStopCountdown !== null,
  });

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

  useEffect(() => {
    if (crashPhase !== 'active' || !crashAlertId || !userPos) return;
    const interval = setInterval(async () => {
      try {
        await base44.functions.invoke('update-emergency-location', {
          alert_id: crashAlertId,
          lat: userPos[0],
          lng: userPos[1],
        });
      } catch (e) { console.error(e); }
    }, 10000);
    return () => clearInterval(interval);
  }, [crashPhase, crashAlertId, userPos]);

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

  const navProgress = useMemo(() => {
    if (!routeData || !userPos) return null;
    return getRouteProgress(routeData, userPos);
  }, [routeData, userPos]);

  useEffect(() => {
    if (rideStatus !== 'active' || !routeData || !destination || !userPos) return;
    const route = routeData.coordinates;
    let minDist = Infinity;
    for (let i = 0; i < route.length; i += 3) {
      const d = haversine(userPos[0], userPos[1], route[i][0], route[i][1]);
      if (d < minDist) minDist = d;
    }
    if (minDist > 0.2 && Date.now() - lastRecalcRef.current > 30000) {
      lastRecalcRef.current = Date.now();
      (async () => {
        try {
          const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${userPos[1]},${userPos[0]};${destination.lng},${destination.lat}?overview=full&geometries=geojson&steps=true`);
          const data = await res.json();
          if (data.routes?.[0]) {
            setRouteData(processRouteData(data));
            toast.info('Off route — recalculating...');
          }
        } catch (e) { console.error(e); }
      })();
    }
  }, [userPos, rideStatus, routeData, destination]);

  useEffect(() => {
    (async () => {
      try {
        const svcData = await base44.entities.Service.filter({ status: 'approved' }, '-created_date', 200);
        setServices(svcData || []);
      } catch (e) { console.error(e); }
    })();
  }, []);

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

  const fetchRoute = async (origin, dest) => {
    setRouteLoading(true);
    try {
      const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${origin[1]},${origin[0]};${dest.lng},${dest.lat}?overview=full&geometries=geojson&steps=true`);
      const data = await res.json();
      if (data.routes?.[0]) {
        setRouteData(processRouteData(data));
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not calculate route');
    } finally {
      setRouteLoading(false);
    }
  };

  const handleSearch = async (query) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=za`);
      const data = await res.json();
      if (data.length > 0) {
        const dest = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon), name: data[0].display_name.split(',')[0] };
        handleDestination(dest);
      } else {
        toast.error('Location not found');
      }
    } catch (e) {
      console.error(e);
      toast.error('Search failed');
    }
  };

  const handleDestination = async (dest) => {
    setDestination(dest);
    setDestInput(dest.name);
    try {
      const origin = await getCurrentPosition();
      setUserPos(origin);
      await fetchRoute(origin, dest);
    } catch (e) {
      console.error(e);
      toast.error('Could not get your location. Enable GPS and try again.');
    }
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

  const handleCrashConfirmed = async (overrideSeverity) => {
    const sev = overrideSeverity || severity;
    setCrashCountdown(null);
    setCrashPhase('active');
    beacon.start();
    const pos = userPos || SA_CENTER;
    const emergencyData = {
      lat: pos[0], lng: pos[1],
      rider_name: user?.nickname || user?.full_name || 'Rider',
      is_premium: user?.subscription_tier === 'premium',
      indicators: crashIndicators,
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
    toast.error('Could not reach emergency services. Will retry when connected.');
    setDistressActive(true);
  };

  const handleResolveEmergency = async () => {
    beacon.stop();
    if (crashAlertId) {
      try { await base44.entities.CrashAlert.update(crashAlertId, { status: 'resolved' }); } catch (e) { console.error(e); }
    }
    setCrashPhase(null);
    setCrashAlertId(null);
    setDistressActive(false);
    setEmergencyContactsNotified(false);
    setNearbyRidersNotified(false);
    setCrashIndicators(null);
    setSeverity('medium');
  };

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
      await base44.entities.DistressAlert.create({
        rider_id: user?.id, rider_name: user?.nickname || user?.full_name || 'Rider',
        lat: pos[0], lng: pos[1], timestamp: new Date().toISOString(),
        status: 'active', reason: 'Manual distress signal',
        last_lat: pos[0], last_lng: pos[1], last_updated: new Date().toISOString(),
      });
      setDistressActive(true);
    } catch (e) { console.error(e); }
  };

  const handleStartRide = async () => {
    await requestMotionPermission();
    setSpeed(0); setMaxSpeed(0); setDistance(0); setDuration(0);
    setHeading(null); setAccuracy(null); setDistressActive(false);
    positionsRef.current = []; lastPosRef.current = null;
    startTimeRef.current = Date.now();
    setRideStatus('active');
    if (destination) {
      try {
        const origin = await getCurrentPosition();
        setUserPos(origin);
        await fetchRoute(origin, destination);
      } catch (e) {
        console.error(e);
        toast.error('Could not get GPS for route');
      }
    }
  };

  const handleEndRide = async () => {
    setEnding(true);
    beacon.stop();
    if (crashAlertId) {
      try { await base44.entities.CrashAlert.update(crashAlertId, { status: 'resolved' }); } catch (e) { console.error(e); }
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
      setDestination(null);
      setDestInput('');
      setSpeed(0); setMaxSpeed(0); setDistance(0); setDuration(0);
      setHeading(null); setAccuracy(null); setDistressActive(false);
      setCrashPhase(null); setCrashAlertId(null);
      setEmergencyContactsNotified(false); setNearbyRidersNotified(false); setCrashIndicators(null);
      setSeverity('medium');
      setAutoStopCountdown(null);
      setNearbyService(null); setDismissedServiceIds(new Set());
      positionsRef.current = []; lastPosRef.current = null;
      setRideStatus('idle');
      setEnding(false);
    }
  };

  const lowFuel = fuelRange !== null && fuelRange < 50;
  const isActive = rideStatus === 'active';

  return (
    <div className="relative h-screen w-full overflow-hidden bg-background">
      <NavMapView
        userPos={userPos}
        heading={heading}
        accuracy={accuracy}
        active={isActive}
        speed={speed}
        nextManeuverDistance={navProgress?.distanceToManeuver}
        remainingRoute={navProgress?.remainingRoute || routeData?.coordinates}
        completedRoute={navProgress?.completedRoute || []}
        destination={destination}
        layer={layer}
      />

      {isActive ? (
        <>
          {navProgress?.nextStep && (
            <NavigationCard
              step={navProgress.nextStep}
              distanceToManeuver={navProgress.distanceToManeuver}
              remainingDistance={navProgress.remainingDistance}
              remainingDuration={navProgress.remainingDuration}
              destinationName={destination?.name}
            />
          )}
          {routeLoading && !navProgress?.nextStep && (
            <div className="absolute left-3 right-3 z-20 flex items-center gap-2 rounded-2xl bg-card/95 p-3 shadow-xl backdrop-blur-lg landscape:max-w-md" style={{ top: 'calc(0.75rem + env(safe-area-inset-top))' }}>
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-sm font-medium">Calculating route...</span>
            </div>
          )}
          {nearbyService && (
            <div className="absolute left-3 right-3 z-[15] landscape:max-w-sm landscape:mx-auto" style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))' }}>
              <div className="mx-auto flex max-w-sm items-center gap-2 rounded-2xl bg-card/95 p-2.5 shadow-xl backdrop-blur-lg">
                <span className="text-xl">{getServiceCategory(nearbyService.category).emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold">{nearbyService.name}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {getServiceCategory(nearbyService.category).short} · {formatDistance(userPos ? haversine(nearbyService.lat, nearbyService.lng, userPos[0], userPos[1]) : null)} off route
                  </p>
                </div>
                <button onClick={() => handleAddStop(nearbyService)} className="shrink-0 rounded-lg bg-primary px-2.5 py-1.5 text-[11px] font-bold text-primary-foreground">Add Stop</button>
                <button onClick={handleDismissService} className="shrink-0"><X size={16} className="text-muted-foreground" /></button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent p-3 pb-8" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <div className="flex items-center gap-2 landscape:max-w-md">
            <button onClick={() => navigate('/')} className="glove-target flex items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg">
              <ChevronLeft size={24} />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-card/95 px-4 py-2.5 shadow-lg backdrop-blur-lg">
              {routeLoading ? <Loader2 size={18} className="animate-spin text-muted-foreground" /> : <Search size={18} className="text-muted-foreground" />}
              <input
                value={destInput}
                onChange={(e) => setDestInput(e.target.value)}
                placeholder="Where to?"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => { if (e.key === 'Enter' && destInput) handleSearch(destInput); }}
              />
              {destInput && (
                <button onClick={() => { setDestInput(''); setDestination(null); setRouteData(null); }}>
                  <X size={16} className="text-muted-foreground" />
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <button
        onClick={() => setLayersOpen(true)}
        className="glove-target absolute right-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"
        style={{ top: isActive ? 'calc(0.75rem + env(safe-area-inset-top))' : 'calc(4.5rem + env(safe-area-inset-top))' }}
        aria-label="Map Layers"
      >
        <Layers size={20} className="text-foreground" />
      </button>

      <LayersSheet open={layersOpen} onClose={() => setLayersOpen(false)} layer={layer} onSelect={setLayer} />

      {isActive && (
        <div className="absolute bottom-5 hud-left z-10 flex flex-col items-center gap-1.5">
          <Speedometer speed={speed} />
          {gpsWeak && (
            <div className="flex items-center gap-1 rounded-full bg-amber-500/90 px-2 py-0.5 text-xs font-bold text-white shadow-lg">
              GPS Weak
            </div>
          )}
          {fuelRange !== null && (
            <div className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold shadow-lg ${lowFuel ? 'bg-destructive text-white animate-pulse' : 'bg-card/95 text-foreground'}`}>
              <Fuel size={10} /> {fuelRange}km
            </div>
          )}
        </div>
      )}

      {isActive ? (
        <div className="absolute bottom-5 hud-right z-10">
          <NavActionButtons
            onDistress={handleDistress}
            onCrash={handleSimulateCrash}
            onEnd={handleEndRide}
            distressActive={distressActive}
            ending={ending}
            disabled={!user || user.subscription_tier !== 'premium'}
          />
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/60 to-transparent p-4 pt-10">
          <button
            onClick={handleStartRide}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground shadow-lg transition-transform active:scale-95 landscape:max-w-xs landscape:mx-auto"
          >
            <Navigation size={22} fill="white" /> START
          </button>
        </div>
      )}

      <AutoStopCountdown
        countdown={autoStopCountdown}
        onEnd={handleEndRide}
        onContinue={() => setAutoStopCountdown(null)}
      />

      <EmergencyOverlay
        phase={crashPhase}
        severity={severity}
        countdown={crashCountdown}
        onCancel={handleCancelCrash}
        onResolve={handleResolveEmergency}
        emergencyNumber="112"
        contactNotified={emergencyContactsNotified}
        nearbyNotified={nearbyRidersNotified}
        riderName={user?.nickname || user?.full_name}
        location={userPos}
        incidentInfo={{
          speed,
          heading,
          batteryLevel,
          bikeMake: bike?.make,
          bikeModel: bike?.model,
          bikeYear: bike?.year,
        }}
        beaconActive={beacon.isActive}
        audioEnabled={beacon.audioEnabled}
        onToggleAudio={beacon.toggleAudio}
        voiceSupported={voiceSupported}
        voiceListening={voiceListening}
      />
    </div>
  );
}