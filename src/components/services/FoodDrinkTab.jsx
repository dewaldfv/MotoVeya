import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, ChevronLeft, X, Loader2, UtensilsCrossed, List, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { savePendingNavigation } from '@/lib/rideCache';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ServiceListingCard from './ServiceListingCard';
import ServiceDetailSheet from './ServiceDetailSheet';
import ServiceFilters from './ServiceFilters';
import ServiceSubmitDialog from './ServiceSubmitDialog';
import { haversine, isOpenNow } from '@/lib/serviceCategories';
import { toast } from 'sonner';

const FOOD_CATEGORIES = [
  { key: 'restaurant', label: 'Restaurants', emoji: '🍽️' },
  { key: 'pub_bar', label: 'Pubs & Bars', emoji: '🍺' },
  { key: 'cafe', label: 'Cafés', emoji: '☕' },
  { key: 'fast_food', label: 'Fast Food', emoji: '🍔' },
  { key: 'breakfast', label: 'Breakfast Spots', emoji: '🥓' },
  { key: 'bakery', label: 'Bakeries', emoji: '🥐' },
  { key: 'food_market', label: 'Food Markets', emoji: '🌮' },
];

function getFoodCategory(key) {
  return FOOD_CATEGORIES.find((c) => c.key === key) || FOOD_CATEGORIES[0];
}

export default function FoodDrinkTab({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [filters, setFilters] = useState({ distance: null, rating: null, openNow: false, verified: false, premiumPartner: false });
  const [userPos, setUserPos] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]), () => {});
  }, []);

  const { data: places = [], isLoading } = useQuery({
    queryKey: ['food-drink'],
    queryFn: async () => {
      const all = (await base44.entities.Service.filter({ status: 'approved' }, '-created_date', 300)) || [];
      return all.filter((s) => FOOD_CATEGORIES.some((c) => s.category === `food_${c.key}` || s.category === c.key || s.business_type === c.key || s.service_type === c.key));
    },
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['food-drink-favorites'],
    queryFn: async () => user ? ((await base44.entities.ServiceFavorite.filter({ user_id: user.id }, '-created_date', 200)) || []) : [],
    enabled: !!user,
  });
  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.service_id)), [favorites]);

  const filtered = useMemo(() => {
    let result = places;
    if (selectedCategory && !showAll) result = result.filter((s) => s.category === selectedCategory || s.category === `food_${selectedCategory}` || s.business_type === selectedCategory || s.service_type === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) => [s.name, s.description, s.town, s.province, s.address, s.category].some((v) => v?.toLowerCase().includes(q)));
    }
    if (filters.distance != null && userPos) result = result.filter((s) => haversine(userPos[0], userPos[1], s.lat, s.lng) <= filters.distance);
    if (filters.rating != null) result = result.filter((s) => (s.rating || 0) >= filters.rating);
    if (filters.openNow) result = result.filter(isOpenNow);
    if (filters.verified) result = result.filter((s) => s.is_verified);
    if (filters.premiumPartner) result = result.filter((s) => s.is_premium_partner);
    if (userPos) result = [...result].sort((a, b) => haversine(userPos[0], userPos[1], a.lat, a.lng) - haversine(userPos[0], userPos[1], b.lat, b.lng));
    return result;
  }, [places, selectedCategory, showAll, searchQuery, filters, userPos]);

  const handleFavorite = async (place) => {
    if (!user) { toast.error('Log in to save favorites'); return; }
    try {
      const fav = favorites.find((f) => f.service_id === place.id);
      if (fav) await base44.entities.ServiceFavorite.delete(fav.id);
      else await base44.entities.ServiceFavorite.create({ service_id: place.id, service_name: place.name, user_id: user.id });
      queryClient.invalidateQueries({ queryKey: ['food-drink-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['service-favorites'] });
    } catch { toast.error('Could not update favorites'); }
  };

  const handleDirections = (place) => {
    setSelectedPlace(null);
    savePendingNavigation({ dest: { lat: place.lat, lng: place.lng, name: place.name } });
    navigate('/');
  };
  const handleNavigate = (place) => {
    setSelectedPlace(null);
    savePendingNavigation({ dest: { lat: place.lat, lng: place.lng, name: place.name }, autoStart: true });
    navigate('/');
  };
  const handleSelect = (place) => setSelectedPlace(place);
  const handleBack = () => { setSelectedCategory(null); setSearchQuery(''); setShowAll(false); };
  const hasSearchOrCategory = !!selectedCategory || !!searchQuery.trim() || showAll;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {hasSearchOrCategory && <button onClick={handleBack} className="glove-target flex items-center justify-center rounded-xl bg-card px-2 shadow-sm"><ChevronLeft size={22} /></button>}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search food, drink, town..." className="pl-10" />
          {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2"><X size={16} className="text-muted-foreground" /></button>}
        </div>
        <button onClick={() => setShowFilters(true)} className="glove-target flex items-center justify-center rounded-xl bg-card px-3 shadow-sm"><SlidersHorizontal size={18} /></button>
      </div>

      <Button onClick={() => setSubmitOpen(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl"><Plus size={18} /> Submit a Food & Drink Venue</Button>

      {isLoading ? <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div> : !hasSearchOrCategory ? <>
        <Button variant="secondary" onClick={() => setShowAll(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl"><List size={18} /> Show All Food & Drink</Button>
        <div className="grid grid-cols-2 gap-2.5">
          {FOOD_CATEGORIES.map((cat) => <button key={cat.key} onClick={() => setSelectedCategory(cat.key)} className="rounded-2xl bg-card p-4 text-left shadow-sm active:scale-[0.99]"><div className="text-2xl">{cat.emoji}</div><p className="mt-2 font-bold">{cat.label}</p></button>)}
        </div>
      </> : filtered.length === 0 ? <div className="flex flex-col items-center gap-3 py-16 text-center"><UtensilsCrossed size={48} className="text-muted-foreground" /><p className="text-muted-foreground">No Food & Drink venues found.</p></div> : <>
        <p className="text-xs text-muted-foreground">{filtered.length} venue{filtered.length !== 1 ? 's' : ''} found</p>
        <div className="space-y-2.5 landscape:grid landscape:grid-cols-2 landscape:gap-2.5 landscape:space-y-0">{filtered.map((place) => <ServiceListingCard key={place.id} service={place} userPos={userPos} isFavorite={favoriteIds.has(place.id)} onFavorite={handleFavorite} onSelect={handleSelect} onDirections={handleDirections} onNavigate={handleNavigate} />)}</div>
      </>}

      <ServiceDetailSheet service={selectedPlace} userPos={userPos} isFavorite={selectedPlace ? favoriteIds.has(selectedPlace.id) : false} onFavorite={handleFavorite} onDirections={handleDirections} onNavigate={handleNavigate} onClose={() => setSelectedPlace(null)} />
      <ServiceFilters open={showFilters} onClose={() => setShowFilters(false)} filters={filters} onChange={setFilters} />
      <ServiceSubmitDialog foodOnly open={submitOpen} onOpenChange={setSubmitOpen} onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['food-drink'] })} />
    </div>
  );
}
