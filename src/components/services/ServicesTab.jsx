import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, SlidersHorizontal, ChevronLeft, X, Loader2, Wrench, List } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { savePendingNavigation } from '@/lib/rideCache';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import ServiceCategoryGrid from './ServiceCategoryGrid';
import ServiceListingCard from './ServiceListingCard';
import ServiceDetailSheet from './ServiceDetailSheet';
import ServiceFilters from './ServiceFilters';
import ServiceSubmitDialog from './ServiceSubmitDialog';
import { getServiceCategory, haversine, isOpenNow } from '@/lib/serviceCategories';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';

export default function ServicesTab({ user }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [filters, setFilters] = useState({ distance: null, rating: null, openNow: false, verified: false, premiumPartner: false });
  const [userPos, setUserPos] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => setUserPos([pos.coords.latitude, pos.coords.longitude]), () => {});
    }
  }, []);

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: async () => (await base44.entities.Service.filter({ status: 'approved' }, '-created_date', 200)) || [],
  });

  const { data: favorites = [] } = useQuery({
    queryKey: ['service-favorites'],
    queryFn: async () => {
      if (!user) return [];
      return (await base44.entities.ServiceFavorite.filter({ user_id: user.id }, '-created_date', 100)) || [];
    },
    enabled: !!user,
  });

  const favoriteIds = useMemo(() => new Set(favorites.map((f) => f.service_id)), [favorites]);

  const filteredServices = useMemo(() => {
    let result = services;
    if (selectedCategory && !showAll) result = result.filter((s) => s.category === selectedCategory);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((s) =>
        s.name?.toLowerCase().includes(q) ||
        s.description?.toLowerCase().includes(q) ||
        s.town?.toLowerCase().includes(q) ||
        s.province?.toLowerCase().includes(q) ||
        getServiceCategory(s.category).label.toLowerCase().includes(q)
      );
    }
    if (filters.distance != null && userPos) {
      result = result.filter((s) => haversine(userPos[0], userPos[1], s.lat, s.lng) <= filters.distance);
    }
    if (filters.rating != null) result = result.filter((s) => (s.rating || 0) >= filters.rating);
    if (filters.openNow) result = result.filter((s) => isOpenNow(s));
    if (filters.verified) result = result.filter((s) => s.is_verified);
    if (filters.premiumPartner) result = result.filter((s) => s.is_premium_partner);
    if (userPos) {
      result = [...result].sort((a, b) => haversine(userPos[0], userPos[1], a.lat, a.lng) - haversine(userPos[0], userPos[1], b.lat, b.lng));
    }
    return result;
  }, [services, selectedCategory, searchQuery, filters, userPos]);

  const handleFavorite = async (service) => {
    if (!user) { toast.error('Log in to save favorites'); return; }
    try {
      if (favoriteIds.has(service.id)) {
        const fav = favorites.find((f) => f.service_id === service.id);
        if (fav) await base44.entities.ServiceFavorite.delete(fav.id);
      } else {
        await base44.entities.ServiceFavorite.create({ service_id: service.id, service_name: service.name, user_id: user.id });
      }
      await queryClient.invalidateQueries({ queryKey: ['service-favorites'] });
    } catch (e) { console.error(e); toast.error('Could not update favorites'); }
  };

  const handleDirections = (service) => {
    setSelectedService(null);
    savePendingNavigation({ dest: { lat: service.lat, lng: service.lng, name: service.name } });
    navigate('/');
  };

  const handleNavigate = (service) => {
    setSelectedService(null);
    savePendingNavigation({ dest: { lat: service.lat, lng: service.lng, name: service.name }, autoStart: true });
    navigate('/');
  };

  const handleSelect = (service) => {
    setSelectedService(service);
    if (service?.id) {
      base44.functions.invoke('increment-service-view', { service_id: service.id }).catch(() => {});
    }
  };

  const handleBack = () => { setSelectedCategory(null); setSearchQuery(''); setShowAll(false); };
  const hasSearchOrCategory = !!selectedCategory || !!searchQuery.trim() || showAll;
  const activeCategory = selectedCategory ? getServiceCategory(selectedCategory) : null;

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {hasSearchOrCategory && (
          <button onClick={handleBack} className="glove-target flex items-center justify-center rounded-xl bg-card px-2 shadow-sm">
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="relative flex-1">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search name, town, province..." className="pl-10" />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X size={16} className="text-muted-foreground" />
            </button>
          )}
        </div>
        <button onClick={() => setShowFilters(true)} className="glove-target flex items-center justify-center rounded-xl bg-card px-3 shadow-sm">
          <SlidersHorizontal size={18} />
        </button>
      </div>

      <Button onClick={() => setSubmitOpen(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl">
        <Plus size={18} /> Submit a Service
      </Button>

      {activeCategory && !searchQuery && !showAll && (
        <p className="text-sm font-semibold text-muted-foreground">{activeCategory.emoji} {activeCategory.label}</p>
      )}

      {isLoading
        ? <div className="flex justify-center py-16"><Loader2 size={32} className="animate-spin text-primary" /></div>
        : !hasSearchOrCategory
          ? <>
              <Button variant="secondary" onClick={() => setShowAll(true)} className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl">
                <List size={18} /> Show All Services
              </Button>
              <ServiceCategoryGrid onSelect={setSelectedCategory} />
            </>
          : filteredServices.length === 0
            ? <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Wrench size={48} className="text-muted-foreground" />
                <p className="text-muted-foreground">No services found{searchQuery ? ` for "${searchQuery}"` : ''}.</p>
              </div>
            : <>
                <p className="text-xs text-muted-foreground">{filteredServices.length} service{filteredServices.length !== 1 ? 's' : ''} found</p>
                <div className="space-y-2.5 landscape:grid landscape:grid-cols-2 landscape:gap-2.5 landscape:space-y-0">
                  {filteredServices.map((service) => (
                    <ServiceListingCard key={service.id} service={service} userPos={userPos}
                      isFavorite={favoriteIds.has(service.id)} onFavorite={handleFavorite}
                      onSelect={handleSelect} onDirections={handleDirections} onNavigate={handleNavigate} />
                  ))}
                </div>
              </>}

      <ServiceDetailSheet service={selectedService} userPos={userPos}
        isFavorite={selectedService ? favoriteIds.has(selectedService.id) : false}
        onFavorite={handleFavorite} onDirections={handleDirections} onNavigate={handleNavigate} onClose={() => setSelectedService(null)} />

      <ServiceFilters open={showFilters} onClose={() => setShowFilters(false)} filters={filters} onChange={setFilters} />

      <ServiceSubmitDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['services'] })}
      />
    </div>
  );
}