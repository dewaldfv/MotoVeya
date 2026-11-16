import { useState } from 'react';
import { Star, Check, X, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PLANS } from '@/lib/plans';
import { PLAN_BANNER_FEATURES, PLAN_BANNER_EXCLUDES } from '@/lib/planBannerData';
import { checkoutErrorMessage } from '@/lib/checkoutError';
import { toast } from 'sonner';

const ACCESS_LABELS = { rider: 'Rider', provider: 'Provider', organizer: 'Organizer' };

export default function PlanBanners({ currentPlan = null, onSubscribed }) {
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
    <div className="premium-grid">
      {PLANS.map((plan, index) => {
        const highlighted = plan.id === 'gold';
        const isCurrent = currentPlan === plan.id;
        const features = PLAN_BANNER_FEATURES[plan.id] || [];
        const excluded = PLAN_BANNER_EXCLUDES[plan.id] || [];

        return (
          <div
            key={plan.id}
            className={`premium-banner premium-banner--${index + 1}${highlighted ? ' premium-banner--hl' : ''}`}
          >
            {highlighted && <span className="premium-best">Best value</span>}

            <div>
              <div className="premium-name">
                <Star size={20} fill={highlighted ? '#F4A900' : '#53606A'} stroke="none" />
                <h3>{plan.label}</h3>
              </div>
              <p className="premium-desc">{plan.description}</p>
            </div>

            <div className="premium-price">
              <b>R{plan.monthly.toFixed(2)}</b>
              <span>/month</span>
            </div>

            <div className="premium-tags">
              {plan.includes.map((access) => (
                <span key={access} className="premium-tag">{ACCESS_LABELS[access]}</span>
              ))}
            </div>

            <ul className="premium-feat">
              {features.map((feature) => (
                <li key={feature}>
                  <Check size={16} color="#F4A900" strokeWidth={3} />
                  {feature}
                </li>
              ))}
              {excluded.map((feature) => (
                <li key={feature} className="is-excluded">
                  <X size={16} color="#8b959b" strokeWidth={3} />
                  {feature}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => subscribe(plan.id)}
              disabled={busyPlan !== null || isCurrent}
              className={`premium-btn${highlighted ? ' premium-btn--pri' : ''}${isCurrent ? ' premium-btn--cur' : ''}`}
            >
              {busyPlan === plan.id && <Loader2 size={16} className="animate-spin" />}
              {isCurrent ? (
                <>
                  <Check size={16} color="#F4A900" strokeWidth={3} /> Current plan
                </>
              ) : (
                'Subscribe monthly'
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}