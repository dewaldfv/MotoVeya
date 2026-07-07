import { useState, useRef, useCallback, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

const SPEAKING_THRESHOLD = 12;
const SPEAK_CHECK_MS = 200;
const ICE_BATCH_MS = 400;

export function useVoiceChannel({ channelId, user, isLeader = false }) {
  const [joined, setJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState(null);

  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const participantIdRef = useRef(null);
  const mySignalsRef = useRef({});
  const signalSeqRef = useRef(0);
  const processedSeqRef = useRef(new Map());
  const iceTimerRef = useRef(null);
  const audioCtxRef = useRef(null);
  const localAnalyserRef = useRef(null);
  const speakTimerRef = useRef(null);
  const unsubRef = useRef(null);
  const channelRef = useRef(null);
  const userIdRef = useRef(null);
  const mutedRef = useRef(false);
  const speakingRef = useRef(false);
  const destroyedRef = useRef(false);
  const leaveRef = useRef(null);

  useEffect(() => { userIdRef.current = user?.id; }, [user?.id]);
  useEffect(() => { mutedRef.current = muted; }, [muted]);

  const flushSignals = useCallback(async () => {
    if (!participantIdRef.current || destroyedRef.current) return;
    try {
      signalSeqRef.current += 1;
      await base44.entities.VoiceParticipant.update(participantIdRef.current, {
        signals: JSON.stringify(mySignalsRef.current),
        signal_seq: signalSeqRef.current,
      });
    } catch (e) { /* retry next batch */ }
  }, []);

  const scheduleIceFlush = useCallback(() => {
    if (iceTimerRef.current) return;
    iceTimerRef.current = setTimeout(() => {
      iceTimerRef.current = null;
      flushSignals();
    }, ICE_BATCH_MS);
  }, [flushSignals]);

  const createPeer = useCallback((remoteUserId, isInitiator) => {
    if (peersRef.current.has(remoteUserId) || destroyedRef.current) return;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    const peerData = { pc, audio: null, analyser: null, speaking: false, remoteUserId };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!peerData.audio) {
        const audio = new Audio();
        audio.srcObject = stream;
        audio.autoplay = true;
        audio.play().catch(() => {});
        peerData.audio = audio;
        try {
          if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
          const src = audioCtxRef.current.createMediaStreamSource(stream);
          const an = audioCtxRef.current.createAnalyser();
          an.fftSize = 256;
          src.connect(an);
          peerData.analyser = an;
        } catch (e) { /* AudioContext unavailable */ }
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        if (!mySignalsRef.current[remoteUserId]) mySignalsRef.current[remoteUserId] = { description: null, candidates: [] };
        mySignalsRef.current[remoteUserId].candidates.push(event.candidate);
        scheduleIceFlush();
      }
    };

    peersRef.current.set(remoteUserId, peerData);

    if (isInitiator) {
      pc.createOffer()
        .then((o) => pc.setLocalDescription(o))
        .then(() => {
          if (!mySignalsRef.current[remoteUserId]) mySignalsRef.current[remoteUserId] = { description: null, candidates: [] };
          mySignalsRef.current[remoteUserId].description = pc.localDescription;
          flushSignals();
        })
        .catch((e) => console.error('offer error', e));
    }
  }, [flushSignals, scheduleIceFlush]);

  const processSignals = useCallback((remoteUserId, sigData, seq) => {
    const lastSeq = processedSeqRef.current.get(remoteUserId) || 0;
    if (seq <= lastSeq) return;
    processedSeqRef.current.set(remoteUserId, seq);

    const myId = userIdRef.current;
    if (!myId || !sigData) return;
    const isInitiator = myId < remoteUserId;

    let peerData = peersRef.current.get(remoteUserId);
    if (!peerData) {
      createPeer(remoteUserId, isInitiator);
      peerData = peersRef.current.get(remoteUserId);
    }
    if (!peerData) return;
    const pc = peerData.pc;

    if (sigData.description) {
      const desc = sigData.description;
      if (desc.type === 'offer' && !isInitiator) {
        pc.setRemoteDescription(new RTCSessionDescription(desc))
          .then(() => pc.createAnswer())
          .then((a) => pc.setLocalDescription(a))
          .then(() => {
            if (!mySignalsRef.current[remoteUserId]) mySignalsRef.current[remoteUserId] = { description: null, candidates: [] };
            mySignalsRef.current[remoteUserId].description = pc.localDescription;
            flushSignals();
          })
          .catch((e) => console.error('answer error', e));
      } else if (desc.type === 'answer' && isInitiator) {
        pc.setRemoteDescription(new RTCSessionDescription(desc)).catch((e) => console.error('set remote error', e));
      }
    }

    if (sigData.candidates?.length > 0) {
      for (const c of sigData.candidates) {
        pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
      }
    }
  }, [createPeer, flushSignals]);

  const handleParticipantEvent = useCallback((event) => {
    const p = event.data;
    if (!p || p.channel_id !== channelRef.current) return;
    const myId = userIdRef.current;

    if (p.user_id === myId) {
      if (event.type === 'delete') {
        leaveRef.current?.();
        return;
      }
      if (p.is_muted != null && p.is_muted !== mutedRef.current) {
        mutedRef.current = p.is_muted;
        setMuted(p.is_muted);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !p.is_muted; });
        }
      }
      return;
    }

    if (event.type === 'delete') {
      const pd = peersRef.current.get(p.user_id);
      if (pd) { try { pd.pc.close(); } catch (e) {} peersRef.current.delete(p.user_id); }
      setParticipants((prev) => prev.filter((x) => x.user_id !== p.user_id));
      return;
    }

    setParticipants((prev) => {
      const idx = prev.findIndex((x) => x.user_id === p.user_id);
      const item = {
        user_id: p.user_id, user_name: p.user_name, avatar_url: p.avatar_url,
        is_muted: p.is_muted, is_speaking: p.is_speaking, is_leader: p.is_leader,
        connection_quality: p.connection_quality,
      };
      if (idx === -1) return [...prev, item];
      const copy = [...prev]; copy[idx] = { ...copy[idx], ...item }; return copy;
    });

    if (p.signals) {
      try {
        const all = JSON.parse(p.signals);
        const sigForMe = all[myId];
        if (sigForMe) processSignals(p.user_id, sigForMe, p.signal_seq);
      } catch (e) { /* invalid JSON */ }
    }

    if (!peersRef.current.has(p.user_id)) {
      createPeer(p.user_id, myId < p.user_id);
    }
  }, [processSignals, createPeer]);

  const join = useCallback(async () => {
    if (!channelId || !user || destroyedRef.current) return;
    setConnecting(true);
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;

      try {
        audioCtxRef.current = new AudioContext();
        const src = audioCtxRef.current.createMediaStreamSource(stream);
        const an = audioCtxRef.current.createAnalyser();
        an.fftSize = 256;
        src.connect(an);
        localAnalyserRef.current = an;
      } catch (e) { /* AudioContext unavailable */ }

      const channel = await base44.entities.VoiceChannel.get(channelId);
      if (channel?.is_locked && channel.leader_id !== user.id) {
        throw new Error('Channel is locked by the leader');
      }

      const existing = await base44.entities.VoiceParticipant.filter({ channel_id: channelId }, '-joined_at', 50);
      if (channel?.max_participants && existing.length >= channel.max_participants) {
        throw new Error('Channel is full');
      }

      const now = new Date().toISOString();
      const part = await base44.entities.VoiceParticipant.create({
        channel_id: channelId, user_id: user.id,
        user_name: user.nickname || user.full_name,
        avatar_url: user.avatar_url || null,
        is_muted: false, is_speaking: false, is_leader: isLeader,
        connection_quality: 'good', joined_at: now,
        signals: '{}', signal_seq: 0,
      });
      participantIdRef.current = part.id;
      mySignalsRef.current = {};
      signalSeqRef.current = 0;
      processedSeqRef.current = new Map();
      channelRef.current = channelId;
      mutedRef.current = false;
      speakingRef.current = false;

      for (const p of existing) {
        if (p.user_id === user.id) continue;
        createPeer(p.user_id, user.id < p.user_id);
        setParticipants((prev) => [...prev, {
          user_id: p.user_id, user_name: p.user_name, avatar_url: p.avatar_url,
          is_muted: p.is_muted, is_speaking: p.is_speaking, is_leader: p.is_leader,
          connection_quality: p.connection_quality,
        }]);
        if (p.signals) {
          try {
            const all = JSON.parse(p.signals);
            const sigForMe = all[user.id];
            if (sigForMe) processSignals(p.user_id, sigForMe, p.signal_seq);
          } catch (e) {}
        }
      }

      const unsub = base44.entities.VoiceParticipant.subscribe(handleParticipantEvent);
      unsubRef.current = unsub;
      setJoined(true);
    } catch (e) {
      console.error('join voice error', e);
      setError(e.message || 'Could not join voice channel');
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
    } finally {
      setConnecting(false);
    }
  }, [channelId, user, isLeader, createPeer, processSignals, handleParticipantEvent]);

  const leave = useCallback(async () => {
    for (const [, pd] of peersRef.current) { try { pd.pc.close(); } catch (e) {} }
    peersRef.current = new Map();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (audioCtxRef.current) { try { audioCtxRef.current.close(); } catch (e) {} audioCtxRef.current = null; }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (speakTimerRef.current) { clearInterval(speakTimerRef.current); speakTimerRef.current = null; }
    if (iceTimerRef.current) { clearTimeout(iceTimerRef.current); iceTimerRef.current = null; }
    if (participantIdRef.current) {
      try { await base44.entities.VoiceParticipant.delete(participantIdRef.current); } catch (e) {}
      participantIdRef.current = null;
    }
    localAnalyserRef.current = null;
    channelRef.current = null;
    setJoined(false);
    setParticipants([]);
    setIsSpeaking(false);
    setMuted(false);
    speakingRef.current = false;
    mutedRef.current = false;
  }, []);

  useEffect(() => { leaveRef.current = leave; }, [leave]);

  useEffect(() => {
    return () => {
      destroyedRef.current = true;
      leaveRef.current();
    };
  }, []);

  const toggleMute = useCallback(async () => {
    const newMuted = !mutedRef.current;
    mutedRef.current = newMuted;
    setMuted(newMuted);
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !newMuted; });
    }
    if (participantIdRef.current) {
      try { await base44.entities.VoiceParticipant.update(participantIdRef.current, { is_muted: newMuted }); } catch (e) {}
    }
  }, []);

  const setAudioOutput = useCallback(async (deviceId) => {
    for (const [, pd] of peersRef.current) {
      if (pd.audio?.setSinkId) {
        try { await pd.audio.setSinkId(deviceId); } catch (e) {}
      }
    }
  }, []);

  useEffect(() => {
    if (!joined) return;
    speakTimerRef.current = setInterval(() => {
      let localSpeaking = false;
      if (localAnalyserRef.current && !mutedRef.current) {
        const data = new Uint8Array(localAnalyserRef.current.frequencyBinCount);
        localAnalyserRef.current.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        localSpeaking = avg > SPEAKING_THRESHOLD;
      }
      if (localSpeaking !== speakingRef.current) {
        speakingRef.current = localSpeaking;
        setIsSpeaking(localSpeaking);
        if (participantIdRef.current) {
          base44.entities.VoiceParticipant.update(participantIdRef.current, { is_speaking: localSpeaking }).catch(() => {});
        }
      }
      for (const [uid, pd] of peersRef.current) {
        let rs = false;
        if (pd.analyser) {
          const d = new Uint8Array(pd.analyser.frequencyBinCount);
          pd.analyser.getByteFrequencyData(d);
          rs = (d.reduce((a, b) => a + b, 0) / d.length) > SPEAKING_THRESHOLD;
        }
        if (pd.speaking !== rs) {
          pd.speaking = rs;
          setParticipants((prev) => prev.map((p) => p.user_id === uid ? { ...p, is_speaking: rs } : p));
        }
      }
    }, SPEAK_CHECK_MS);
    return () => clearInterval(speakTimerRef.current);
  }, [joined]);

  return { joined, muted, connecting, participants, isSpeaking, error, join, leave, toggleMute, setAudioOutput };
}