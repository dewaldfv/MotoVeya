import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Store, Check, X, Crown, Loader2, RefreshCw, Wrench } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import LoginPrompt from '@/components/LoginPrompt';
import { PROVIDER_PLAN, PROVIDER_PERKS, PROVIDER_EXCLUDES, isServiceProvider } from '@/lib/plans';
import { toast } from 'sonner';

export default function ProviderJoin() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [processing, setProcessing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isInIframe = typeof window !== 'undefined' && window.self !== window.top;

  const { data: me, isLoading, isError: meFailed } = useQuery({
    queryKey: ['me'],
    queryFn: () => base44.auth.me(),
    retry: false,
  });

  const provider = isServiceProvider(me);

  const { data: listings = [] } = useQuery({
    queryKey: ['provider-join-listings', me?.id],
    queryFn: async () => (await base44.entities.Service.filter({ created_by_id: me.id }, '-created_date', 200)) || [],
    enabled: !!me?.id && provider,
  });

  // Returning from Paystack: confirm the payment, then open the provider dashboard.
  // Nothing is activated unless Paystack confirms the transaction for this user.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const reference = params.get('reference') || params.get('trxref');
    if (!reference) return;
    window.history.replaceState({}, '', '/provider/join');

    let cancelled = false;
    setConfirming(true);

    (async () => {
      try {
        const res = await base44.functions.invoke('verify-paystack-payment', { reference });
        const activated = res.data?.active === true && res.data?.plan === 'provider';
        await queryClient.invalidateQueries({ queryKey: ['me'] });
        if (cancelled) return;

        if (activated) {
          await queryClient.refetchQueries({ queryKey: ['me'] });
          if (cancelled) return;
          toast.success('Your Service Provider package is active.');
          navigate('/provider-dashboard', { replace: true });
          return;
        }
        toast.error('That payment was not completed, so your package is still inactive.');
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error('We could not confirm that payment. Please try again.');
      } finally {
        if (!cancelled) setConfirming(false);
      }
    })();

    return () => { cancelled = true; };
  }, [queryClient, navigate]);

  const handleSubscribe = async () => {
    if (isInIframe) {
      toast.error('Checkout only works from a published app. Open the app in a new tab to subscribe.');
      return;
    }
    setProcessing(true);
    try {
      const response = await base44.functions.invoke('create-paystack-checkout', {
        plan: 'provider',
        billing_cycle: 'monthly',
        origin: window.location.origin,
      });
      if (response.data?.url) window.location.href = response.data.url;
      else toast.error('Could not start checkout. Please try again.');
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
      await base44.functions.invoke('get-current-entitlement', {});
      await queryClient.invalidateQueries({ queryKey: ['me'] });
      toast.success('Provider status refreshed');
    } catch (e) {
      console.error(e);
      toast.error('Could not refresh provider status');
    } finally {
      setProcessing(false);
    }
  };

  const slotsUsed = listings.filter((s) => s.status === 'pending' || s.status === 'approved').length;

  if (confirming) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background px-8 text-center">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-lg font-black">Confirming your payment</p>
        <p className="text-sm text-muted-foreground">
          One moment while we activate your Service Provider package.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (meFailed || !me) {
    return <LoginPrompt message="Sign in to enrol for the Service Provider package." />;
  }

  return (
    <div className="min-h-screen bg-background pb-28">
      <div
        className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg"
        style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Service Provider</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 px-4">
        <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary to-orange-600 p-6 text-white shadow-xl">
          <div className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/20">
              <Store size={22} />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-white/70">Business package</p>
              <h2 className="text-xl font-black leading-tight">MotoVeya Service Provider</h2>
            </div>
          </div>
          <div className="mt-5 flex items-end gap-1">
            <span className="text-4xl font-black leading-none">R{PROVIDER_PLAN.monthly.toFixed(2)}</span>
            <span className="pb-1 text-sm text-white/80">/month</span>
          </div>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-bold">
            {PROVIDER_PLAN.slots} listing slots included
          </div>
        </div>

        {provider ? (
          <>
            <div className="rounded-3xl bg-card p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <Crown size={18} className="text-primary" />
                <p className="font-bold">Your package is active</p>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {slotsUsed} of {PROVIDER_PLAN.slots} listing slots used
                {me?.provider_expiry ? ` · renews ${new Date(me.provider_expiry).toLocaleDateString()}` : ''}
              </p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, (slotsUsed / PROVIDER_PLAN.slots) * 100)}%` }}
                />
              </div>
              <Button onClick={() => navigate('/provider-dashboard')} className="mt-4 min-h-[52px] w-full gap-2 rounded-2xl font-bold">
                <Wrench size={18} /> Manage Listings
              </Button>
            </div>
          </>
        ) : (
          <Button
            onClick={handleSubscribe}
            disabled={processing || !me}
            className="min-h-[56px] w-full gap-2 rounded-2xl text-base font-bold"
          >
            {processing ? <Loader2 size={18} className="animate-spin" /> : <Store size={18} />}
            Become a Provider · R{PROVIDER_PLAN.monthly.toFixed(2)}/month
          </Button>
        )}

        <div className="rounded-3xl bg-card p-5 shadow-sm">
          <h3 className="font-bold">What's included</h3>
          <ul className="mt-3 space-y-2">
            {PROVIDER_PERKS.map((perk) => (
              <li key={perk} className="flex items-start gap-2 text-sm">
                <Check size={16} className="mt-0.5 shrink-0 text-primary" />
                <span>{perk}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-3xl bg-card p-5 shadow-sm">
          <h3 className="font-bold">Not included</h3>
          <ul className="mt-3 space-y-2">
            {PROVIDER_EXCLUDES.map((item) => (
              <li key={item} className="flex items-start gap-2 text-sm text-muted-foreground">
                <X size={16} className="mt-0.5 shrink-0" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <Button
          onClick={handleRestore}
          disabled={processing}
          variant="ghost"
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl text-sm"
        >
          <RefreshCw size={16} /> Refresh provider status
        </Button>

        <p className="pb-2 text-center text-xs text-muted-foreground">
          Subscription auto-renews monthly. Cancel anytime from your profile.
        </p>
      </div>
    </div>
  );
}