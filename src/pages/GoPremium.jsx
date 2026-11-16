import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ChevronLeft, RefreshCw, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PREMIUM_FEATURES } from '@/lib/plans';
import PlanPicker from '@/components/plans/PlanPicker';
import SubscriptionCard from '@/components/SubscriptionCard';
import { toast } from 'sonner';

const FEATURE_ICONS = {
  Navigation: '🧭', Shield: '🛡️', Phone: '📞', Users: '👥', Calendar: '📅',
  Fuel: '⛽', MapPin: '📍', Siren: '🚨', Ambulance: '🚑', UserPlus: '➕',
  Radar: '📡', Route: '🗺️', BarChart3: '📊',
};

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
    <div className="min-h-screen bg-background pb-10">
      <div
        className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Plans &amp; Pricing</h1>
      </div>

      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-5">
          <h2 className="text-3xl font-black leading-tight tracking-tight">Choose your access</h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Rider features, business listings and event organising. One monthly subscription, cancel anytime.
          </p>
        </div>

        <PlanPicker currentPlan={activePlan} onSubscribed={loadEntitlement} />

        {activePlan && (
          <div className="mt-5">
            <SubscriptionCard onCancelled={loadEntitlement} />
          </div>
        )}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            onClick={handleRestore}
            disabled={processing}
            variant="ghost"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl text-sm"
          >
            {processing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />} Restore purchases
          </Button>
          <Button
            onClick={() => navigate('/provider/join')}
            variant="ghost"
            className="flex min-h-[48px] items-center justify-center gap-2 rounded-2xl text-sm"
          >
            Business listing details
          </Button>
        </div>

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span>Premium rider feature</span>
            <span className="text-center">Free</span>
            <span className="text-center text-primary">Premium</span>
          </div>
          {PREMIUM_FEATURES.map((f, i) => (
            <div key={i} className={`grid grid-cols-3 items-center px-4 py-3 text-sm ${i % 2 === 0 ? 'bg-card' : 'bg-muted/20'}`}>
              <span className="flex items-center gap-2 font-medium">
                <span>{FEATURE_ICONS[f.icon] || '•'}</span>{f.label}
              </span>
              <span className="text-center">
                {f.free === true ? <Check size={16} className="mx-auto text-green-600" /> : f.free === false ? <X size={16} className="mx-auto text-muted-foreground" /> : <span className="text-xs">{f.free}</span>}
              </span>
              <span className="text-center">
                {f.premium === true ? <Check size={16} className="mx-auto text-primary" /> : f.premium === false ? <X size={16} className="mx-auto text-muted-foreground" /> : <span className="text-xs font-semibold text-primary">{f.premium}</span>}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Subscriptions auto-renew monthly. Cancel anytime from your profile.
        </p>
      </div>
    </div>
  );
}