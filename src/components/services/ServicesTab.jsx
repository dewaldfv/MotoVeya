import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2, MapPin, RefreshCw, Locate } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { FILTER_CHIPS, getCategoryConfig } from '@/lib/serviceCategories';
import ServicesMap from './ServicesMap';
import ServiceCard from './ServiceCard';
import ServiceDetailSheet from './ServiceDetailSheet';
import RadiusDrawer from './RadiusDrawer';

export default function ServicesTab() {
  const [userPos, setUserPos] = useState(null);
  const [locationError, setLocationError] = useState(null);
  const [search, setSearch] = useState('');
  const [activeFilter, setActiveFilter] = useState('All');
  const [radius, setRadius] = useState(50);
  const [radiusOpen, setRadiusOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [fitTrigger, setFitTrigger] = useState(0);

  useEffect(() => {
    if (!navigator.geolocation) { setLocationError('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setFitTrigger((t) => t + 1);
      },
      (err) => setLocationError(err.message || 'Location access denied'),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }, []);

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['nearby-services', userPos, radius],
    queryFn: async () => {
      const res = await base44.functions.invoke('nearby-services', { lat: userPos[0], lng: userPos[1], radius });
      return res.data;
    },
    enabled: !!userPos,
    staleTime: 5 * 60 * 1000,
  });

  const services = data?.services || [];

  const filtered = services.filter((s) => {
    const matchesFilter = activeFilter === 'All' || getCategoryConfig(s.category).filter === activeFilter;
    const q = search.toLowerCase();
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      (s.address && s.address.toLowerCase().includes(q)) ||
      getCategoryConfig(s.category).label.toLowerCase().includes(q);
    return matchesFilter && matchesSearch;
  });

  const relocate = () => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setUserPos([pos.coords.latitude, pos.coords.longitude]);
        setFitTrigger((t) => t + 1);
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-2xl bg-card px-3 py-2.5">
        <Search size={18} className="text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, town, category..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {FILTER_CHIPS.map((chip) => (
          <button
            key={chip}
            onClick={() => setActiveFilter(chip)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activeFilter === chip ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
            }`}
          >
            {chip}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => setRadiusOpen(true)}
          className="flex items-center gap-1 rounded-full bg-card px-3 py-1.5 text-xs font-medium"
        >
          <MapPin size={12} /> {radius}km
        </button>
        <span className="text-xs text-muted-foreground">{filtered.length} found</span>
        <button onClick={() => refetch()} className="rounded-full bg-card p-2">
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} />
        </button>
      </div>

      {locationError ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <MapPin size={32} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{locationError}. Enable location to find nearby services.</p>
        </div>
      ) : !userPos || isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <MapPin size={32} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No services found. Try increasing the radius or changing filters.</p>
        </div>
      ) : (
        <>
          <div className="relative h-[300px] overflow-hidden rounded-2xl">
            <ServicesMap services={filtered} userPos={userPos} onSelect={setSelected} fitTrigger={fitTrigger} />
            <button
              onClick={relocate}
              className="absolute bottom-3 right-3 z-[1000] flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-lg"
            >
              <Locate size={18} />
            </button>
          </div>

          <div className="space-y-2">
            {filtered.map((s) => (
              <ServiceCard key={s.id} service={s} onClick={() => setSelected(s)} />
            ))}
          </div>
        </>
      )}

      <RadiusDrawer open={radiusOpen} onClose={() => setRadiusOpen(false)} radius={radius} onSelect={setRadius} />
      <ServiceDetailSheet service={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  );
}