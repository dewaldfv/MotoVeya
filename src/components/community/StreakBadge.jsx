import { Flame } from 'lucide-react';

export default function StreakBadge({ streak }) {
  if (!streak || streak < 2) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-xs font-bold text-orange-600 dark:text-orange-400">
      <Flame size={12} /> {streak}d
    </span>
  );
}