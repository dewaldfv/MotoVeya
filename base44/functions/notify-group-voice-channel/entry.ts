import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { rider_id, rider_name, lat, lng } = body;

    if (!rider_id) {
      return Response.json({ error: 'rider_id required' }, { status: 400 });
    }

    // Authenticate caller and verify they match the rider in distress
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!me || me.id !== rider_id) {
      return Response.json({ error: 'You can only broadcast distress alerts for yourself' }, { status: 403 });
    }

    const svc = base44.asServiceRole;
    const trackingLink = lat != null && lng != null
      ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`
      : null;

    // Find all group rides the rider is a participant of
    const myParticipations = await svc.entities.RideParticipant.filter({ user_id: rider_id }, '-created_date', 50);

    let notifiedCount = 0;
    const notifiedRides = [];

    for (const myPart of myParticipations) {
      let ride;
      try { ride = await svc.entities.GroupRide.get(myPart.group_ride_id); } catch (e) { continue; }
      if (!ride || !['riding', 'waiting', 'paused'].includes(ride.status)) continue;

      // Find the active voice channel for this group ride
      let voiceChannel = null;
      try {
        const channels = await svc.entities.VoiceChannel.filter({ group_ride_id: ride.id, status: 'active' }, '-created_date', 1);
        voiceChannel = channels[0] || null;
      } catch (e) { /* no voice channel */ }

      // Get members currently in the voice channel
      let voiceParticipants = [];
      if (voiceChannel) {
        try {
          voiceParticipants = await svc.entities.VoiceParticipant.filter({ channel_id: voiceChannel.id }, '-joined_at', 50);
        } catch (e) { /* no participants */ }
      }

      // Build the notification recipient set: voice members first, fall back to all ride participants
      const notifySet = new Set();
      for (const vp of voiceParticipants) {
        if (vp.user_id !== rider_id) notifySet.add(vp.user_id);
      }
      if (notifySet.size === 0) {
        let allRideParticipants = [];
        try {
          allRideParticipants = await svc.entities.RideParticipant.filter({ group_ride_id: ride.id }, '-created_date', 50);
        } catch (e) {}
        for (const rp of allRideParticipants) {
          if (rp.user_id !== rider_id) notifySet.add(rp.user_id);
        }
      }

      const locationStr = lat != null && lng != null ? `${lat.toFixed(4)}, ${lng.toFixed(4)}` : 'unknown';

      for (const userId of notifySet) {
        try {
          await svc.entities.Notification.create({
            type: 'distress_alert',
            title: 'Rider in Distress — Voice Channel Alert',
            body: `${rider_name || 'A rider'} in "${ride.title}" triggered a distress alert. Location: ${locationStr}. Check the voice channel for coordination.`,
            is_read: false,
            recipient_id: userId,
            ...(trackingLink ? { action_url: trackingLink } : {}),
          });
          notifiedCount++;
        } catch (e) {
          console.error('Failed to notify member:', e);
        }
      }

      notifiedRides.push(ride.id);
    }

    return Response.json({
      success: true,
      notified_count: notifiedCount,
      group_rides: notifiedRides,
    });
  } catch (error) {
    console.error('notify-group-voice-channel error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}