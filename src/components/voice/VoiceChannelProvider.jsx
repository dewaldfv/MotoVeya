import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useVoiceChannel } from '@/hooks/useVoiceChannel';
import { getVoiceChannelForRide, endVoiceChannel, playEmergencyTone, playBroadcastTone } from '@/lib/voiceChannel';
import VoicePanel from './VoicePanel';
import { toast } from 'sonner';

const VoiceChannelContext = createContext(null);
export const useVoiceChannelContext = () => useContext(VoiceChannelContext);

export default function VoiceChannelProvider({ children }) {
  const [user, setUser] = useState(null);
  const [activeChannel, setActiveChannel] = useState(null);
  const [isLocked, setIsLocked] = useState(false);

  const voice = useVoiceChannel({
    channelId: activeChannel?.id,
    user,
    isLeader: activeChannel?.isLeader,
  });

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  // Auto-join when activeChannel is set (provider calls join explicitly after setting channel)
  const joinRequestedRef = useRef(false);
  useEffect(() => {
    if (activeChannel && user && !voice.joined && !voice.connecting && !joinRequestedRef.current) {
      joinRequestedRef.current = true;
      voice.join().finally(() => { joinRequestedRef.current = false; });
    }
  }, [activeChannel, user, voice.joined, voice.connecting]);

  // Auto-join group rides when status transitions to "riding"
  const activeChannelRef = useRef(null);
  const voiceJoinedRef = useRef(false);
  useEffect(() => { activeChannelRef.current = activeChannel; }, [activeChannel]);
  useEffect(() => { voiceJoinedRef.current = voice.joined; }, [voice.joined]);

  useEffect(() => {
    if (!user?.auto_join_voice) return;
    let unsub;
    const myRideIds = new Set();

    (async () => {
      try {
        const parts = await base44.entities.RideParticipant.filter({ user_id: user.id }, '-joined_at', 50);
        for (const p of parts) myRideIds.add(p.group_ride_id);

        for (const rideId of myRideIds) {
          try {
            const ride = await base44.entities.GroupRide.get(rideId);
            if (ride?.status === 'riding' && !activeChannelRef.current && !voiceJoinedRef.current) {
              const ch = await getVoiceChannelForRide(rideId);
              if (ch) {
                setActiveChannel({ id: ch.id, name: ch.name, isLeader: ride.leader_id === user.id });
                break;
              }
            }
          } catch (e) { /* ride may be deleted */ }
        }

        unsub = base44.entities.GroupRide.subscribe((event) => {
          if (event.type !== 'update' || !event.data) return;
          const r = event.data;
          if (r.status === 'riding' && myRideIds.has(r.id) && !activeChannelRef.current && !voiceJoinedRef.current) {
            getVoiceChannelForRide(r.id).then((ch) => {
              if (ch && !activeChannelRef.current) {
                setActiveChannel({ id: ch.id, name: ch.name, isLeader: r.leader_id === user.id });
              }
            });
          }
        });
      } catch (e) { console.error('voice auto-join error', e); }
    })();

    return () => { if (unsub) unsub(); };
  }, [user?.id, user?.auto_join_voice]);

  // Lock state: fetch + subscribe
  useEffect(() => {
    if (!activeChannel?.id) { setIsLocked(false); return; }
    base44.entities.VoiceChannel.get(activeChannel.id).then((ch) => setIsLocked(ch?.is_locked || false)).catch(() => {});
    const unsub = base44.entities.VoiceChannel.subscribe((event) => {
      if (event.data?.id === activeChannel.id) setIsLocked(event.data.is_locked || false);
    });
    return unsub;
  }, [activeChannel?.id]);

  // Distress: play emergency tone when a channel participant triggers distress
  useEffect(() => {
    if (!voice.joined) return;
    const unsub = base44.entities.DistressAlert.subscribe((event) => {
      if (event.type !== 'create' || !event.data) return;
      const d = event.data;
      const inChannel = voice.participants.some((p) => p.user_id === d.rider_id) || d.rider_id === user?.id;
      if (inChannel) playEmergencyTone();
    });
    return unsub;
  }, [voice.joined, voice.participants, user?.id]);

  // Clear active channel when voice disconnects (e.g., leader ended the channel)
  useEffect(() => {
    if (!voice.joined && !voice.connecting && activeChannel) {
      setActiveChannel(null);
    }
  }, [voice.joined, voice.connecting, activeChannel]);

  // Show errors as toasts
  useEffect(() => {
    if (voice.error) {
      toast.error(voice.error);
      setActiveChannel(null);
    }
  }, [voice.error]);

  const joinChannel = useCallback(async (channelId, channelName, leader) => {
    if (voice.joined) await voice.leave();
    setActiveChannel({ id: channelId, name: channelName, isLeader: leader });
  }, [voice.joined, voice.leave]);

  const leaveChannel = useCallback(async () => {
    await voice.leave();
    setActiveChannel(null);
    setIsLocked(false);
  }, [voice]);

  const lockChannel = useCallback(async () => {
    if (!activeChannel) return;
    await base44.entities.VoiceChannel.update(activeChannel.id, { is_locked: true });
    setIsLocked(true);
  }, [activeChannel]);

  const unlockChannel = useCallback(async () => {
    if (!activeChannel) return;
    await base44.entities.VoiceChannel.update(activeChannel.id, { is_locked: false });
    setIsLocked(false);
  }, [activeChannel]);

  const endChannel = useCallback(async () => {
    if (!activeChannel) return;
    await endVoiceChannel(activeChannel.id);
    await voice.leave();
    setActiveChannel(null);
    setIsLocked(false);
  }, [activeChannel, voice]);

  const broadcast = useCallback(() => {
    playBroadcastTone();
  }, []);

  const muteParticipant = useCallback(async (participantUserId) => {
    if (!activeChannel) return;
    try {
      const parts = await base44.entities.VoiceParticipant.filter({ channel_id: activeChannel.id, user_id: participantUserId }, '-joined_at', 1);
      if (parts?.[0]) {
        await base44.entities.VoiceParticipant.update(parts[0].id, { is_muted: !parts[0].is_muted });
      }
    } catch (e) { toast.error('Could not mute rider'); }
  }, [activeChannel]);

  return (
    <VoiceChannelContext.Provider value={{
      ...voice,
      activeChannel,
      isLocked,
      joinChannel,
      leaveChannel,
      lockChannel,
      unlockChannel,
      endChannel,
      broadcast,
      muteParticipant,
    }}>
      {children}
      <VoicePanel
        channelName={activeChannel?.name}
        isLeader={activeChannel?.isLeader}
        isLocked={isLocked}
        joined={voice.joined}
        muted={voice.muted}
        connecting={voice.connecting}
        participants={voice.participants}
        isSpeaking={voice.isSpeaking}
        onToggleMute={voice.toggleMute}
        onLeave={leaveChannel}
        onLock={lockChannel}
        onUnlock={unlockChannel}
        onEnd={endChannel}
        onBroadcast={broadcast}
        onSetAudioOutput={voice.setAudioOutput}
        onMuteParticipant={muteParticipant}
      />
    </VoiceChannelContext.Provider>
  );
}