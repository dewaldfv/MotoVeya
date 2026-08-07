import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Wrench, Eye, Clock, BadgeCheck, Loader2, Store } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import LoginPrompt from '@/components/LoginPrompt';
import ProviderListingCard from '@/components/provider/ProviderListingCard';
import ProviderEditDialog from '@/components/provider/ProviderEditDialog';
import { getServiceCategory } from '@/lib/serviceCategories';

export default function ServiceProviderDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [editing, setEditing] = useState(null);

  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const me = await base44.auth.me();
      setUser(me);
      setLoadingUser(false);
      return me;
    },
  });

  const { data: services = [], isLoading } = useQuery({
    queryKey: ['provider-services', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      return (await base44.entities.Service.filter({ created_by_id: user.id }, '-created_date', 100)) || [];
    },
    enabled: !!user?.id,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['provider-services'] });

  if (loadingUser) {
    return <div className="flex h-screen items-center justify-center"><Loader2 size={28} className="animate-spin text-primary" /></div>;
  }
  if (!user) return <LoginPrompt />;

  const approved = services.filter((s) => s.status === 'approved');
  const pending = services.filter((s) => s.status === 'pending');
  const rejected = services.filter((s) => s.status === 'rejected');
  const totalViews = services.reduce((sum, s) => sum + (s.view_count || 0), 0);

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="mx-auto max-w-2xl p-4 space-y-4">
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

        {isLoading
          ? <div className="flex justify-center py-16"><Loader2 size={28} className="animate-spin text-primary" /></div>
          : services.length === 0
            ? <div className="flex flex-col items-center gap-3 py-16 text-center">
                <Store size={48} className="text-muted-foreground" />
                <p className="font-semibold">No listings yet</p>
                <p className="text-sm text-muted-foreground">Submit a service from the Community Services tab to get started.</p>
              </div>
            : <div className="space-y-3">
                {services.map((service) => (
                  <ProviderListingCard key={service.id} service={service} onEdit={() => setEditing(service)} />
                ))}
              </div>}
      </div>

      <ProviderEditDialog
        service={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); refresh(); }}
      />
    </div>
  );
}