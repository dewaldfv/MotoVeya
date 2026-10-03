import { useState, useEffect, useRef, useMemo } from 'react';
import { Navigation, Phone, MapPin, ExternalLink, LocateFixed, Layers, X, Compass } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapView from '@/components/MapView';
import BottomSheet from '@/components/BottomSheet';
import { MAP_CATEGORIES } from '@/components/CategoryMenu';
import MapControlSheet from '@/components/MapControlSheet';
import { useMapLayer } from '@/lib/mapLayers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ServiceDetailSheet from '@/components/services/ServiceDetailSheet';
import FriendInfoSheet from '@/components/friends/FriendInfoSheet';
import { useMapOverlays, POI_OVERLAY_MAP } from '@/lib/mapOverlays';
import { useRideSession } from '@/hooks/useRideSession';
import { useIdleMapUi, revealMapUi } from '@/hooks/useIdleMapUi';
import NavigationOverlay from '@/components/NavigationOverlay';
import TutorialWalkthrough from '@/components/TutorialWalkthrough';
import SavedPlaceDialog from '@/components/SavedPlaceDialog';
import { setRideActive } from '@/lib/rideStatus';
import {
  getPendingNavigation,
  clearPendingNavigation,
  getMapDataCache,
  saveMapDataCache,
} from '@/lib/rideCache';
import { toast } from 'sonner';

const SA_CENTER = [-26.2041, 28.0473];
const REMOTE_CATS = {
  accommodation: { query: 'hotel', category: 'accommodation' },
  hospital: { query: 'hospital', category: 'emergency' },
  atm: { query: 'atm', category: 'atm' }
};

const FOOD_SERVICE_CATEGORIES = new Set([
  'food_restaurant', 'food_pub_bar', 'food_cafe', 'food_fast_food',
  'food_breakfast', 'food_bakery', 'food_market'
]);

const formatDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Home() {
  const queryClient = useQueryClient();
  const [pois, setPois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [remotePois, setRemotePois] = useState([]);
  const [distressAlerts, setDistressAlerts] = useState([]);
  const [fetchingCat, setFetchingCat] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [compassResetSignal, setCompassResetSignal] = useState(0);
  const [locationLocked, setLocationLocked] = useState(false);
  const [fitRouteSignal, setFitRouteSignal] = useState(0);
  const [controlOpen, setControlOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroupPlace, setSelectedGroupPlace] = useState(null);
  const [editSavedPlace, setEditSavedPlace] = useState(null);
  const [showTutorial, setShowTutorial] = useState(() => localStorage.getItem('motogo_show_tutorial') === 'true' && localStorage.getItem('motogo_tutorial_done') !== 'true');
  const [layer, setLayer, rawLayer] = useMapLayer();
  const { overlays, toggle: toggleOverlay } = useMapOverlays();
  const [headingUp, setHeadingUp] = useState(true);
  const [notifyFriends, setNotifyFriends] = useState(true);
  const [savedPlacePosition, setSavedPlacePosition] = useState(null);
  const [deferMapData, setDeferMapData] = useState(false);
  const userPosRef = useRef(null);
  const { visible: mapUiVisible, toggle: toggleMapUi } = useIdleMapUi();

  useEffect(() => { revealMapUi(); }, []);

  useEffect(() => {
    // Give Google Maps and the first GPS render priority. Heavy map feeds load shortly after.
    const timer = window.setTimeout(() => setDeferMapData(true), 900);
    return () => window.clearTimeout(timer);
  }, []);

  const handleScreenTap = (e) => {
    if (e.target.closest('button, a, [role="button"], [data-ui-control], .fixed, [data-sheet]')) {
      revealMapUi();
      return;
    }
    toggleMapUi();
  };

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await base44.auth.isAuthenticated()) ? base44.auth.me() : null
  });

  const { data: bikeData } = useQuery({
    queryKey: ['primary-bike'],
    queryFn: async () => {
      const bikes = await base44.entities.Bike.filter({ is_primary: true }, '-created_date', 1);
      let bike = bikes[0];
      if (!bike) {const all = await base44.entities.Bike.list('-created_date', 1);bike = all[0];}
      return bike || null;
    },
    enabled: !!me?.id
  });

  const { data: fuelProfile } = useQuery({
    queryKey: ['fuel-profile', bikeData?.id],
    queryFn: async () => {
      if (!bikeData?.id) return null;
      const profiles = await base44.entities.FuelProfile.filter({ bike_id: bikeData.id }, '-last_calculated', 1);
      return profiles[0] || null;
    },
    enabled: !!bikeData?.id
  });

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const data = (await base44.entities.Service.filter({ status: 'approved' }, '-created_date', 100)) || [];
      saveMapDataCache('services', data);
      return data;
    },
    initialData: () => getMapDataCache('services') || undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: deferMapData,
  });

  const { data: eventData = null } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const data = (await base44.entities.Event.list('event_date', 100)) || [];
      saveMapDataCache('events', data);
      return data;
    },
    initialData: () => getMapDataCache('events') || undefined,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: deferMapData,
  });

  const { data: eventFavoriteIds = [] } = useQuery({
    queryKey: ['event-favorites'],
    queryFn: async () => (await base44.entities.EventFavorite.filter({})).map((f) => f.event_id),
    enabled: !!me?.id && deferMapData
  });

  const { data: visiblePlaces } = useQuery({
    queryKey: ['visible-saved-places', me?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-visible-saved-places', {});
      return { own: res.data?.own || [], group: res.data?.group || [] };
    },
    enabled: !!me?.id && deferMapData,
    refetchInterval: 30000
  });
  const savedLayerOn = overlays.saved !== false;
  const ownSavedPlaces = visiblePlaces?.own || [];
  const groupSavedPlaces = visiblePlaces?.group || [];

  const { data: friends = [] } = useQuery({
    queryKey: ['map-friends', me?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-friends-secure', {});
      const data = (res.data?.friends || [])
        .filter((f) => f.lat != null && f.lng != null)
        .map((f) => ({
          id: f.friend_id, user_id: f.user_id, name: f.name,
          lat: f.lat, lng: f.lng,
          speed_kmh: f.speed_kmh, heading: f.heading, battery_level: f.battery_level,
          last_updated: f.last_updated, is_distress: f.distress, phone: f.phone,
          avatar_url: f.avatar_url, is_favorite: f.is_favorite
        }));
      saveMapDataCache('friends:' + me?.id, data, 60 * 1000);
      return data;
    },
    initialData: () => me?.id ? (getMapDataCache('friends:' + me.id) || undefined) : undefined,
    staleTime: 30 * 1000,
    gcTime: 10 * 60 * 1000,
    enabled: !!me?.id && deferMapData,
    refetchInterval: 10000,
  });

  const { data: activeGroupRide } = useQuery({
    queryKey: ['active-group-ride', me?.id],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-active-group-ride-secure', {});
      const data = res.data;
      if (me?.id) saveMapDataCache('active-group-ride:' + me.id, data, 30 * 1000);
      return data;
    },
    initialData: () => me?.id ? (getMapDataCache('active-group-ride:' + me.id) || undefined) : undefined,
    staleTime: 10 * 1000,
    gcTime: 2 * 60 * 1000,
    enabled: !!me?.id && deferMapData,
    refetchInterval: 10000,
  });

  const groupRiders = useMemo(() => {
    if (!activeGroupRide?.active) return [];
    return (activeGroupRide.participants || []).
    filter((p) => p.user_id !== me?.id && p.lat != null && p.lng != null);
  }, [activeGroupRide, me?.id]);

  const session = useRideSession({
    user: me,
    bike: bikeData,
    fuelProfile,
    services,
    autoDetectEnabled: localStorage.getItem('motogo_auto_ride_detection') !== 'false',
    notifyFriends
  });

  // Geofence checks now run server-side inside update-my-location and
  // update-rider-location-native, so every location ping triggers transitions.

  // Universal Rider Down feed: every signed-in rider receives active alerts
  // within 20 km of their current GPS position, regardless of subscription.
  const { data: nearbyRiderDown = [] } = useQuery({
    queryKey: ['nearby-rider-down', session.userPos?.[0], session.userPos?.[1]],
    queryFn: async () => {
      const pos = session.userPos;
      if (!pos) return [];
      const res = await base44.functions.invoke('get-nearby-rider-down', { lat: pos[0], lng: pos[1] });
      return res.data?.alerts || [];
    },
    enabled: !!me?.id && !!session.userPos && deferMapData,
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const seenRiderDownRef = useRef(new Set());
  useEffect(() => {
    for (const alert of nearbyRiderDown) {
      if (alert.rider_id === me?.id || seenRiderDownRef.current.has(alert.id)) continue;
      seenRiderDownRef.current.add(alert.id);
      toast.error(`RIDER DOWN — ${alert.rider_name || 'A rider'} is ${alert.distance_from_rider_km ?? 'nearby'} km away`, {
        duration: 8000,
      });
    }
  }, [nearbyRiderDown, me?.id]);

  // Fuel stations are a dedicated map layer backed by OpenStreetMap/Overpass.
  // Fetch a broad rider radius once a usable position is available so the Home map
  // has real fuel coverage without reintroducing the removed POI system.
  const fuelCenter = session.userPos || SA_CENTER;
  const fuelCenterKey = fuelCenter ? `${Number(fuelCenter[0]).toFixed(2)},${Number(fuelCenter[1]).toFixed(2)}` : 'default';
  const { data: fuelStations = [] } = useQuery({
    queryKey: ['fuel-stations', fuelCenterKey],
    queryFn: async () => {
      const [lat, lng] = fuelCenter;
      const res = await base44.functions.invoke('get-fuel-stations', { lat, lng, radius: 25000 });
      const data = res.data?.stations || [];
      saveMapDataCache('fuel-stations:' + fuelCenterKey, data, 10 * 60 * 1000);
      return data;
    },
    enabled: deferMapData && overlays.fuel && Number.isFinite(Number(fuelCenter?.[0])) && Number.isFinite(Number(fuelCenter?.[1])),
    initialData: () => getMapDataCache('fuel-stations:' + fuelCenterKey) || undefined,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {setRideActive(session.isActive);}, [session.isActive]);
  useEffect(() => {if (session.userPos) userPosRef.current = session.userPos;}, [session.userPos]);

  // Pick up navigation planned on the Rides tab
  useEffect(() => {
    const pending = getPendingNavigation();
    if (pending?.dest) {
      clearPendingNavigation();
      const start = pending.start ? [pending.start.lat, pending.start.lng] : undefined;
      if (pending.autoStart) {
        session.navigateTo(pending.dest, start);
      } else {
        session.handleDestination(pending.dest);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Free OSM/Overpass POI seeding: once per device per day, import a local rider area
  // into MotoVeya's own POI database. This avoids paid Places APIs and builds coverage organically.
  useEffect(() => {
    if (!me?.id || !session.userPos) return;
    const key = 'motoveya_osm_seed_at';
    const last = Number(localStorage.getItem(key) || 0);
    if (Date.now() - last < 24 * 60 * 60 * 1000) return;
    const [lat, lng] = session.userPos;
    base44.functions.invoke('import-osm-pois', { lat, lng, radius: 15000 })
      .then(() => { try { localStorage.setItem(key, String(Date.now())); } catch {} })
      .catch((e) => console.error('OSM POI seed:', e));
  }, [me?.id, session.userPos?.[0], session.userPos?.[1]]);

  // Real-time friend marker updates
  const friendIdsRef = useRef(new Set());
  useEffect(() => {friendIdsRef.current = new Set(friends.map((f) => f.user_id));}, [friends]);
  useEffect(() => {
    if (!me?.id) return;
    const unsubUser = base44.entities.User.subscribe((event) => {
      if (event.type !== 'update' || !event.data?.id || !friendIdsRef.current.has(event.data.id)) return;
      queryClient.setQueryData(['map-friends', me.id], (old = []) => old.map((f) => {
        if (f.user_id !== event.data.id) return f;
        const d = event.data;
        return {
          ...f,
          lat: 'last_lat' in d ? d.last_lat : f.lat,
          lng: 'last_lng' in d ? d.last_lng : f.lng,
          speed_kmh: 'last_speed_kmh' in d ? d.last_speed_kmh : f.speed_kmh,
          heading: 'last_heading' in d ? d.last_heading : f.heading,
          battery_level: 'battery_level' in d ? d.battery_level : f.battery_level,
          last_updated: 'last_location_updated' in d ? d.last_location_updated : f.last_updated
        };
      }));
    });
    return () => {unsubUser();};
  }, [me?.id, queryClient]);

  // Live group state is refreshed by the authorization-checked active-ride query.
  // Do not subscribe directly to private RideParticipant records.

  // Legacy POI records are not rendered by MapView, so avoid fetching them during
  // Home initialization. This removes an unnecessary database request.
  useEffect(() => {
    setLoading(false);
  }, []);

  useEffect(() => {
    if (REMOTE_CATS[activeCat]) {
      const { query, category } = REMOTE_CATS[activeCat];
      const center = userPosRef.current || SA_CENTER;
      const [lat, lng] = center;
      setFetchingCat(true);
      base44.functions.invoke('search-osm-pois', { lat, lng, category, radius: 15000, query })
      .then((res) => setRemotePois(res.data?.pois || []))
      .catch(() => setRemotePois([]))
      .finally(() => setFetchingCat(false));
    } else if (activeCat === 'distress') {
      setFetchingCat(false);
    } else {
      setRemotePois([]);
      setDistressAlerts([]);
    }
  }, [activeCat]);

  // Fit route preview when a new route is calculated (idle mode)
  useEffect(() => {
    if (!session.isActive && session.routeData) {
      setFitRouteSignal((s) => s + 1);
    }
  }, [session.routeData, session.isActive]);

  const isRemoteCat = !!REMOTE_CATS[activeCat];
  const isActive = session.isActive;
  const hasDestination = !!session.destination;
  const showIdleControls = !isActive && !hasDestination;

  // Memoize the marker datasets so they keep a stable reference across the frequent
  // session/location re-renders — this stops static map pins from re-rendering on every tick.
  const poisWithMarkers = useMemo(() => pois, [pois]);
  const poisToShow = useMemo(() =>
    activeCat === 'all'
      ? poisWithMarkers.filter((p) => p.is_active !== false).filter((p) => { const k = POI_OVERLAY_MAP[p.category]; return !k || overlays[k]; })
      : isRemoteCat ? remotePois
      : activeCat === 'distress' ? []
      : poisWithMarkers.filter((p) => p.is_active !== false && p.category === activeCat),
    [poisWithMarkers, remotePois, activeCat, isRemoteCat, overlays]);
  const distressToShow = useMemo(() => {
    const alerts = nearbyRiderDown.length ? nearbyRiderDown : distressAlerts;
    return (activeCat === 'all' ? overlays.distress : activeCat === 'distress') ? alerts : [];
  }, [nearbyRiderDown, distressAlerts, activeCat, overlays]);
  // Services and Food & Drink share the Service entity, but remain independently
  // controlled by their map layers.
  const servicesToShow = useMemo(() => services.filter((service) =>
    FOOD_SERVICE_CATEGORIES.has(service.category) ? overlays.food : overlays.services
  ), [services, overlays]);
  const friendsToShow = useMemo(() => (overlays.friends ? friends : []), [friends, overlays]);
  const eventsToShow = useMemo(() => (overlays.events ? (Array.isArray(eventData) ? eventData : []).filter((e) => e.lat != null && e.lng != null) : []), [eventData, overlays]);
  const activeLabel = MAP_CATEGORIES.find((c) => c.key === activeCat)?.label || activeCat;

  const previewRoute = !isActive && session.routeData?.coordinates ? session.routeData.coordinates : null;
  const completedRoute = isActive ? session.navProgress?.completedRoute || [] : null;
  const remainingRoute = isActive ? session.navProgress?.remainingRoute || session.routeData?.coordinates || [] : null;

  // Fuel stops ahead of the rider. Stations are matched to the active route
  // corridor instead of simply showing the nearest station in a circle.
  const routeFuelStops = useMemo(() => {
    if (!isActive || !session.userPos || !remainingRoute?.length || !fuelStations.length) return [];
    const route = remainingRoute;
    const candidates = [];
    const maxCorridorKm = 2.0;
    const maxAheadKm = 120;

    // Build cumulative distance along the remaining route.
    const cumulative = [0];
    for (let i = 1; i < route.length; i++) {
      cumulative[i] = cumulative[i - 1] + haversine(route[i - 1][0], route[i - 1][1], route[i][0], route[i][1]);
    }

    for (const station of fuelStations) {
      const slat = Number(station.lat), slng = Number(station.lng);
      if (!Number.isFinite(slat) || !Number.isFinite(slng)) continue;

      let best = { distance: Infinity, index: 0 };
      for (let i = 0; i < route.length; i += 3) {
        const d = haversine(slat, slng, route[i][0], route[i][1]);
        if (d < best.distance) best = { distance: d, index: i };
      }
      const aheadKm = cumulative[best.index] ?? Infinity;
      if (best.distance > maxCorridorKm || aheadKm < 0.2 || aheadKm > maxAheadKm) continue;

      // This is deliberately labelled as an estimate: it represents the
      // approximate extra travel caused by leaving and rejoining the route.
      const detourKm = Math.max(0.1, best.distance * 2);
      const riderDistanceKm = haversine(slat, slng, session.userPos[0], session.userPos[1]);

      candidates.push({
        ...station,
        distance_ahead_km: Math.round(aheadKm * 10) / 10,
        distance_from_rider_km: Math.round(riderDistanceKm * 10) / 10,
        estimated_detour_km: Math.round(detourKm * 10) / 10,
        route_offset_km: Math.round(best.distance * 10) / 10,
      });
    }

    return candidates
      .sort((a, b) => (a.distance_ahead_km + a.estimated_detour_km * 2) - (b.distance_ahead_km + b.estimated_detour_km * 2))
      .slice(0, 5);
  }, [isActive, session.userPos, remainingRoute, fuelStations]);

  const handleMyLocation = () => {
    // The location button is a pure "Return to Current Location" action.
    // It never locks the Home map or changes the user's ability to pan/zoom.
    setRecenterSignal((s) => s + 1);
  };

  const handleCompassReset = () => {
    setCompassResetSignal((s) => s + 1);
  };
  const handleSelectCategory = (key) => {setActiveCat(key);setSelected(null);};
  const handleDirections = (item) => {
    setSelected(null);
    session.navigateTo({ lat: item.lat, lng: item.lng, name: item.name || item.title });
  };
  const handleSavePin = (item) => {
    toast.success(`${item.name || item.title || item.rider_name || 'Location'} saved to favourites`);
  };
  const handleNavigatePin = (item) => {
    session.navigateTo({ lat: item.lat, lng: item.lng, name: item.name || item.title || item.rider_name || 'Destination' });
  };
  const handleMapLongPress = (position) => {
    if (!me?.id || isActive) return;
    setSavedPlacePosition(position);
  };

  const handleSavedPlaceCreated = () => {
    queryClient.invalidateQueries({ queryKey: ['visible-saved-places', me?.id] });
  };

  const handleServiceNavigate = (service) => {
    setSelectedService(null);
    session.navigateTo({ lat: service.lat, lng: service.lng, name: service.name });
  };

  const handleCloseTutorial = () => setShowTutorial(false);

  return (
    <div className="relative h-screen w-full overflow-hidden" onClick={handleScreenTap}>
      <MapView
        center={session.userPos || SA_CENTER}
        zoom={15}
        layer={layer}
        recenterSignal={recenterSignal}
        compassResetSignal={compassResetSignal}
        fitRouteSignal={fitRouteSignal}
        locationLocked={locationLocked}
        pois={poisToShow}
        events={eventsToShow}
        favoriteEventIds={eventFavoriteIds}
        distressAlerts={distressToShow}
        routeWarnings={session.routeWarnings}
        services={servicesToShow}
        showServices={overlays.services || overlays.food}
        fuelStations={overlays.fuel ? fuelStations : []}
        onServiceClick={setSelectedService}
        friends={friendsToShow}
        showFriends={overlays.friends}
        onFriendClick={setSelectedFriend}
        onLongPress={handleMapLongPress}
        savedPlaces={ownSavedPlaces}
        groupSavedPlaces={groupSavedPlaces}
        showSavedPlaces={savedLayerOn}
        onSavedPlaceClick={setEditSavedPlace}
        onGroupPlaceClick={setSelectedGroupPlace}
        onMarkerClick={setSelected}
        onSavePin={handleSavePin}
        onNavigatePin={handleNavigatePin}
        groupRiders={groupRiders}
        userPos={session.userPos}
        riders={session.userPos ? [{ id: 'me', lat: session.userPos[0], lng: session.userPos[1], heading: session.heading, accuracy: session.accuracy, isCrashRecovery: !!session.crashRecovery?.active }] : []}
        navActive={isActive}
        heading={session.heading}
        headingUp={headingUp}
        speed={session.speed}
        nextManeuverDistance={session.navProgress?.distanceToManeuver}
        completedRoute={completedRoute}
        remainingRoute={remainingRoute}
        route={previewRoute}
        destination={session.destination}
        className="absolute inset-0 z-0 h-full w-full" />
      

      {showIdleControls && mapUiVisible &&
      <>
          <button
          onClick={() => setControlOpen(true)}
          className="glove-target absolute hud-right hud-top-1 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))]"
          aria-label="Map controls">

            <Layers size={22} className="text-[hsl(var(--primary))]" />
          </button>

          <button
          onClick={handleMyLocation}
          className="glove-target absolute z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))]"
          style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))', left: 'calc(1rem + env(safe-area-inset-left))' }}
          aria-label="Return to current location"
          title="Return to current location">
          <LocateFixed size={22} className="text-[hsl(var(--primary))]" />
          </button>

          <button
          onClick={handleCompassReset}
          className="glove-target absolute z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))]"
          style={{ bottom: 'calc(10.5rem + env(safe-area-inset-bottom))', left: 'calc(1rem + env(safe-area-inset-left))' }}
          aria-label="Reset map to north"
          title="Reset map to north">
          <Compass size={22} className="text-[hsl(var(--primary))]" />
          </button>

          {activeCat !== 'all' &&
        <button
          onClick={() => handleSelectCategory('all')}
          className="absolute z-20 flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-lg"
          style={{ top: 'calc(1.6rem + env(safe-area-inset-top))', left: 'calc(4.5rem + 1.25rem)' }}>
          
              {activeLabel} <X size={13} />
            </button>
        }
        </>
      }

      {isActive && !session.rideMode &&
      <button
        onClick={() => setHeadingUp((v) => !v)}
        className="glove-target absolute hud-right hud-top-1 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"
        aria-label="Toggle heading up">
        
          <Compass size={22} className={headingUp ? 'text-primary' : 'text-foreground'} />
        </button>
      }

      {(loading || fetchingCat || session.routeLoading) &&
      <div className="absolute z-10 flex h-8 w-8 items-center justify-center" style={{ bottom: 'calc(7rem + env(safe-area-inset-bottom))', right: 'calc(1.5rem + env(safe-area-inset-right))' }}>
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      }

      <NavigationOverlay
        session={session}
        user={me}
        bike={bikeData}
        notifyFriends={notifyFriends}
        setNotifyFriends={setNotifyFriends}
        routeFuelStops={routeFuelStops} />
      

      <MapControlSheet
        open={controlOpen}
        onClose={() => setControlOpen(false)}
        activeCat={activeCat}
        onSelectCategory={handleSelectCategory}
        layer={rawLayer}
        onSelectLayer={setLayer}
        overlays={overlays}
        onToggleOverlay={toggleOverlay} />

      <BottomSheet
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name || selected?.title}
        backgroundImage={selected?.photo_urls?.[0] || selected?.photo_url}
        immersive={!!(selected?.photo_urls?.[0] || selected?.photo_url)}
      >
        {selected &&
        <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{selected.category}</Badge>
              {selected.is_open_24h && <Badge className="bg-green-600">24h</Badge>}
              {selected.rating && <Badge variant="outline">⭐ {selected.rating}</Badge>}
            </div>
            {selected.description && <p className="text-sm leading-6 text-white/85">{selected.description}</p>}
            <div className="space-y-2 text-sm">
              {selected.address &&
            <div className="flex items-center gap-2 text-white/75"><MapPin size={16} /> {selected.address}</div>
            }
              {selected.venue_name &&
            <div className="flex items-center gap-2 text-white/75"><MapPin size={16} /> {selected.venue_name}</div>
            }
              {selected.phone &&
            <div className="flex items-center gap-2 text-white/75"><Phone size={16} /> {selected.phone}</div>
            }
              {selected.contact_phone &&
            <div className="flex items-center gap-2 text-white/75"><Phone size={16} /> {selected.contact_phone}</div>
            }
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="lg" className="min-h-[56px] flex-1 text-base" onClick={() => handleDirections(selected)}>
                <Navigation size={18} className="mr-2" /> Get Directions
              </Button>
              {selected.booking_link &&
            <Button size="lg" variant="secondary" className="min-h-[56px] px-5" onClick={() => window.open(selected.booking_link, '_blank')}>
                  <ExternalLink size={18} />
                </Button>
            }
            </div>
          </div>
        }
      </BottomSheet>

      <ServiceDetailSheet service={selectedService} userPos={session.userPos}
      isFavorite={false} onNavigate={handleServiceNavigate} onClose={() => setSelectedService(null)} />

      <FriendInfoSheet friend={selectedFriend} userPos={session.userPos}
      onClose={() => setSelectedFriend(null)}
      onNavigate={(f) => {
        setSelectedFriend(null);
        session.navigateTo({ lat: f.lat, lng: f.lng, name: f.name });
      }} />

      {savedPlacePosition && <SavedPlaceDialog position={savedPlacePosition} user={me} onClose={() => setSavedPlacePosition(null)} onSaved={handleSavedPlaceCreated} />}

      {editSavedPlace && <SavedPlaceDialog editPlace={editSavedPlace} user={me} onClose={() => setEditSavedPlace(null)} onSaved={handleSavedPlaceCreated} />}

      <BottomSheet open={!!selectedGroupPlace} onClose={() => setSelectedGroupPlace(null)} title={selectedGroupPlace?.name}>
        {selectedGroupPlace && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">📍 Saved Place</Badge>
              {selectedGroupPlace.owner_name && <Badge variant="outline">{selectedGroupPlace.owner_name}</Badge>}
            </div>
            <p className="text-sm text-white/75">{Number(selectedGroupPlace.radius_m || 1000) >= 1000 ? Number(selectedGroupPlace.radius_m) / 1000 + ' km' : selectedGroupPlace.radius_m + ' m'} geofence radius</p>
            <Button size="lg" className="min-h-[56px] w-full" onClick={() => { const p = selectedGroupPlace; setSelectedGroupPlace(null); session.navigateTo({ lat: p.lat, lng: p.lng, name: p.name }); }}>
              <Navigation size={18} className="mr-2" /> Navigate Here
            </Button>
          </div>
        )}
      </BottomSheet>

      <TutorialWalkthrough open={showTutorial} onClose={handleCloseTutorial} />
    </div>);

}