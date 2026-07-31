import { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Navigation, Phone, MapPin, Calendar, ExternalLink, BadgeCheck, Menu, LocateFixed, Layers, X, Compass } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapView from '@/components/MapView';
import BottomSheet from '@/components/BottomSheet';
import SearchPanel from '@/components/SearchPanel';
import CategoryMenu, { MAP_CATEGORIES } from '@/components/CategoryMenu';
import LayersSheet from '@/components/LayersSheet';
import { useMapLayer } from '@/lib/mapLayers';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ServiceDetailSheet from '@/components/services/ServiceDetailSheet';
import FriendInfoSheet from '@/components/friends/FriendInfoSheet';
import { useMapOverlays, POI_OVERLAY_MAP } from '@/lib/mapOverlays';
import { useRideSession } from '@/hooks/useRideSession';
import NavigationOverlay from '@/components/NavigationOverlay';
import { setRideActive } from '@/lib/rideStatus';
import { toast } from 'sonner';

const SA_CENTER = [-26.2041, 28.0473];
const REMOTE_CATS = {
  accommodation: { query: 'hotel', category: 'accommodation' },
  hospital: { query: 'hospital', category: 'emergency' },
  atm: { query: 'atm', category: 'atm' }
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Home() {
  const queryClient = useQueryClient();
  const [pois, setPois] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [remotePois, setRemotePois] = useState([]);
  const [distressAlerts, setDistressAlerts] = useState([]);
  const [fetchingCat, setFetchingCat] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [fitRouteSignal, setFitRouteSignal] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [selectedService, setSelectedService] = useState(null);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [layer, setLayer] = useMapLayer();
  const { overlays, toggle: toggleOverlay } = useMapOverlays();
  const [headingUp, setHeadingUp] = useState(true);
  const [notifyFriends, setNotifyFriends] = useState(true);
  const userPosRef = useRef(null);

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
    queryFn: async () => (await base44.entities.Service.filter({ status: 'approved' }, '-created_date', 200)) || []
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['map-friends'],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-friends-secure', {});
      return (res.data?.friends || []).
      filter((f) => f.lat != null && f.lng != null).
      map((f) => ({
        id: f.friend_id, user_id: f.user_id, name: f.name,
        lat: f.lat, lng: f.lng,
        speed_kmh: f.speed_kmh, heading: f.heading, battery_level: f.battery_level,
        last_updated: f.last_updated, is_distress: f.distress, phone: f.phone,
        avatar_url: f.avatar_url, is_favorite: f.is_favorite
      }));
    },
    enabled: !!me?.id,
    refetchInterval: 10000
  });

  const { data: activeGroupRide } = useQuery({
    queryKey: ['active-group-ride'],
    queryFn: async () => {
      const res = await base44.functions.invoke('get-active-group-ride-secure', {});
      return res.data;
    },
    enabled: !!me?.id,
    refetchInterval: 10000
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

  useEffect(() => {setRideActive(session.isActive);}, [session.isActive]);
  useEffect(() => {if (session.userPos) userPosRef.current = session.userPos;}, [session.userPos]);

  // Real-time friend marker updates
  const friendIdsRef = useRef(new Set());
  useEffect(() => {friendIdsRef.current = new Set(friends.map((f) => f.user_id));}, [friends]);
  useEffect(() => {
    if (!me?.id) return;
    const unsubUser = base44.entities.User.subscribe((event) => {
      if (event.type !== 'update' || !event.data?.id || !friendIdsRef.current.has(event.data.id)) return;
      queryClient.setQueryData(['map-friends'], (old = []) => old.map((f) => {
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
    const invalidateFriends = () => queryClient.invalidateQueries({ queryKey: ['map-friends'] });
    const unsubDistress = base44.entities.DistressAlert.subscribe(invalidateFriends);
    const unsubCrash = base44.entities.CrashAlert.subscribe(invalidateFriends);
    return () => {unsubUser();unsubDistress();unsubCrash();};
  }, [me?.id, queryClient]);

  // Real-time group participant marker updates
  useEffect(() => {
    if (!activeGroupRide?.active) return;
    const rideId = activeGroupRide.ride.id;
    const unsub = base44.entities.RideParticipant.subscribe((event) => {
      const p = event.data;
      if (!p || p.group_ride_id !== rideId) return;
      queryClient.setQueryData(['active-group-ride'], (old) => {
        if (!old?.active) return old;
        const parts = old.participants || [];
        if (event.type === 'delete') {
          return { ...old, participants: parts.filter((x) => x.user_id !== p.user_id) };
        }
        const idx = parts.findIndex((x) => x.user_id === p.user_id);
        let newParts;
        if (idx === -1) newParts = [...parts, p];else
        {newParts = [...parts];newParts[idx] = { ...newParts[idx], ...p };}
        return { ...old, participants: newParts };
      });
    });
    return unsub;
  }, [activeGroupRide?.active, activeGroupRide?.ride?.id, queryClient]);

  useEffect(() => {
    (async () => {
      try {
        const [poiData, eventData] = await Promise.all([
        base44.entities.POI.list('-created_date', 100),
        base44.entities.Event.filter({ status: 'approved' }, '-event_date', 50)]
        );
        setPois(poiData || []);
        setEvents(eventData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (REMOTE_CATS[activeCat]) {
      const { query, category } = REMOTE_CATS[activeCat];
      const center = userPosRef.current || SA_CENTER;
      const [lat, lng] = center;
      const viewbox = `${lng - 0.4},${lat + 0.4},${lng + 0.4},${lat - 0.4}`;
      setFetchingCat(true);
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=30&countrycodes=za&bounded=1&viewbox=${viewbox}`).
      then((r) => r.json()).
      then((data) => setRemotePois(data.map((d) => ({
        id: `remote-${d.place_id}`,
        name: d.display_name.split(',')[0],
        address: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        category,
        source: 'remote'
      })))).
      catch(() => setRemotePois([])).
      finally(() => setFetchingCat(false));
    } else if (activeCat === 'distress') {
      setFetchingCat(true);
      base44.entities.DistressAlert.filter({ status: 'active' }, '-created_date', 50).
      then(setDistressAlerts).
      catch(() => setDistressAlerts([])).
      finally(() => setFetchingCat(false));
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

  const poisToShow = activeCat === 'all' ?
  pois.filter((p) => {
    const overlayKey = POI_OVERLAY_MAP[p.category];
    return !overlayKey || overlays[overlayKey];
  }) :
  isRemoteCat ?
  remotePois :
  activeCat === 'event' || activeCat === 'distress' ?
  [] :
  pois.filter((p) => p.category === activeCat);
  const eventsToShow = (activeCat === 'all' ? overlays.events : activeCat === 'event') ? events : [];
  const distressToShow = (activeCat === 'all' ? overlays.distress : activeCat === 'distress') ? distressAlerts : [];
  const servicesToShow = overlays.services ? services : [];
  const friendsToShow = overlays.friends ? friends : [];
  const activeLabel = MAP_CATEGORIES.find((c) => c.key === activeCat)?.label || activeCat;

  const previewRoute = !isActive && session.routeData?.coordinates ? session.routeData.coordinates : null;
  const completedRoute = isActive ? session.navProgress?.completedRoute || [] : null;
  const remainingRoute = isActive ? session.navProgress?.remainingRoute || session.routeData?.coordinates || [] : null;

  const handleMyLocation = () => setRecenterSignal((s) => s + 1);
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
  const handleSearchSelect = (dest) => session.handleDestination(dest);
  const handleServiceNavigate = (service) => {
    setSelectedService(null);
    session.navigateTo({ lat: service.lat, lng: service.lng, name: service.name });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MapView
        center={session.userPos || SA_CENTER}
        zoom={12}
        layer={layer}
        recenterSignal={recenterSignal}
        fitRouteSignal={fitRouteSignal}
        pois={poisToShow}
        events={eventsToShow}
        distressAlerts={distressToShow}
        services={servicesToShow}
        showServices={overlays.services}
        onServiceClick={setSelectedService}
        friends={friendsToShow}
        showFriends={overlays.friends}
        onFriendClick={setSelectedFriend}
        onMarkerClick={setSelected}
        onSavePin={handleSavePin}
        onNavigatePin={handleNavigatePin}
        groupRiders={groupRiders}
        userPos={session.userPos}
        riders={session.userPos ? [{ id: 'me', lat: session.userPos[0], lng: session.userPos[1], heading: session.heading, accuracy: session.accuracy }] : []}
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
      

      {showIdleControls &&
      <>
          <button
          onClick={() => setSearchOpen(true)}
          className="glove-target absolute hud-left hud-top-1 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))] opacity-100"
          aria-label="Search">
          
            <Search size={22} className="text-[hsl(var(--primary))]" />
          </button>

          <button
          onClick={() => setMenuOpen(true)}
          className="glove-target absolute hud-right hud-top-1 z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))]"
          aria-label="Categories">
          
            <Menu size={22} className="text-[hsl(var(--primary))]" />
          </button>

          <button
          onClick={handleMyLocation}
          className="glove-target absolute z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))]"
          style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))', left: 'calc(1rem + env(safe-area-inset-left))' }}
          aria-label="My Location">
          
            <LocateFixed size={22} className="text-primary" />
          </button>

          <button
          onClick={() => setLayersOpen(true)}
          className="glove-target absolute z-20 flex h-14 w-14 items-center justify-center rounded-full shadow-lg backdrop-blur-lg bg-[hsl(var(--background))]"
          style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
          aria-label="Map Layers">
          
            <Layers size={22} className="text-[hsl(var(--primary))]" />
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
        setNotifyFriends={setNotifyFriends} />
      

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        pois={pois}
        events={events} />
      

      <CategoryMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeCat={activeCat}
        onSelect={handleSelectCategory} />
      

      <LayersSheet open={layersOpen} onClose={() => setLayersOpen(false)} layer={layer} onSelect={setLayer} overlays={overlays} onToggleOverlay={toggleOverlay} />

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name || selected?.title}>
        {selected &&
        <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">{selected.category}</Badge>
              {selected.is_open_24h && <Badge className="bg-green-600">24h</Badge>}
              {selected.rating && <Badge variant="outline">⭐ {selected.rating}</Badge>}
            </div>
            {selected.photo_urls?.[0] &&
          <img src={selected.photo_urls[0]} alt={selected.title} className="h-40 w-full rounded-2xl object-cover" />
          }
            {selected.photo_url &&
          <img src={selected.photo_url} alt={selected.name} className="h-40 w-full rounded-2xl object-cover" />
          }
            {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}
            <div className="space-y-2 text-sm">
              {selected.address &&
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={16} /> {selected.address}</div>
            }
              {selected.venue_name &&
            <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={16} /> {selected.venue_name}</div>
            }
              {selected.phone &&
            <div className="flex items-center gap-2 text-muted-foreground"><Phone size={16} /> {selected.phone}</div>
            }
              {selected.contact_phone &&
            <div className="flex items-center gap-2 text-muted-foreground"><Phone size={16} /> {selected.contact_phone}</div>
            }
              {selected.event_date &&
            <div className="flex items-center gap-2 text-muted-foreground"><Calendar size={16} /> {formatDate(selected.event_date)}</div>
            }
              {selected.entry_fee_zar != null &&
            <div className="flex items-center gap-2 text-muted-foreground"><BadgeCheck size={16} /> {selected.entry_fee_zar === 0 ? 'Free entry' : `R${selected.entry_fee_zar} entry`}</div>
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
    </div>);

}