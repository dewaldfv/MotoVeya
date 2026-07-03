import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, Crown, ChevronLeft, Loader2, RefreshCw, Zap } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { PRICING, PREMIUM_FEATURES } from '@/lib/plans';
import { usePremium } from '@/hooks/usePremium';
import PremiumBadge from '@/components/PremiumBadge';
import { toast } from 'sonner';

const STRIPE_PRICES = {
  monthly: 'price_1Tp622A8s7qT3884MbxgxhlL',
  annual: 'price_1Tp622A8s7qT3884IT9D4998',
};

const FEATURE_ICONS = {
  Navigation: '🧭', Shield: '🛡️', Phone: '📞', Users: '👥', Calendar: '📅',
  Fuel: '⛽', MapPin: '📍', Siren: '🚨', Ambulance: '🚑', UserPlus: '➕',
  Radar: '📡', Route: '🗺️', BarChart3: '📊',
};

export default function GoPremium() {
  const navigate = useNavigate();
  const { isPremium, user, refresh } = usePremium();
  const [cycle, setCycle] = useState('monthly');
  const [processing, setProcessing] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    if (status === 'success') {
      toast.success('Payment successful! Premium is now active.');
      refresh();
      window.history.replaceState({}, '', '/premium');
    } else if (status === 'cancelled') {
      toast.error('Payment cancelled. You can try again anytime.');
      window.history.replaceState({}, '', '/premium');
    }
  }, []);

  const handleStartTrial = async () => {
    setProcessing(true);
    try {
      const now = new Date();
      const expiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      await base44.entities.Subscription.create({
        user_id: user?.id,
        plan: 'premium',
        status: 'trialing',
        billing_cycle: 'monthly',
        amount_zar: 0,
        purchase_date: now.toISOString(),
        renewal_date: expiry.toISOString(),
        expiry_date: expiry.toISOString(),
        payment_provider: 'trial',
        auto_renew: false,
      });
      await base44.auth.updateMe({
        subscription_tier: 'premium',
        subscription_status: 'trialing',
        subscription_expiry: expiry.toISOString(),
      });
      await refresh();
      toast.success('7-day Premium trial activated!');
    } catch (e) {
      console.error(e);
      toast.error('Could not start trial');
    } finally {
      setProcessing(false);
    }
  };

  const handleSubscribe = async () => {
    if (isInIframe) {
      toast.error('Checkout only works from a published app. Open the app in a new tab to subscribe.');
      return;
    }
    setProcessing(true);
    try {
      const response = await base44.functions.invoke('create-checkout-session', {
        price_id: STRIPE_PRICES[cycle],
        user_id: user?.id,
        user_email: user?.email,
        billing_cycle: cycle,
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
      const subs = await base44.entities.Subscription.filter({ user_id: user?.id }, '-created_date', 1);
      if (subs.length > 0) {
        const sub = subs[0];
        const expiry = sub.expiry_date ? new Date(sub.expiry_date) : null;
        const valid = sub.status === 'active' && expiry && expiry > new Date();
        await base44.auth.updateMe({
          subscription_tier: valid ? 'premium' : 'free',
          subscription_status: sub.status,
          subscription_expiry: sub.expiry_date,
        });
        await refresh();
        toast.success(valid ? 'Premium subscription restored' : 'No active subscription found');
      } else {
        toast.error('No purchases found');
      }
    } catch (e) {
      console.error(e);
      toast.error('Could not restore purchases');
    } finally {
      setProcessing(false);
    }
  };

  const price = cycle === 'annual' ? PRICING.premium.annual : PRICING.premium.monthly;
  const period = cycle === 'annual' ? '/year' : '/month';

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
          <h2 className="text-2xl font-black">MotoGo Premium</h2>
          <p className="mt-1 text-sm text-white/80">Unlock the full riding experience</p>
          <div className="mt-4 flex items-center justify-center gap-1">
            <span className="text-4xl font-black">R{price.toFixed(2)}</span>
            <span className="text-sm text-white/80">{period}</span>
          </div>
          <div className="mt-3 inline-flex rounded-full bg-white/15 p-1">
            <button
              onClick={() => setCycle('monthly')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${cycle === 'monthly' ? 'bg-white text-primary' : 'text-white'}`}
            >Monthly</button>
            <button
              onClick={() => setCycle('annual')}
              className={`rounded-full px-4 py-1.5 text-xs font-bold transition ${cycle === 'annual' ? 'bg-white text-primary' : 'text-white'}`}
            >Annual · 2 months free</button>
          </div>
        </div>

        {isPremium ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-primary/10 p-4 text-center">
            <Crown size={20} className="text-primary" fill="currentColor" />
            <span className="font-bold text-primary">You're a Premium member</span>
          </div>
        ) : (
          <div className="mt-4 space-y-2.5">
            <Button
              onClick={handleStartTrial}
              disabled={processing}
              className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-primary to-orange-600 text-base font-bold shadow-lg"
            >
              {processing ? <Loader2 size={20} className="animate-spin" /> : <Zap size={20} fill="white" />}
              Start 7-Day Free Trial
            </Button>
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