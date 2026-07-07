import { base44 } from '@/api/base44Client';

export async function getOrCreateVoiceChannelForRide(ride, user) {
  const existing = await base44.entities.VoiceChannel.filter({
    group_ride_id: ride.id,
    status: 'active',
  }, '-created_date', 1);
  if (existing && existing[0]) return existing[0];

  return await base44.entities.VoiceChannel.create({
    name: `${ride.icon || '🏍️'} ${ride.title}`,
    type: 'group_ride',
    group_ride_id: ride.id,
    group_id: ride.group_id || null,
    status: 'active',
    leader_id: ride.leader_id || user.id,
    leader_name: ride.leader_name || user.nickname || user.full_name,
  });
}

export async function getVoiceChannelForRide(rideId) {
  const channels = await base44.entities.VoiceChannel.filter({
    group_ride_id: rideId,
    status: 'active',
  }, '-created_date', 1);
  return channels?.[0] || null;
}

export async function endVoiceChannel(channelId) {
  await base44.entities.VoiceChannel.update(channelId, { status: 'ended', is_locked: false });
  const parts = await base44.entities.VoiceParticipant.filter({ channel_id: channelId }, '-joined_at', 50);
  for (const p of parts) {
    await base44.entities.VoiceParticipant.delete(p.id);
  }
}

export function playEmergencyTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.setValueAtTime(440, now + 0.25);
    osc.frequency.setValueAtTime(880, now + 0.5);
    osc.frequency.setValueAtTime(440, now + 0.75);
    osc.frequency.setValueAtTime(880, now + 1.0);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.setValueAtTime(0.4, now + 1.2);
    gain.gain.linearRampToValueAtTime(0, now + 1.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 1.3);
    setTimeout(() => ctx.close(), 2000);
  } catch (e) { /* AudioContext not available */ }
}

export function playBroadcastTone() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.setValueAtTime(0.3, now + 0.15);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
    setTimeout(() => ctx.close(), 1000);
  } catch (e) { /* AudioContext not available */ }
}