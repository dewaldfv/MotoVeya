import { useState } from 'react';
import { Check, Crown, Loader2, Store, CalendarDays, Sparkles } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PLANS } from '@/lib/plans';
import { checkoutErrorMessage } from '@/lib/checkoutError';
import { toast } from 'sonner';

const ACCESS_META = {
  rider: { label: 'Rider', icon: Sparkles },
  provider: { label: 'Provider', icon: Store },
  organizer: { label: 'Organizer', icon: CalendarDays },
};

export default function PlanPicker({ currentPlan = null, onSubscribed }) {
  const [busyPlan, setBusyPlan] = useState(null);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const subscribe = async (planId) => {
    if (isInIframe) {
      toast.error('Checkout only works from a published app. Open the app in a new tab to subscribe.');
      return;
    }
    setBusyPlan(planId);
    try {
      const response = await base44.functions.invoke('create-paystack-checkout', {
        plan: planId,
        billing_cycle: 'monthly',
        origin: window.location.origin,
      });
      if (response.data?.url) {
        window.location.href = response.data.url;
        return;
      }
      toast.error('Could not start checkout. Please try again.');
    } catch (e) {
      console.error(e);
      toast.error(checkoutErrorMessage(e));
    } finally {
      setBusyPlan(null);
      onSubscribed?.();
    }
  };

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {PLANS.map((plan) => {
        const isCurrent = currentPlan === plan.id;
        const highlighted = plan.id === 'gold';
        return (
          <div
            key={plan.id}
            className={`relative flex flex-col gap-3 rounded-3xl border p-5 transition-all ${
              highlighted
                ? 'border-primary/40 bg-gradient-to-br from-primary/10 via-card to-card shadow-lg'
                : 'border-border bg-card shadow-sm'
            }`}
          >
            {highlighted && (
              <span className="absolute right-4 top-4 rounded-full bg-primary px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-primary-foreground">
                Best value
              </span>
            )}

            <div>
              <div className="flex items-center gap-2">
                <Crown size={16} className={highlighted ? 'text-primary' : 'text-muted-foreground'} />
                <h3 className="text-base font-black leading-tight">{plan.label}</h3>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{plan.description}</p>
            </div>

            <div className="flex items-end gap-1">
              <span className="text-3xl font-black leading-none tracking-tight">
                R{plan.monthly.toFixed(2)}
              </span>
              <span className="pb-0.5 text-xs font-semibold text-muted-foreground">/month</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {plan.includes.map((access) => {
                const meta = ACCESS_META[access];
                const Icon = meta.icon;
                return (
                  <span
                    key={access}
                    className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold text-secondary-foreground"
                  >
                    <Icon size={11} /> {meta.label}
                  </span>
                );
              })}
            </div>

            <Button
              onClick={() => subscribe(plan.id)}
              disabled={busyPlan !== null || isCurrent}
              variant={highlighted ? 'default' : 'outline'}
              className="mt-auto min-h-[48px] w-full rounded-2xl text-sm font-bold"
            >
              {busyPlan === plan.id && <Loader2 size={16} className="animate-spin" />}
              {isCurrent ? (
                <>
                  <Check size={16} /> Current plan
                </>
              ) : (
                'Subscribe monthly'
              )}
            </Button>
          </div>
        );
      })}
    </div>
  );
}