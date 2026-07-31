import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Search, Filter, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import RideHistoryCard from '@/components/rides/RideHistoryCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function RideHistory() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [bikeFilter, setBikeFilter] = useState('all');
  const [distFilter, setDistFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  const { data: rides = [], isLoading } = useQuery({
    queryKey: ['rides-history'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      return (await base44.entities.Ride.filter({ status: 'completed' }, '-ride_date', 200)) || [];
    },
  });

  const { data: bikes = [] } = useQuery({
    queryKey: ['bikes-list'],
    queryFn: async () => (await base44.entities.Bike.list('-created_date', 50)) || [],
  });

  const filtered = useMemo(() => {
    let list = [...rides];
    const q = query.toLowerCase();
    if (q) {
      list = list.filter((r) =>
        (r.title || '').toLowerCase().includes(q) ||
        (r.start_location_name || '').toLowerCase().includes(q) ||
        (r.end_location_name || '').toLowerCase().includes(q)
      );
    }
    if (bikeFilter !== 'all') list = list.filter((r) => r.bike_id === bikeFilter);
    if (distFilter !== 'all') {
      list = list.filter((r) => {
        const d = r.distance_km || 0;
        if (distFilter === 'short') return d < 50;
        if (distFilter === 'medium') return d >= 50 && d < 200;
        if (distFilter === 'long') return d >= 200;
        return true;
      });
    }
    if (dateFilter !== 'all') {
      const now = new Date();
      list = list.filter((r) => {
        const d = new Date(r.ride_date || r.created_date);
        if (dateFilter === 'week') { const wk = new Date(now); wk.setDate(now.getDate() - 7); return d >= wk; }
        if (dateFilter === 'month') { const mo = new Date(now); mo.setMonth(now.getMonth() - 1); return d >= mo; }
        if (dateFilter === 'year') { const yr = new Date(now); yr.setFullYear(now.getFullYear() - 1); return d >= yr; }
        return true;
      });
    }
    return list;
  }, [rides, query, bikeFilter, distFilter, dateFilter]);

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-background/90 px-4 backdrop-blur" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate('/rides')} className="glove-target flex items-center justify-center rounded-full bg-card">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-xl font-bold">Ride History</h1>
      </div>

      <div className="px-4">
        <div className="flex items-center gap-2 rounded-2xl bg-card px-3">
          <Search size={16} className="text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search rides..."
            className="flex-1 bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && <button onClick={() => setQuery('')}><X size={16} className="text-muted-foreground" /></button>}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-2">
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="bg-card"><Filter size={13} className="mr-1" /><SelectValue placeholder="Date" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All dates</SelectItem>
              <SelectItem value="week">Last week</SelectItem>
              <SelectItem value="month">Last month</SelectItem>
              <SelectItem value="year">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Select value={bikeFilter} onValueChange={setBikeFilter}>
            <SelectTrigger className="bg-card"><SelectValue placeholder="Bike" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All bikes</SelectItem>
              {bikes.map((b) => <SelectItem key={b.id} value={b.id}>{b.make} {b.model}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={distFilter} onValueChange={setDistFilter}>
            <SelectTrigger className="bg-card"><SelectValue placeholder="Distance" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Any</SelectItem>
              <SelectItem value="short">&lt; 50 km</SelectItem>
              <SelectItem value="medium">50–200 km</SelectItem>
              <SelectItem value="long">200+ km</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-16"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
            <p className="text-muted-foreground">No rides match your filters.</p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0">
            {filtered.map((r) => <RideHistoryCard key={r.id} ride={r} />)}
          </div>
        )}
      </div>
    </div>
  );
}