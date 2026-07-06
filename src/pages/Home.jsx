import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Navigation, Phone, MapPin, Calendar, ExternalLink, BadgeCheck, Menu, LocateFixed, Layers, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapView from '@/components/MapView';
import BottomSheet from '@/components/BottomSheet';
import SearchPanel from '@/components/SearchPanel';
import CategoryMenu, { MAP_CATEGORIES } from '@/components/CategoryMenu';
import LayersSheet from '@/components/LayersSheet';
import { useMapLayer } from '@/lib/mapLayers';
import { useQuery } from '@tanstack/react-query';
import ServiceDetailSheet from '@/components/services/ServiceDetailSheet';
import { useMapOverlays, POI_OVERLAY_MAP } from '@/lib/mapOverlays';

const SA_CENTER = [-26.2041, 28.0473];
const REMOTE_CATS = {
  accommodation: { query: 'hotel', category: 'accommodation' },
  hospital: { query: 'hospital', category: 'emergency' },
  atm: { query: 'atm', category: 'atm' },
};

const formatDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Home() {
  const navigate = useNavigate();
  const [pois, setPois] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [userPos, setUserPos] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [remotePois, setRemotePois] = useState([]);
  const [distressAlerts, setDistressAlerts] = useState([]);
  const [fetchingCat, setFetchingCat] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const userPosRef = useRef(null);
  const [layer, setLayer] = useMapLayer();
  const [layersOpen, setLayersOpen] = useState(false);
  const { overlays, toggle: toggleOverlay } = useMapOverlays();
  const [selectedService, setSelectedService] = useState(null);

  const { data: services = [] } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await base44.entities.Service.filter({ status: 'approved' }, '-created_date', 200)) || [],
  });

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await base44.auth.isAuthenticated() ? base44.auth.me() : null),
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['map-friends'],
    queryFn: async () => {
      const accepted = await base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 100);
      return (accepted || [])
        .filter((f) => f.location_shared && f.last_lat != null)
        .map((f) => {
          const isRequester = f.requester_id === me?.id;
          return {
            id: f.id,
            user_id: isRequester ? f.recipient_id : f.requester_id,
            name: isRequester ? f.recipient_name : f.requester_name,
            lat: f.last_lat,
            lng: f.last_lng,
          };
        });
    },
    enabled: !!me?.id,
  });

  useEffect(() => {
    (async () => {
      try {
        const [poiData, eventData] = await Promise.all([
          base44.entities.POI.list('-created_date', 100),
          base44.entities.Event.filter({ status: 'approved' }, '-event_date', 50),
        ]);
        setPois(poiData || []);
        setEvents(eventData || []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    })();
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = [pos.coords.latitude, pos.coords.longitude];
          userPosRef.current = p;
          setUserPos(p);
        },
        () => {}
      );
    }
  }, []);

  const isRemoteCat = !!REMOTE_CATS[activeCat];
  const poisToShow = activeCat === 'all'
    ? pois.filter((p) => {
        const overlayKey = POI_OVERLAY_MAP[p.category];
        return !overlayKey || overlays[overlayKey];
      })
    : isRemoteCat
      ? remotePois
      : activeCat === 'event' || activeCat === 'distress'
        ? []
        : pois.filter((p) => p.category === activeCat);
  const eventsToShow = (activeCat === 'all' ? overlays.events : activeCat === 'event') ? events : [];
  const distressToShow = (activeCat === 'all' ? overlays.distress : activeCat === 'distress') ? distressAlerts : [];
  const servicesToShow = overlays.services ? services : [];
  const friendsToShow = overlays.friends ? friends : [];
  const isEvent = !!selected?.event_date;
  const activeLabel = MAP_CATEGORIES.find((c) => c.key === activeCat)?.label || activeCat;

  useEffect(() => {
    if (REMOTE_CATS[activeCat]) {
      const { query, category } = REMOTE_CATS[activeCat];
      const center = userPosRef.current || SA_CENTER;
      const [lat, lng] = center;
      const viewbox = `${lng - 0.4},${lat + 0.4},${lng + 0.4},${lat - 0.4}`;
      setFetchingCat(true);
      fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=30&countrycodes=za&bounded=1&viewbox=${viewbox}`)
        .then((r) => r.json())
        .then((data) => setRemotePois(data.map((d) => ({
          id: `remote-${d.place_id}`,
          name: d.display_name.split(',')[0],
          address: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
          category,
          source: 'remote',
        }))))
        .catch(() => setRemotePois([]))
        .finally(() => setFetchingCat(false));
    } else if (activeCat === 'distress') {
      setFetchingCat(true);
      base44.entities.DistressAlert.filter({ status: 'active' }, '-created_date', 50)
        .then(setDistressAlerts)
        .catch(() => setDistressAlerts([]))
        .finally(() => setFetchingCat(false));
    } else {
      setRemotePois([]);
      setDistressAlerts([]);
    }
  }, [activeCat]);

  const handleMyLocation = () => {
    if (userPos) {
      setRecenterSignal((s) => s + 1);
    } else if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const p = [pos.coords.latitude, pos.coords.longitude];
          userPosRef.current = p;
          setUserPos(p);
        },
        () => {}
      );
    }
  };

  const handleSelectCategory = (key) => {
    setActiveCat(key);
    setSelected(null);
  };

  const handleDirections = (item) => {
    setSelected(null);
    navigate('/ride/active', { state: { destination: { lat: item.lat, lng: item.lng, name: item.name || item.title } } });
  };

  const handleSearchSelect = (dest) => {
    navigate('/ride/active', { state: { destination: dest } });
  };

  const handleServiceNavigate = (service) => {
    setSelectedService(null);
    navigate('/ride/active', { state: { destination: { lat: service.lat, lng: service.lng, name: service.name } } });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MapView
        center={userPos || SA_CENTER}
        zoom={12}
        layer={layer}
        recenterSignal={recenterSignal}
        pois={poisToShow}
        events={eventsToShow}
        distressAlerts={distressToShow}
        services={servicesToShow}
        showServices={overlays.services}
        onServiceClick={setSelectedService}
        friends={friendsToShow}
        showFriends={overlays.friends}
        onFriendClick={(f) => navigate(`/rider/${f.user_id}`)}
        userPos={userPos}
        riders={userPos ? [{ id: 'me', lat: userPos[0], lng: userPos[1] }] : []}
        followRider={false}
        onMarkerClick={setSelected}
        className="absolute inset-0 z-0 h-full w-full"
      />

      <button
        onClick={() => setSearchOpen(true)}
        className="glove-target absolute hud-left hud-top-1 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"
        aria-label="Search"
      >
        <Search size={22} className="text-foreground" />
      </button>

      {activeCat !== 'all' && (
        <button
          onClick={() => handleSelectCategory('all')}
          className="absolute z-20 flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-lg"
          style={{ top: 'calc(1.6rem + env(safe-area-inset-top))', left: 'calc(4.5rem + 1.25rem)' }}
        >
          {activeLabel} <X size={13} />
        </button>
      )}

      <button
        onClick={() => setMenuOpen(true)}
        className="glove-target absolute hud-right hud-top-1 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"
        aria-label="Categories"
      >
        <Menu size={22} className="text-foreground" />
      </button>

      <button
        onClick={handleMyLocation}
        className="glove-target absolute hud-right hud-top-2 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"
        aria-label="My Location"
      >
        <LocateFixed size={22} className="text-primary" />
      </button>

      <button
        onClick={() => setLayersOpen(true)}
        className="glove-target absolute hud-right hud-top-3 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg"
        aria-label="Map Layers"
      >
        <Layers size={22} className="text-foreground" />
      </button>

      <SearchPanel
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSelect={handleSearchSelect}
        pois={pois}
        events={events}
      />

      <CategoryMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        activeCat={activeCat}
        onSelect={handleSelectCategory}
      />

      <LayersSheet open={layersOpen} onClose={() => setLayersOpen(false)} layer={layer} onSelect={setLayer} overlays={overlays} onToggleOverlay={toggleOverlay} />

      {(loading || fetchingCat) && (
        <div className="absolute bottom-24 hud-right z-10 flex h-8 w-8 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      )}

      <BottomSheet open={!!selected} onClose={() => setSelected(null)} title={selected?.name || selected?.title}>
        {selected && (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="capitalize">
                {isEvent ? selected.category : selected.category}
              </Badge>
              {selected.is_open_24h && <Badge className="bg-green-600">24h</Badge>}
              {selected.rating && <Badge variant="outline">⭐ {selected.rating}</Badge>}
            </div>

            {selected.photo_urls?.[0] && (
              <img src={selected.photo_urls[0]} alt={selected.title} className="h-40 w-full rounded-2xl object-cover" />
            )}
            {selected.photo_url && (
              <img src={selected.photo_url} alt={selected.name} className="h-40 w-full rounded-2xl object-cover" />
            )}

            {selected.description && <p className="text-sm text-muted-foreground">{selected.description}</p>}

            <div className="space-y-2 text-sm">
              {selected.address && (
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={16} /> {selected.address}</div>
              )}
              {selected.venue_name && (
                <div className="flex items-center gap-2 text-muted-foreground"><MapPin size={16} /> {selected.venue_name}</div>
              )}
              {selected.phone && (
                <div className="flex items-center gap-2 text-muted-foreground"><Phone size={16} /> {selected.phone}</div>
              )}
              {selected.contact_phone && (
                <div className="flex items-center gap-2 text-muted-foreground"><Phone size={16} /> {selected.contact_phone}</div>
              )}
              {selected.event_date && (
                <div className="flex items-center gap-2 text-muted-foreground"><Calendar size={16} /> {formatDate(selected.event_date)}</div>
              )}
              {selected.entry_fee_zar != null && (
                <div className="flex items-center gap-2 text-muted-foreground"><BadgeCheck size={16} /> {selected.entry_fee_zar === 0 ? 'Free entry' : `R${selected.entry_fee_zar} entry`}</div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button size="lg" className="min-h-[56px] flex-1 text-base" onClick={() => handleDirections(selected)}>
                <Navigation size={18} className="mr-2" /> Get Directions
              </Button>
              {selected.booking_link && (
                <Button size="lg" variant="secondary" className="min-h-[56px] px-5" onClick={() => window.open(selected.booking_link, '_blank')}>
                  <ExternalLink size={18} />
                </Button>
              )}
            </div>
          </div>
        )}
      </BottomSheet>

      <ServiceDetailSheet service={selectedService} userPos={userPos}
        isFavorite={false} onNavigate={handleServiceNavigate} onClose={() => setSelectedService(null)} />
    </div>
  );
}