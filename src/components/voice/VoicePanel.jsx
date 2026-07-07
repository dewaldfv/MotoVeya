import { useState, useEffect } from 'react';
import { Mic, MicOff, PhoneOff, ChevronUp, ChevronDown, Lock, Unlock, Megaphone, Power, Volume2, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceParticipantRow from './VoiceParticipantRow';

export default function VoicePanel({
  channelName, isLeader, isLocked,
  joined, muted, connecting, participants, isSpeaking,
  onToggleMute, onLeave, onLock, onUnlock, onEnd, onBroadcast, onSetAudioOutput, onMuteParticipant,
}) {
  const [expanded, setExpanded] = useState(true);
  const [audioOutputs, setAudioOutputs] = useState([]);
  const [showOutputs, setShowOutputs] = useState(false);

  useEffect(() => {
    if (!joined) return;
    const update = () => {
      navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
        setAudioOutputs(devices.filter((d) => d.kind === 'audiooutput'));
      }).catch(() => {});
    };
    update();
    navigator.mediaDevices?.addEventListener?.('devicechange', update);
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', update);
  }, [joined]);

  if (!joined) {
    if (connecting) {
      return (
        <div className="fixed z-40 left-1/2 -translate-x-1/2 px-3" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
          <div className="flex items-center gap-2 rounded-full bg-card/95 px-4 py-2.5 shadow-xl backdrop-blur-lg border border-border/50">
            <Loader2 size={18} className="animate-spin text-primary" />
            <span className="text-sm font-medium">Joining voice…</span>
          </div>
        </div>
      );
    }
    return null;
  }

  const connectedCount = participants.length + 1;

  return (
    <div className="fixed z-40 left-0 right-0 px-3" style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}>
      <motion.div
        className="mx-auto max-w-md overflow-hidden rounded-2xl bg-card/95 shadow-xl backdrop-blur-lg border border-border/50"
        layout
      >
        <button onClick={() => setExpanded(!expanded)} className="flex w-full items-center gap-2 p-3">
          <div className={`flex h-9 w-9 items-center justify-center rounded-full ${isSpeaking ? 'bg-emerald-500/20' : 'bg-primary/15'}`}>
            {isSpeaking ? <Mic size={18} className="text-emerald-500" /> : <Mic size={18} className="text-primary" />}
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-sm font-bold">{channelName || 'Voice Channel'}</p>
            <p className="text-[11px] text-muted-foreground">
              {isSpeaking ? 'Speaking' : 'Connected'} · {connectedCount} rider{connectedCount !== 1 ? 's' : ''}
            </p>
          </div>
          {expanded ? <ChevronDown size={20} className="text-muted-foreground" /> : <ChevronUp size={20} className="text-muted-foreground" />}
        </button>

        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="max-h-48 overflow-y-auto space-y-1.5 px-2 pb-2">
                <VoiceParticipantRow
                  participant={{ user_name: 'You', is_muted: muted, is_speaking: isSpeaking, is_leader: isLeader, connection_quality: 'good' }}
                  isSelf
                />
                {participants.map((p) => (
                  <VoiceParticipantRow key={p.user_id} participant={p} onMute={isLeader ? onMuteParticipant : null} />
                ))}
              </div>

              <div className="flex items-center gap-2 border-t border-border p-2">
                <button onClick={onToggleMute} className="glove-target flex flex-1 flex-col items-center gap-1 rounded-xl bg-secondary/50 py-2.5 active:scale-95">
                  {muted ? <MicOff size={20} className="text-destructive" /> : <Mic size={20} className="text-emerald-500" />}
                  <span className="text-[11px] font-medium">{muted ? 'Unmute' : 'Mute'}</span>
                </button>
                <button onClick={() => setShowOutputs(!showOutputs)} className="glove-target flex flex-1 flex-col items-center gap-1 rounded-xl bg-secondary/50 py-2.5 active:scale-95">
                  <Volume2 size={20} className="text-primary" />
                  <span className="text-[11px] font-medium">Output</span>
                </button>
                <button onClick={onLeave} className="glove-target flex flex-1 flex-col items-center gap-1 rounded-xl bg-destructive/10 py-2.5 active:scale-95">
                  <PhoneOff size={20} className="text-destructive" />
                  <span className="text-[11px] font-medium text-destructive">Leave</span>
                </button>
              </div>

              {showOutputs && audioOutputs.length > 0 && (
                <div className="border-t border-border p-2 space-y-1 max-h-40 overflow-y-auto">
                  {audioOutputs.map((dev) => (
                    <button key={dev.deviceId} onClick={() => { onSetAudioOutput(dev.deviceId); setShowOutputs(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary active:scale-95">
                      <Volume2 size={16} className="text-muted-foreground" />
                      <span className="truncate">{dev.label || 'Audio Device'}</span>
                    </button>
                  ))}
                </div>
              )}

              {isLeader && (
                <div className="flex items-center gap-2 border-t border-border p-2">
                  <button onClick={isLocked ? onUnlock : onLock} className="glove-target flex flex-1 flex-col items-center gap-1 rounded-xl bg-secondary/50 py-2.5 active:scale-95">
                    {isLocked ? <Lock size={18} className="text-primary" /> : <Unlock size={18} className="text-muted-foreground" />}
                    <span className="text-[11px] font-medium">{isLocked ? 'Unlock' : 'Lock'}</span>
                  </button>
                  <button onClick={onBroadcast} className="glove-target flex flex-1 flex-col items-center gap-1 rounded-xl bg-secondary/50 py-2.5 active:scale-95">
                    <Megaphone size={18} className="text-primary" />
                    <span className="text-[11px] font-medium">Announce</span>
                  </button>
                  <button onClick={onEnd} className="glove-target flex flex-1 flex-col items-center gap-1 rounded-xl bg-destructive/10 py-2.5 active:scale-95">
                    <Power size={18} className="text-destructive" />
                    <span className="text-[11px] font-medium text-destructive">End</span>
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}