import { Navigation, Users, Bike, Hand, Power } from 'lucide-react';
import { Button } from '@/components/ui/button';

const SOURCE_LABELS = {
  navigation: 'Navigation',
  group_ride: 'Group Ride',
  auto_ride: 'Auto Ride Detection',
  manual: 'Manual',
};

const SOURCE_ICONS = {
  navigation: Navigation,
  group_ride: Users,
  auto_ride: Bike,
  manual: Hand,
};

function timeAgo(iso) {
  if (!iso) return '—';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function ActiveSessionCard({ session, onRevoke }) {
  const Icon = SOURCE_ICONS[session.source] || Hand;
  return (
    <div className="flex items-center gap-3 px-4 py-3 last:border-0 border-b border-border">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{SOURCE_LABELS[session.source] || session.source || 'Live session'}</p>
        <p className="text-xs text-muted-foreground">Updated {timeAgo(session.last_updated || session.started_at)}</p>
      </div>
      <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onRevoke(session.id)}>
        <Power size={14} className="mr-1" /> Revoke
      </Button>
    </div>
  );
}