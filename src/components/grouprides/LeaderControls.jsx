import { Play, Pause, Square, Megaphone, Share2, MapPin, Crown, Shield, Trash2, ChevronDown } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import RiderAvatar from '@/components/community/RiderAvatar';
import { Button } from '@/components/ui/button';

export default function LeaderControls({ open, onClose, ride, participants, user, onStart, onPause, onEnd, onAssign, onBroadcast, onShareRoute, onEditStops, onRemove }) {
  const ended = ride?.status === 'finished';
  const riding = ride?.status === 'riding';

  return (
    <BottomSheet open={open} onClose={onClose} title="Leader Controls">
      <div className="space-y-4">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Ride Control</p>
          <div className="grid grid-cols-3 gap-2">
            <button disabled={ended || riding} onClick={onStart} className="flex flex-col items-center gap-1 rounded-2xl bg-emerald-500/15 py-3 text-emerald-600 disabled:opacity-40">
              <Play size={20} /><span className="text-xs font-medium">Start</span>
            </button>
            <button disabled={ended || !riding} onClick={onPause} className="flex flex-col items-center gap-1 rounded-2xl bg-amber-500/15 py-3 text-amber-600 disabled:opacity-40">
              <Pause size={20} /><span className="text-xs font-medium">Pause</span>
            </button>
            <button disabled={ended} onClick={onEnd} className="flex flex-col items-center gap-1 rounded-2xl bg-destructive/15 py-3 text-destructive disabled:opacity-40">
              <Square size={20} /><span className="text-xs font-medium">End</span>
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Actions</p>
          <div className="grid grid-cols-3 gap-2">
            <button onClick={onBroadcast} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary py-3">
              <Megaphone size={20} className="text-primary" /><span className="text-xs font-medium">Broadcast</span>
            </button>
            <button onClick={onShareRoute} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary py-3">
              <Share2 size={20} className="text-primary" /><span className="text-xs font-medium">Share Route</span>
            </button>
            <button onClick={onEditStops} className="flex flex-col items-center gap-1 rounded-2xl bg-secondary py-3">
              <MapPin size={20} className="text-primary" /><span className="text-xs font-medium">Edit Stops</span>
            </button>
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Riders ({participants.length})</p>
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.user_id} className="flex items-center gap-2 rounded-2xl bg-secondary/50 p-2">
                <RiderAvatar src={p.avatar_url} name={p.user_name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.user_name}{p.user_id === user.id && ' (You)'}</p>
                  <p className="text-[10px] text-muted-foreground">{p.role}</p>
                </div>
                <button onClick={() => onAssign(p, 'leader')} title="Make Leader" className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.role === 'leader' ? 'bg-amber-500 text-white' : 'bg-card'}`}><Crown size={14} /></button>
                <button onClick={() => onAssign(p, 'sweep')} title="Make Sweep" className={`flex h-8 w-8 items-center justify-center rounded-lg ${p.role === 'sweep' ? 'bg-slate-600 text-white' : 'bg-card'}`}><Shield size={14} /></button>
                {p.user_id !== user.id && (
                  <button onClick={() => onRemove(p)} title="Remove" className="flex h-8 w-8 items-center justify-center rounded-lg bg-card text-destructive"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}