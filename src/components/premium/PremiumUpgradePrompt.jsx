import { useNavigate } from 'react-router-dom';
import { Crown, Check } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

/**
 * Explains that an action is Premium-only, then sends the rider to the upgrade page.
 */
export default function PremiumUpgradePrompt({
  open,
  onOpenChange,
  title = 'Premium feature',
  description,
  benefits = [],
  ctaLabel = 'Upgrade to Premium',
  to = '/premium',
}) {
  const navigate = useNavigate();

  const goToUpgrade = () => {
    onOpenChange?.(false);
    navigate(to);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm rounded-3xl">
        <DialogHeader className="items-center text-center sm:text-center">
          <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Crown size={26} />
          </div>
          <DialogTitle className="text-lg font-black">{title}</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">{description}</DialogDescription>
        </DialogHeader>

        {benefits.length > 0 && (
          <ul className="space-y-2">
            {benefits.map((benefit) => (
              <li key={benefit} className="flex items-start gap-2 text-sm">
                <Check size={15} className="mt-0.5 shrink-0 text-primary" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        )}

        <Button onClick={goToUpgrade} className="min-h-[48px] w-full rounded-xl font-bold">
          {ctaLabel}
        </Button>
        <button
          type="button"
          onClick={() => onOpenChange?.(false)}
          className="w-full pb-1 text-sm font-semibold text-muted-foreground"
        >
          Not now
        </button>
      </DialogContent>
    </Dialog>
  );
}