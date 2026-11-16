import { useState, useEffect } from 'react';
import { Crown, Calendar, AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { format } from 'date-fns';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  active: { label: 'Active', color: '#16A34A', bg: '#DCFCE7', icon: Crown },
  trialing: { label: 'Trial', color: '#16A34A', bg: '#DCFCE7', icon: Crown },
  past_due: { label: 'Past Due', color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle },
  cancelled: { label: 'Cancelling', color: '#D97706', bg: '#FEF3C7', icon: AlertTriangle },
  expired: { label: 'Expired', color: '#DC2626', bg: '#FEE2E2', icon: XCircle },
};

const THEME = {
  light: { card: '#FFFFFF', border: '#E2E8F0', title: '#0F172A', muted: '#64748B', icon: '#2563EB' },
  dark: { card: '#181b1e', border: '#2c3236', title: '#F4F4F1', muted: '#a7afb4', icon: '#F4A900' },
};

export default function SubscriptionCard({ onCancelled, variant = 'light' }) {
  const t = THEME[variant] || THEME.light;
  const isDark = variant === 'dark';
  const [entitlement, setEntitlement] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const fetchEntitlement = async () => {
    try {
      const res = await base44.functions.invoke('get-current-entitlement', {});
      setEntitlement(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntitlement(); }, []);

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await base44.functions.invoke('cancel-paystack-subscription', {});
      toast.success('Subscription cancelled — access stays active until your current period ends.');
      await fetchEntitlement();
      onCancelled?.();
    } catch (e) {
      console.error(e);
      toast.error(e?.response?.data?.error || 'Could not cancel subscription');
    } finally {
      setCancelling(false);
      setCancelOpen(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border p-6" style={{ borderColor: t.border, background: t.card }}>
        <Loader2 size={20} className="animate-spin" style={{ color: t.muted }} />
      </div>
    );
  }

  if (!entitlement || (!entitlement.is_premium && !entitlement.is_provider && !entitlement.is_organizer)) return null;

  const planName = entitlement.plan_label || 'Premium';
  const status = entitlement.status || 'active';
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;
  const StatusIcon = config.icon;
  const expiryDate = entitlement.expiry_date ? new Date(entitlement.expiry_date) : null;
  const graceUntil = entitlement.grace_until ? new Date(entitlement.grace_until) : null;
  const isCancelled = status === 'cancelled';
  const isPastDue = status === 'past_due';
  // Admin plan grants carry no payment, so there is nothing to cancel.
  const hasPaidSubscription = !!entitlement.status && entitlement.status !== 'none';

  return (
    <>
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: t.border, background: t.card, boxShadow: isDark ? '0 18px 40px rgba(0,0,0,0.4)' : '0 1px 3px rgba(0,0,0,0.05)', borderRadius: isDark ? '6px' : undefined }}>
        <div className="flex items-center justify-between border-b p-4" style={{ borderColor: t.border }}>
          <div className="flex items-center gap-2">
            <Crown size={18} style={{ color: t.icon }} fill={t.icon} />
            <span className="text-sm font-semibold" style={{ color: t.title }}>{planName}</span>
          </div>
          <span
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
            style={{ color: config.color, background: config.bg }}
          >
            <StatusIcon size={12} />
            {config.label}
          </span>
        </div>

        <div className="space-y-2 p-4">
          {isPastDue && graceUntil && (
            <div className="flex items-start gap-2 rounded-lg p-3" style={{ background: '#FEF3C7' }}>
              <AlertTriangle size={16} className="mt-0.5 shrink-0" style={{ color: '#D97706' }} />
              <p className="text-xs" style={{ color: '#92400E' }}>
                Payment failed. {planName} stays active until {format(graceUntil, 'd MMM yyyy')}. Update your card to avoid losing access.
              </p>
            </div>
          )}

          {expiryDate && (
            <div className="flex items-center gap-2">
              <Calendar size={16} style={{ color: t.muted }} />
              <span className="text-sm" style={{ color: t.muted }}>
                {isCancelled ? 'Ends on' : 'Renews on'}{' '}
                <span className="font-semibold" style={{ color: t.title }}>
                  {format(expiryDate, 'd MMM yyyy')}
                </span>
              </span>
            </div>
          )}

          {hasPaidSubscription && !isCancelled && !isPastDue && (
            <p className="text-xs" style={{ color: t.muted }}>
              Auto-renews monthly. Cancel anytime.
            </p>
          )}
        </div>

        {hasPaidSubscription && !isCancelled && (
          <div className="p-4 pt-0">
            <Button
              variant="outline"
              className="w-full min-h-[48px] rounded-lg text-sm font-medium"
              style={{ borderColor: '#DC2626', color: isDark ? '#f06b6b' : '#DC2626', background: 'transparent', borderRadius: isDark ? '6px' : undefined }}
              onClick={() => setCancelOpen(true)}
            >
              Cancel Subscription
            </Button>
          </div>
        )}
      </div>

      <AlertDialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <AlertDialogContent className={isDark ? 'border-[#2c3236] bg-[#181b1e] text-[#F4F4F1] backdrop-blur-sm' : 'backdrop-blur-sm'}>
          <AlertDialogHeader>
            <AlertDialogTitle className={isDark ? 'text-[#F4F4F1]' : undefined}>Cancel Subscription?</AlertDialogTitle>
            <AlertDialogDescription className={isDark ? 'text-[#a7afb4]' : undefined}>
              Your {planName} access will stay active until {expiryDate ? format(expiryDate, 'd MMM yyyy') : 'the end of your current period'}, then revert to the Free plan. You can re-subscribe anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelling}>Keep {planName}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancel}
              disabled={cancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {cancelling ? 'Cancelling...' : 'Cancel Subscription'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}