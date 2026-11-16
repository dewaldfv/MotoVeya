import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wrench, Eye, Loader2, Store, Plus, AlertTriangle } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LoginPrompt from '@/components/LoginPrompt';
import ProviderListingCard from '@/components/provider/ProviderListingCard';
import ProviderEditDialog from '@/components/provider/ProviderEditDialog';
import ServiceSubmitDialog from '@/components/services/ServiceSubmitDialog';
import { Button } from '@/components/ui/button';
import { PROVIDER_PLAN, canManageServices, isAdminUser, isServiceProvider } from '@/lib/plans';

export default function ServiceProviderDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const { data: user, isLoading: loadingUser } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['provider-services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const owned = { $or: [{ provider_id: user.id }, { created_by_id: user.id }] };
      return (await base44.entities.Service.filter(owned, '-created_date', 100)) || [];
    },
    enabled: !!user?.id,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['provider-services', user?.id] });

  if (loadingUser) {
    return <div className="flex h-screen items-center justify-center"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }
  if (!user) return <LoginPrompt />;

  const staff = isAdminUser(user);
  const provider = isServiceProvider(user);

  const approved = services.filter((s) => s.status === 'approved');
  const pending = services.filter((s) => s.status === 'pending');
  const usedSlots = approved.length + pending.length;
  const atLimit = !staff && usedSlots >= PROVIDER_PLAN.slots;
  const totalViews = services.reduce((sum, s) => sum + (s.view_count || 0), 0);

  if (!canManageServices(user)) {
    return (
      <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto max-w-2xl space-y-4 p-4">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-xl bg-card p-2 shadow-sm">
              <ChevronLeft size={22} />
            </button>
            <h1 className="text-2xl font-bold">Provider Dashboard</h1>
          </div>
          <div className="rounded-3xl bg-card p-6 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <Store size={26} />
            </div>
            <p className="text-lg font-black">Service Provider package required</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Listing a service is available on the Service Provider package at R{PROVIDER_PLAN.monthly.toFixed(2)}/month,
              with {PROVIDER_PLAN.slots} listing slots.
            </p>
            <Button onClick={() => navigate('/provider/join')} className="mt-4 min-h-[52px] w-full rounded-2xl font-bold">
              Become a Service Provider
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-xl bg-card p-2 shadow-sm">
            <ChevronLeft size={22} />
          </button>
          <div className="flex items-center gap-2">
            <Store size={24} className="text-primary" />
            <h1 className="text-2xl font-bold">Provider Dashboard</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Wrench size={16} /><span className="text-xs font-medium">Listings</span></div>
            <p className="mt-1 text-2xl font-bold">{services.length}</p>
            <p className="text-xs text-muted-foreground">{approved.length} approved · {pending.length} pending</p>
          </div>
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-muted-foreground"><Eye size={16} /><span className="text-xs font-medium">Total Views</span></div>
            <p className="mt-1 text-2xl font-bold">{totalViews}</p>
            <p className="text-xs text-muted-foreground">across all listings</p>
          </div>
        </div>

        {!staff && (
          <div className="rounded-2xl bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold">Listing slots</span>
              <span className="font-bold text-primary">{usedSlots} of {PROVIDER_PLAN.slots} used</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, (usedSlots / PROVIDER_PLAN.slots) * 100)}%` }}
              />
            </div>
            {atLimit ? (
              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                All {PROVIDER_PLAN.slots} slots are in use. A slot frees up when a pending listing is rejected or a listing is removed.
              </p>
            ) : provider || staff ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {PROVIDER_PLAN.slots - usedSlots} slot{PROVIDER_PLAN.slots - usedSlots === 1 ? '' : 's'} available.
              </p>
            ) : null}
          </div>
        )}

        <Button
          onClick={() => setCreating(true)}
          disabled={atLimit}
          className="min-h-[52px] w-full gap-2 rounded-2xl font-bold"
        >
          <Plus size={18} /> New Listing
        </Button>

        {isLoading
          ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
          : services.length === 0
            ? <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Store size={48} className="text-muted-foreground" />
                <p className="font-semibold">No listings yet</p>
                <p className="text-sm text-muted-foreground">Add your first listing to appear in the rider service directory.</p>
              </div>
            : <div className="space-y-3">
                {services.map((service) => (
                  <ProviderListingCard key={service.id} service={service} onEdit={() => setEditing(service)} />
                ))}
              </div>}

        {!staff && !provider && (
          <Button variant="outline" onClick={() => navigate('/provider/join')} className="min-h-[48px] w-full rounded-2xl">
            Renew Service Provider package
          </Button>
        )}
      </div>

      <ProviderEditDialog
        service={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); refresh(); }}
      />

      <ServiceSubmitDialog
        open={creating}
        onOpenChange={setCreating}
        onSubmitted={refresh}
      />
    </div>
  );
}