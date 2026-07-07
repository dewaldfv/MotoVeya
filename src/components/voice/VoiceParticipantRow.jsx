import { MicOff, Crown, Mic } from 'lucide-react';

export default function VoiceParticipantRow({ participant, isSelf, onMute }) {
  const { user_name, avatar_url, is_muted, is_speaking, is_leader, connection_quality } = participant;
  const poorConnection = connection_quality === 'poor';

  return (
    <div className="flex items-center gap-2.5 rounded-xl bg-secondary/40 p-2">
      <div className="relative">
        {avatar_url ? (
          <img src={avatar_url} alt="" className="h-9 w-9 rounded-full object-cover" />
        ) : (
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {(user_name || 'R')[0]?.toUpperCase()}
          </div>
        )}
        {is_speaking && (
          <div className="absolute -inset-0.5 rounded-full ring-2 ring-emerald-500 animate-pulse" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {user_name || 'Rider'}{isSelf && ' (You)'}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {is_muted ? (
            <span className="flex items-center gap-0.5"><MicOff size={11} className="text-destructive" /> Muted</span>
          ) : is_speaking ? (
            <span className="font-medium text-emerald-500">🎤 Speaking</span>
          ) : (
            <span>🎧 Listening</span>
          )}
          {poorConnection && <span className="text-amber-500">· Poor</span>}
        </div>
      </div>
      {onMute && !isSelf && (
        <button onClick={() => onMute(participant.user_id)} className="glove-target flex h-8 w-8 items-center justify-center rounded-lg bg-secondary active:scale-95">
          {is_muted ? <Mic size={15} className="text-emerald-500" /> : <MicOff size={15} className="text-destructive" />}
        </button>
      )}
      {is_leader && <Crown size={15} className="shrink-0 text-amber-500" />}
    </div>
  );
}