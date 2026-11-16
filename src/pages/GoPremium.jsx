import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ChevronLeft, RefreshCw, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { PREMIUM_FEATURES } from '@/lib/plans';
import PlanBanners from '@/components/plans/PlanBanners';
import SubscriptionCard from '@/components/SubscriptionCard';
import { toast } from 'sonner';

const FEATURE_ICONS = {
  Navigation: '🧭', Shield: '🛡️', Phone: '📞', Users: '👥', Calendar: '📅',
  Fuel: '⛽', MapPin: '📍', Siren: '🚨', Ambulance: '🚑', UserPlus: '➕',
  Radar: '📡', Route: '🗺️', BarChart3: '📊',
};

const HERO_IMAGE = 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/6889ac46b_generated_0000a60f.jpg';
const PHOTO_HANDLEBAR = 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/6889ac46b_generated_0000a60f.jpg';
const PHOTO_RALLY = 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/b3fb6d824_generated_7ed02e3f.jpg';

function ValueCell({ value, highlight }) {
  if (value === true) {
    return <Check size={16} stroke="#F4A900" strokeWidth={3} style={{ margin: '0 auto' }} />;
  }
  if (value === false) {
    return <X size={16} stroke="#8b959b" strokeWidth={3} style={{ margin: '0 auto' }} />;
  }
  return <span className={`premium-cmp__v${highlight ? ' premium-cmp__v--p' : ''}`}>{value}</span>;
}

export default function GoPremium() {
  const navigate = useNavigate();
  const [entitlement, setEntitlement] = useState(null);
  const [processing, setProcessing] = useState(false);

  const loadEntitlement = useCallback(async () => {
    try {
      const res = await base44.functions.invoke('get-current-entitlement', {});
      setEntitlement(res.data || null);
      return res.data;
    } catch (e) {
      console.error(e);
      return null;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');

    if (status === 'success') {
      const reference = params.get('reference') || params.get('trxref');
      (async () => {
        try {
          let label = null;
          if (reference) {
            const res = await base44.functions.invoke('verify-paystack-payment', { reference });
            label = res.data?.plan_label;
          }
          await loadEntitlement();
          toast.success(label ? `${label} is now active.` : 'Payment successful — your plan is active.');
        } catch (e) {
          console.error(e);
          toast.success('Payment received — your plan will activate shortly.');
          await loadEntitlement();
        } finally {
          window.history.replaceState({}, '', '/premium');
        }
      })();
      return;
    }

    if (status === 'cancelled') {
      toast.error('Payment cancelled. You can try again anytime.');
      window.history.replaceState({}, '', '/premium');
    }
    loadEntitlement();
  }, [loadEntitlement]);

  const handleRestore = async () => {
    setProcessing(true);
    try {
      const data = await loadEntitlement();
      toast.success(data?.plan && data.plan !== 'free' ? `${data.plan_label} restored` : 'No active subscription found');
    } catch (e) {
      console.error(e);
      toast.error('Could not restore purchases');
    } finally {
      setProcessing(false);
    }
  };

  const activePlan = entitlement?.plan && entitlement.plan !== 'free' ? entitlement.plan : null;

  return (
    <div className="premium-page">
      <div className="premium-top">
        <button type="button" onClick={() => navigate(-1)} className="premium-back" aria-label="Back">
          <ChevronLeft size={24} stroke="#F4F4F1" strokeWidth={2.2} />
        </button>
        <h1>Plans &amp; Pricing</h1>
      </div>

      <div className="premium-hero">
        <img className="premium-hero__bg" src={HERO_IMAGE} alt="Motorcycle rider on a mountain pass at dusk" />
        <div className="premium-hero__scrim" />
        <div className="premium-stripe" />
        <div className="premium-hero__in">
          <h2>Choose your <em>access</em></h2>
          <p>Rider features, business listings and event organising. One monthly subscription, cancel anytime.</p>
        </div>
      </div>

      <div className="premium-wrap">
        <PlanBanners currentPlan={activePlan} onSubscribed={loadEntitlement} />

        {activePlan && (
          <div className="premium-sub">
            <SubscriptionCard variant="dark" onCancelled={loadEntitlement} />
          </div>
        )}

        <div className="premium-acts">
          <button type="button" className="premium-ghost" onClick={handleRestore} disabled={processing}>
            {processing ? <Loader2 size={16} className="animate-spin" stroke="#F4A900" /> : <RefreshCw size={16} stroke="#F4A900" strokeWidth={2.2} />}
            Restore purchases
          </button>
          <button type="button" className="premium-ghost" onClick={() => navigate('/provider/join')}>
            Business listing details
          </button>
        </div>

        <div className="premium-photos">
          <img src={PHOTO_HANDLEBAR} alt="Motorcycle handlebar with amber navigation display" />
          <img src={PHOTO_RALLY} alt="Group of motorcycles at an evening rally" />
        </div>

        <div className="premium-cmp">
          <div className="premium-cmp__row premium-cmp__row--h">
            <span>Premium rider feature</span>
            <span>Free</span>
            <span>Premium</span>
          </div>
          {PREMIUM_FEATURES.map((f) => (
            <div key={f.label} className="premium-cmp__row">
              <span className="premium-cmp__f">
                <span>{FEATURE_ICONS[f.icon] || '•'}</span>{f.label}
              </span>
              <span className="premium-cmp__c"><ValueCell value={f.free} /></span>
              <span className="premium-cmp__c"><ValueCell value={f.premium} highlight /></span>
            </div>
          ))}
        </div>

        <p className="premium-ft">Subscriptions auto-renew monthly. Cancel anytime from your profile.</p>
      </div>
    </div>
  );
}