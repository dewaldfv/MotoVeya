import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, X } from 'lucide-react';

export default function LocationSearchInput({ placeholder, value, onSelect, onClear }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 3) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=6&countrycodes=za&addressdetails=1`);
        const data = await res.json();
        setResults(data.map((d) => ({
          name: d.display_name.split(',')[0],
          address: d.display_name,
          lat: parseFloat(d.lat),
          lng: parseFloat(d.lon),
        })));
      } catch (e) { setResults([]); } finally { setSearching(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [query]);

  const handlePick = (r) => {
    onSelect({ lat: r.lat, lng: r.lng, name: r.name, address: r.address });
    setQuery(r.name);
    setOpen(false);
    setResults([]);
  };

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-2 rounded-xl bg-black/30 px-3 py-3">
        <MapPin size={18} className="shrink-0 text-primary" />
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        {searching && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
        {query && !searching && (
          <button onClick={() => { setQuery(''); onClear?.(); setResults([]); }} className="text-muted-foreground">
            <X size={16} />
          </button>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl bg-card shadow-xl ring-1 ring-border">
          {results.map((r, i) => (
            <button key={i} onClick={() => handlePick(r)} className="flex w-full items-start gap-2 px-3 py-2.5 text-left active:bg-secondary">
              <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{r.name}</p>
                <p className="truncate text-xs text-muted-foreground">{r.address}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}