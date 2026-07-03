import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Navigation, Fuel, Phone, MapPin, Calendar, ExternalLink, BadgeCheck } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import MapView from '@/components/MapView';
import BottomSheet from '@/components/BottomSheet';

const CATEGORIES = [
  { key: 'all', label: 'All', emoji: '🌐' },
  { key: 'fuel', label: 'Fuel', emoji: '⛽' },
  { key: 'food', label: 'Food', emoji: '🍽️' },
  { key: 'pub', label: 'Pubs', emoji: '🍺' },
  { key: 'workshop', label: 'Workshop', emoji: '🔧' },
  { key: 'dealership', label: 'Dealer', emoji: '🏍️' },
  { key: 'scenic', label: 'Scenic', emoji: '🏔️' },
  { key: 'event', label: 'Events', emoji: '🏁' },
];

const formatDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });

export default function Home() {
  const navigate = useNavigate();
  const [pois, setPois] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [activeCat, setActiveCat] = useState('all');
  const [userPos, setUserPos] = useState(null);

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
        (pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  const filteredPois = activeCat === 'all' || activeCat === 'event' ? pois : pois.filter((p) => p.category === activeCat);
  const showEvents = activeCat === 'all' || activeCat === 'event';
  const isEvent = !!selected?.event_date;

  const handleDirections = (item) => {
    setSelected(null);
    navigate('/ride/active', { state: { destination: { lat: item.lat, lng: item.lng, name: item.name || item.title } } });
  };

  return (
    <div className="relative h-screen w-full overflow-hidden">
      <MapView
        center={userPos || [-26.2041, 28.0473]}
        zoom={12}
        pois={filteredPois}
        events={showEvents ? events : []}
        riders={userPos ? [{ id: 'me', lat: userPos[0], lng: userPos[1] }] : []}
        onMarkerClick={setSelected}
        className="absolute inset-0 z-0 h-full w-full"
      />

      <div className="absolute left-4 right-4 top-4 z-10">
        <div className="flex items-center gap-2 rounded-2xl bg-card/95 px-4 py-3.5 shadow-lg backdrop-blur-lg">
          <Search size={20} className="text-muted-foreground" />
          <input
            placeholder="Search destination..."
            className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => { if (e.key === 'Enter' && e.target.value) { navigate('/ride/active', { state: { searchText: e.target.value } }); } }}
          />
        </div>
      </div>

      <div className="absolute left-4 right-4 top-[72px] z-10">
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setActiveCat(cat.key)}
              className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
                activeCat === cat.key ? 'bg-primary text-primary-foreground' : 'bg-card/90 text-muted-foreground'
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => navigate('/ride/active')} className="fab flex flex-col items-center justify-center gap-0.5">
        <Navigation size={26} fill="white" />
        <span className="text-[10px] font-bold tracking-wide">RIDE</span>
      </button>

      {loading && (
        <div className="absolute bottom-24 right-6 z-10 flex h-8 w-8 items-center justify-center">
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
    </div>
  );
}