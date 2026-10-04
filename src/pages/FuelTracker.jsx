import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Fuel, CloudOff, Loader2, Bike as BikeIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import FuelStatsCard from '@/components/fuel/FuelStatsCard';
import AddRefillDialog from '@/components/fuel/AddRefillDialog';
import RefillItem from '@/components/fuel/RefillItem';
import PullToRefresh from '@/components/PullToRefresh';
import LoginPrompt from '@/components/LoginPrompt';
import { toast } from 'sonner';

export default function FuelTracker() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedBikeId, setSelectedBikeId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editingRefill, setEditingRefill] = useState(null);
  const [deletingRefill, setDeletingRefill] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) { setLoading(false); return; }
        setUser(await base44.auth.me());
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const { data: bikes = [] } = useQuery({
    queryKey: ['bikes'],
    queryFn: async () => (await base44.entities.Bike.list('-created_date', 20)) || [],
    enabled: !!user,
  });

  useEffect(() => {
    if (bikes.length > 0 && !selectedBikeId) {
      const urlBike = searchParams.get('bike');
      const primary = bikes.find((b) => b.is_primary);
      setSelectedBikeId(urlBike || primary?.id || bikes[0].id);
    }
  }, [bikes, selectedBikeId, searchParams]);

  const selectedBike = bikes.find((b) => b.id === selectedBikeId);

  const { data: profile } = useQuery({
    queryKey: ['fuel-profile', selectedBikeId],
    queryFn: async () => {
      try {
        const profiles = await base44.entities.FuelProfile.filter({ bike_id: selectedBikeId }, '-last_calculated', 1);
        const p = profiles[0] || null;
        if (p) localStorage.setItem(`motogo_fuel_profile_${selectedBikeId}`, JSON.stringify(p));
        return p;
      } catch (e) {
        if (!navigator.onLine) {
          const cached = localStorage.getItem(`motogo_fuel_profile_${selectedBikeId}`);
          return cached ? JSON.parse(cached) : null;
        }
        throw e;
      }
    },
    enabled: !!selectedBikeId,
  });

  const { data: refills = [], isLoading: refillsLoading } = useQuery({
    queryKey: ['fuel-refills', selectedBikeId],
    queryFn: async () => (await base44.entities.FuelRefill.filter({ bike_id: selectedBikeId }, '-refill_date', 200)) || [],
    enabled: !!selectedBikeId,
  });

  // Display fallback: calculate directly from submitted odometer readings if
  // the backend profile has not refreshed yet. GPS distance is never used.
  const displayProfile = (() => {
    const ordered = [...refills]
      .filter((r) => r.odometer_km != null && Number(r.litres) > 0)
      .sort((a, b) => new Date(a.refill_date) - new Date(b.refill_date));

    const hasEnoughData = ordered.length >= 2;

    // If a profile exists but the actual refills can no longer support live
    // metrics (fewer than 2 with odometer readings), null out the four live
    // tiles so they render '—' while cumulative totals stay intact.
    if (profile && !hasEnoughData) {
      return {
        ...profile,
        adaptive_l_per_100km: null,
        km_per_litre: null,
        cost_per_km: null,
        estimated_range_km: null,
      };
    }

    if (profile) return profile;

    if (!hasEnoughData) return null;

    const previous = ordered[ordered.length - 2];
    const latest = ordered[ordered.length - 1];
    const distance = Number(latest.odometer_km) - Number(previous.odometer_km);
    if (distance <= 0) return null;

    const consumption = (Number(latest.litres) / distance) * 100;
    if (!Number.isFinite(consumption) || consumption <= 0 || consumption >= 30) return null;

    return {
      adaptive_l_per_100km: consumption,
      km_per_litre: 100 / consumption,
      confidence_score: 0,
      refill_count: refills.length,
      total_distance_km: distance,
      estimated_range_km: selectedBike?.tank_capacity_l ? selectedBike.tank_capacity_l * (100 / consumption) : 0,
      total_fuel_cost: 0,
      total_fuel_l: 0,
      avg_price_per_litre: 0,
      cost_per_km: 0,
    };
  })();

  const syncOfflineQueue = useCallback(async () => {
    const queue = JSON.parse(localStorage.getItem('motogo_fuel_queue') || '[]');
    if (queue.length === 0) return;
    let synced = 0;
    const remaining = [];
    for (const item of queue) {
      try {
        await base44.entities.FuelRefill.create(item);
        try { await base44.functions.invoke('recalculate-fuel-profile', { bike_id: item.bike_id }); } catch (e) {}
        synced++;
      } catch (e) { remaining.push(item); }
    }
    localStorage.setItem('motogo_fuel_queue', JSON.stringify(remaining));
    if (synced > 0) {
      toast.success(`${synced} offline refill(s) synced`);
      queryClient.invalidateQueries({ queryKey: ['fuel-refills'] });
      queryClient.invalidateQueries({ queryKey: ['fuel-profile'] });
    }
  }, [queryClient]);

  useEffect(() => {
    const handleOnline = () => { setIsOffline(false); syncOfflineQueue(); };
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    if (navigator.onLine) syncOfflineQueue();
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [syncOfflineQueue]);

  const handleDeleteRefill = async () => {
    if (!deletingRefill) return;
    setDeleteBusy(true);
    try {
      await base44.entities.FuelRefill.delete(deletingRefill.id);
      try { await base44.functions.invoke('recalculate-fuel-profile', { bike_id: selectedBikeId }); } catch (e) { console.error('Profile recalc failed:', e); }
      await queryClient.invalidateQueries({ queryKey: ['fuel-refills', selectedBikeId] });
      await queryClient.invalidateQueries({ queryKey: ['fuel-profile', selectedBikeId] });
      toast.success('Fuel refill deleted');
      setDeletingRefill(null);
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete fuel refill');
    } finally {
      setDeleteBusy(false);
    }
  };

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['fuel-refills'] });
    await queryClient.invalidateQueries({ queryKey: ['fuel-profile'] });
    await queryClient.invalidateQueries({ queryKey: ['bikes'] });
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt />;

  return (
    <div className="min-h-screen bg-background pb-24" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-20 flex items-center gap-3 bg-background/95 px-4 py-3 backdrop-blur-lg" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
        <button onClick={() => window.history.back()} className="glove-target flex h-10 w-10 items-center justify-center rounded-full bg-card">
          <ChevronLeft size={22} />
        </button>
        <h1 className="text-xl font-bold">Fuel Tracker</h1>
        {isOffline && (
          <div className="ml-auto flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-1 text-xs text-destructive">
            <CloudOff size={12} /> Offline
          </div>
        )}
      </div>

      {bikes.length === 0 ? (
        <div className="p-4">
          <div className="rounded-2xl bg-card p-8 text-center">
            <BikeIcon size={40} className="mx-auto mb-3 text-muted-foreground" />
            <p className="font-medium">No bikes added yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add a motorcycle in your Profile to start tracking fuel.</p>
          </div>
        </div>
      ) : (
        <PullToRefresh onRefresh={handleRefresh}>
          <div className="p-4">
            {bikes.length > 1 && (
              <div className="mb-4 flex gap-2 overflow-x-auto no-scrollbar">
                {bikes.map((bike) => (
                  <button
                    key={bike.id}
                    onClick={() => setSelectedBikeId(bike.id)}
                    className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                      selectedBikeId === bike.id ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
                    }`}
                  >
                    {bike.nickname || `${bike.make} ${bike.model}`}
                  </button>
                ))}
              </div>
            )}

            <FuelStatsCard profile={displayProfile} bike={selectedBike} />

            <div className="mb-3 mt-6 flex items-center justify-between">
              <h2 className="font-bold">Refill History</h2>
              <span className="text-xs text-muted-foreground">{refills.length} refills</span>
            </div>

            {refillsLoading ? (
              <div className="flex justify-center py-8"><Loader2 size={24} className="animate-spin text-muted-foreground" /></div>
            ) : refills.length === 0 ? (
              <div className="rounded-2xl bg-card p-8 text-center">
                <Fuel size={32} className="mx-auto mb-2 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No refills logged yet. Tap the + button to add your first.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {refills.map((refill) => (
                  <RefillItem
                    key={refill.id}
                    refill={refill}
                    onEdit={() => setEditingRefill(refill)}
                    onDelete={() => setDeletingRefill(refill)}
                  />
                ))}
              </div>
            )}
          </div>
        </PullToRefresh>
      )}

      {bikes.length > 0 && (
        <button onClick={() => { setEditingRefill(null); setAddOpen(true); }} className="fab flex items-center justify-center" aria-label="Add Refill">
          <Plus size={28} />
        </button>
      )}

      {deletingRefill && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-card p-5 shadow-xl">
            <h2 className="text-lg font-bold">Delete fuel refill?</h2>
            <p className="mt-2 text-sm text-muted-foreground">This will permanently remove the {Number(deletingRefill.litres || 0).toFixed(1)}L refill from your history and recalculate your fuel statistics.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setDeletingRefill(null)} disabled={deleteBusy} className="rounded-lg px-4 py-2 text-sm font-medium">Cancel</button>
              <button onClick={handleDeleteRefill} disabled={deleteBusy} className="rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground">{deleteBusy ? 'Deleting...' : 'Delete'}</button>
            </div>
          </div>
        </div>
      )}

      <AddRefillDialog
        open={addOpen || !!editingRefill}
        editRefill={editingRefill}
        onClose={() => { setAddOpen(false); setEditingRefill(null); }}
        bike={selectedBike}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['fuel-refills', selectedBikeId] });
          queryClient.invalidateQueries({ queryKey: ['fuel-profile', selectedBikeId] });
          queryClient.invalidateQueries({ queryKey: ['garage-fuel-profiles'] });
          queryClient.invalidateQueries({ queryKey: ['garage-refills'] });
          queryClient.invalidateQueries({ queryKey: ['bikes'] });
          queryClient.invalidateQueries({ queryKey: ['bike-fuel-profile', selectedBikeId] });
        }}
      />
    </div>
  );
}