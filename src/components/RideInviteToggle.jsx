import { Users } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function RideInviteToggle({ enabled, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!enabled)}
      className="flex w-full items-center gap-3 rounded-2xl bg-card/95 p-3 text-left shadow-lg backdrop-blur-lg landscape:max-w-xs landscape:mx-auto"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Users size={20} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-bold">Notify Friends</p>
        <p className="text-xs text-muted-foreground">Alert your friends to join this ride</p>
      </div>
      <Switch checked={enabled} onCheckedChange={onChange} />
    </button>
  );
}