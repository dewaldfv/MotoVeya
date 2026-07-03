import { Crown } from 'lucide-react';

export default function PremiumBadge({ className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary ${className}`}>
      <Crown size={10} fill="currentColor" /> Premium
    </span>
  );
}