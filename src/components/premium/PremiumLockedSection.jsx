import { useNavigate } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Keeps a section's content in place but covers it with a Premium upgrade prompt.
 */
export default function PremiumLockedSection({ locked, title, message, children }) {
  const navigate = useNavigate();

  if (!locked) return children;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      <div aria-hidden="true" className="pointer-events-none max-h-44 select-none overflow-hidden opacity-50 blur-[3px]">
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-b from-card/50 via-card/85 to-card p-4 text-center">
        <Lock size={20} className="text-primary" />
        <p className="text-sm font-bold">{title}</p>
        {message && <p className="text-xs text-muted-foreground">{message}</p>}
        <Button size="sm" className="mt-1 min-h-[40px] rounded-full px-4 font-bold" onClick={() => navigate('/premium')}>
          Upgrade to Premium
        </Button>
      </div>
    </div>
  );
}