import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, MapPin, Trash2, Route } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function SavedRoutes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['ride-plans'],
    queryFn: () => base44.entities.RidePlan.filter({}, '-created_date', 50),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RidePlan.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ride-plans'] }),
  });

  const handleLoad = (plan) => {
    navigate(`/ride-planner?load=${plan.id}`);
  };

  const handleDelete = (plan) => {
    if (confirm('Delete this route?')) {
      deleteMutation.mutate(plan.id);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="flex items-center gap-2 text-lg font-bold">
          <Route size={20} className="text-primary" /> Saved Routes
        </h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-2 p-4">
        {isLoading ? (
          <div className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : plans.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-6 text-center text-sm text-muted-foreground">
            No saved routes yet. Plan your first one in Plan Ride.
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
              <MapPin size={18} className="shrink-0 text-primary" />
              <button onClick={() => handleLoad(plan)} className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-semibold">{plan.title}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {(() => { try { return JSON.parse(plan.waypoints || '[]').length; } catch { return 0; } })()} waypoints
                  {plan.planned_date ? ` · ${new Date(plan.planned_date).toLocaleDateString()}` : ''}
                </p>
              </button>
              <button onClick={() => handleDelete(plan)} className="rounded-lg p-2 text-destructive" aria-label="Delete route">
                <Trash2 size={18} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}