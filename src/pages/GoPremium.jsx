import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Crown, ChevronLeft, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PRICING, PREMIUM_FEATURES } from '@/lib/plans';
import { usePremium } from '@/hooks/usePremium';
import PremiumBadge from '@/components/PremiumBadge';
import SubscriptionCard from '@/components/SubscriptionCard';
import { toast } from 'sonner';



const FEATURE_ICONS = {
  Navigation: '🧭', Shield: '🛡️', Phone: '📞', Users: '👥', Calendar: '📅',
  Fuel: '⛽', MapPin: '📍', Siren: '🚨', Ambulance: '🚑', UserPlus: '➕',
  Radar: '📡', Route: '🗺️', BarChart3: '📊',
};

export default function GoPremium() {
  const navigate = useNavigate();
  const { isPremium, refresh } = usePremium();
  const cycle = 'monthly';
  const [processing, setProcessing] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      const reference = params.get('reference') || params.get('trxref');
      (async () => {
        try {
          if (reference) {
            await base44.functions.invoke('verify-paystack-payment', { reference });
          }
          await refresh();
          toast.success('Payment successful! Premium is now active.');
        } catch (e) {
          console.error(e);
          toast.success('Payment received — your Premium will activate shortly.');
          await refresh();
        } finally {
          window.history.replaceState({}, '', '/premium');
        }
      })();
    } else if (status === 'cancelled') {
      toast.error('Payment cancelled. You can try again anytime.');
      window.history.replaceState({}, '', '/premium');
    }
  }, []);

  const handleSubscribe = async () => {
    if (isInIframe) {
      toast.error('Checkout only works from a published app. Open the app in a new tab to subscribe.');
      return;
    }
    setProcessing(true);
    try {
      const response = await base44.functions.invoke('create-paystack-checkout', {
        billing_cycle: 'monthly',
        origin: window.location.origin,
      });
      if (response.data?.url) {
        window.location.href = response.data.url;
      } else {
        toast.error('Could not start checkout. Please try again.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Checkout failed. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  const handleRestore = async () => {
    setProcessing(true);
    try {
      const result = await base44.functions.invoke('get-current-entitlement', {});
      await refresh();
      toast.success(result.data?.is_premium ? 'Premium subscription restored' : 'No active subscription found');
    } catch (e) {
      console.error(e);
      toast.error('Could not restore purchases');
    } finally {
      setProcessing(false);
    }
  };

  const price = PRICING.premium.monthly;
  const period = '/month';

  return (
    <div className="min-h-screen bg-background pb-8">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Go Premium</h1>
        {isPremium && <PremiumBadge />}
      </div>

      <div className="px-4">
        <div className="rounded-3xl bg-gradient-to-br from-primary to-orange-600 p-6 text-center text-white shadow-xl">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-white/20">
            <Crown size={32} fill="white" />
          </div>
          <h2 className="text-2xl font-black">MotoVeya Premium</h2>
          <p className="mt-1 text-sm text-white/80">Unlock the full riding experience</p>
          <div className="mt-4 flex items-center justify-center gap-1">
            <span className="text-4xl font-black">R{price.toFixed(2)}</span>
            <span className="text-sm text-white/80">{period}</span>
          </div>
          <div className="mt-3 inline-flex rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold">
            Monthly subscription
          </div>
        </div>

        {isPremium ? (
          <div className="mt-4">
            <SubscriptionCard onCancelled={refresh} />
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <Button
              onClick={handleSubscribe}
              disabled={processing}
              variant="outline"
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold"
            >
              <Crown size={20} /> Subscribe Now · R{price.toFixed(2)}{period}
            </Button>
            <Button
              onClick={handleRestore}
              disabled={processing}
              variant="ghost"
              className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-sm"
            >
              <RefreshCw size={16} /> Restore Purchases
            </Button>
          </div>
        )}

        <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-card">
          <div className="grid grid-cols-3 border-b border-border bg-muted/50 px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            <span>Feature</span>
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
          Subscription auto-renews. Cancel anytime in your profile settings.
        </p>
      </div>
    </div>
  );
}