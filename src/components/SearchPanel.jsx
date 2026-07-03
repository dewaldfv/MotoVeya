import { useState, useRef, useEffect } from 'react';
import { Search, X, MapPin, Navigation, Fuel, UtensilsCrossed, Beer, Wrench, Bike, Mountain, Flag, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const QUICK_FILTERS = [
  { label: 'Fuel', icon: Fuel, query: 'fuel station' },
  { label: 'Food', icon: UtensilsCrossed, query: 'restaurant' },
  { label: 'Pubs', icon: Beer, query: 'pub' },
  { label: 'Events', icon: Flag, key: 'event' },
];

function getIcon(item) {
  if (item.event_date) return Flag;
  const map = { fuel: Fuel, food: UtensilsCrossed, pub: Beer, workshop: Wrench, dealership: Bike, scenic: Mountain };
  return map[item.category] || MapPin;
}

export default function SearchPanel({ open, onClose, onSelect, pois, events }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setResults([]);
      setQuery('');
      setActiveFilter(null);
    }
  }, [open]);

  const doNominatimSearch = async (q) => {
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=15&countrycodes=za&addressdetails=1`);
      const data = await res.json();
      return data.map((d) => ({
        name: d.display_name.split(',')[0],
        address: d.display_name,
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        category: 'place',
        source: 'remote',
      }));
    } catch (e) {
      console.error(e);
      return [];
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    if (activeFilter?.key === 'event') {
      setResults(events || []);
      return;
    }
    if (activeFilter?.query) {
      doNominatimSearch(activeFilter.query).then(setResults);
      return;
    }
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const q = query.toLowerCase();
    const localMatches = [
      ...(pois || []).filter((p) => p.name?.toLowerCase().includes(q) || p.category?.toLowerCase().includes(q) || p.address?.toLowerCase().includes(q)),
      ...(events || []).filter((e) => e.title?.toLowerCase().includes(q) || e.venue_name?.toLowerCase().includes(q)),
    ];
    const handler = setTimeout(() => {
      doNominatimSearch(query).then((remote) => {
        setResults([...localMatches, ...remote]);
      });
    }, 400);
    return () => clearTimeout(handler);
  }, [query, activeFilter, open, pois, events]);

  const handleSelect = (item) => {
    const name = item.name || item.title;
    onSelect({ lat: item.lat, lng: item.lng, name });
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background" style={{ animation: 'fadeIn 0.2s ease-out' }}>
      <div className="flex items-center gap-3 border-b border-border p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <Search size={22} className="text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveFilter(null); }}
          placeholder="Search destinations, places, events..."
          className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <button onClick={onClose} className="glove-target flex items-center justify-center rounded-full bg-secondary">
          <X size={20} />
        </button>
      </div>

      <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-border p-3">
        {QUICK_FILTERS.map((f) => {
          const Icon = f.icon;
          const isActive = activeFilter?.label === f.label;
          return (
            <button
              key={f.label}
              onClick={() => setActiveFilter(isActive ? null : f)}
              className={`flex min-h-[44px] items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors ${
                isActive ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
              }`}
            >
              <Icon size={16} /> {f.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {searching && (
          <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
            <Loader2 size={20} className="animate-spin" /> Searching...
          </div>
        )}
        {!searching && results.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <Search size={40} className="text-muted-foreground" />
            <p className="text-muted-foreground">{query ? 'No results found.' : 'Search for places, or use a quick filter.'}</p>
          </div>
        )}
        {!searching && results.length > 0 && (
          <div className="space-y-2">
            {results.map((item, idx) => {
              const Icon = getIcon(item);
              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(item)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left transition-colors active:bg-secondary"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{item.name || item.title}</p>
                    {(item.address || item.venue_name) && (
                      <p className="truncate text-sm text-muted-foreground">{item.address || item.venue_name}</p>
                    )}
                  </div>
                  <Navigation size={18} className="shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <style>{`@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>
    </div>
  );
}