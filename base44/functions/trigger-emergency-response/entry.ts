import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const lat = body.lat;
    const lng = body.lng;
    const riderName = body.rider_name || user.full_name || 'Rider';
    // Premium is determined server-side from the Subscription entity. Never trust client-supplied entitlement flags.
    const subscriptions = await base44.asServiceRole.entities.Subscription.filter({ user_id: user.id }, '-created_date', 50);
    const now = new Date();
    const activePremium = (subscriptions || []).find((sub) => {
      if (sub.plan !== 'premium' || !['active', 'trialing'].includes(sub.status)) return false;
      return !sub.expiry_date || new Date(sub.expiry_date) > now;
    });
    const isPremium = !!activePremium;
    const indicators = body.indicators;
    const severity = body.severity || 'low';
    const speedAtImpact = body.speed_at_impact;
    const headingAtImpact = body.heading_at_impact;
    const batteryLevel = body.battery_level;
    const bikeMake = body.bike_make;
    const bikeModel = body.bike_model;
    const bikeYear = body.bike_year;

    if (lat == null || lng == null) return Response.json({ error: 'Location required' }, { status: 400 });

    const timestamp = new Date().toISOString();
    const trackingLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;
    const localTime = new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' });

    const alert = await base44.entities.CrashAlert.create({
      rider_id: user.id,
      rider_name: riderName,
      lat, lng,
      timestamp,
      status: 'active',
      severity,
      is_premium: isPremium,
      notified_emergency_contact: false,
      notified_emergency_services: false,
      notified_nearby_riders: false,
      last_lat: lat,
      last_lng: lng,
      last_updated: timestamp,
      crash_indicators: indicators ? JSON.stringify(indicators) : 'manual',
      speed_at_impact: speedAtImpact,
      heading_at_impact: headingAtImpact,
      battery_level: batteryLevel,
      bike_make: bikeMake,
      bike_model: bikeModel,
      bike_year: bikeYear,
    });

    let contactNotified = false;
    let contactMessaged = false;
    const contactEmail = user.emergency_contact_email;
    if (contactEmail) {
      try {
        await base44.integrations.Core.SendEmail({
          to: contactEmail,
          subject: `EMERGENCY (${severity.toUpperCase()}): MotoVeya Crash Alert — ${riderName}`,
          body: `EMERGENCY ALERT — MotoVeya Rider in Distress

Rider: ${riderName}
Severity: ${severity.toUpperCase()}
Time: ${localTime}
Motorcycle: ${bikeMake || ''} ${bikeModel || ''} ${bikeYear || ''}

Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Live tracking: ${trackingLink}

Last known speed: ${speedAtImpact != null ? speedAtImpact + ' km/h' : 'Unknown'}
Last known heading: ${headingAtImpact != null ? Math.round(headingAtImpact) + '°' : 'Unknown'}
Battery level: ${batteryLevel != null ? batteryLevel + '%' : 'Unknown'}

Crash indicators: ${indicators ? JSON.stringify(indicators) : 'Manual trigger'}

MotoVeya has detected a potential motorcycle crash. The rider's live GPS location is being transmitted and updated continuously.

Please attempt to contact the rider immediately. If you cannot reach them, contact emergency services (112 in South Africa) and provide the location coordinates above.

This is an automated emergency alert from MotoVeya.`,
        });
        contactNotified = true;
      } catch (e) { console.error('Failed to send emergency email:', e); }
    }

    // Auto-message the rider's designated emergency contact (in-app message + push)
    // when the contact is a registered MotoVeya user, matched by phone number.
    const ecPhone = user.emergency_contact_phone;
    if (ecPhone) {
      try {
        const normalizePhone = (p) => String(p || '').replace(/\D/g, '').slice(-9);
        const ecNorm = normalizePhone(ecPhone);
        if (ecNorm) {
          const allUsers = await base44.asServiceRole.entities.User.list('-created_date', 500);
          const contact = (allUsers || []).find(
            (u) => u.id !== user.id && normalizePhone(u.phone) === ecNorm
          );
          if (contact) {
            const svc = base44.asServiceRole;
            const crashMsg = `🆘 EMERGENCY: ${riderName} may have been in a motorcycle crash (${severity} severity). Time: ${localTime}. Live location: ${trackingLink}`;
            const preview = crashMsg.substring(0, 120);
            const nowIso = new Date().toISOString();
            const key = [user.id, contact.id].sort().join('_');
            const existing = await svc.entities.Conversation.filter({ conversation_key: key });
            let conv = existing[0];
            const sortedParticipants = [
              { id: user.id, name: riderName },
              { id: contact.id, name: contact.full_name || contact.nickname || 'Rider' },
            ].sort((a, b) => a.id.localeCompare(b.id));

            if (!conv) {
              conv = await svc.entities.Conversation.create({
                conversation_key: key,
                participant_ids: sortedParticipants.map((p) => p.id),
                participant_names: sortedParticipants.map((p) => p.name),
                last_message_preview: preview,
                last_message_at: nowIso,
                last_sender_id: user.id,
              });
            } else {
              conv = await svc.entities.Conversation.update(conv.id, {
                last_message_preview: preview,
                last_message_at: nowIso,
                last_sender_id: user.id,
              });
            }

            await svc.entities.Message.create({
              conversation_id: conv.id,
              sender_id: user.id,
              sender_name: riderName,
              content: crashMsg,
            });

            await svc.entities.Notification.create({
              type: 'crash_alert',
              title: 'Rider in Distress',
              body: preview,
              is_read: false,
              recipient_id: contact.id,
              action_url: trackingLink,
              data: JSON.stringify({ conversation_id: conv.id, sender_id: user.id, crash: true }),
            });

            contactMessaged = true;
          }
        }
      } catch (e) { console.error('Failed to auto-message emergency contact:', e); }
    }

    try {
      await base44.entities.DistressAlert.create({
        rider_id: user.id,
        rider_name: riderName,
        lat, lng,
        timestamp,
        status: 'active',
        reason: `Crash detected (${severity} severity) — emergency response activated`,
        last_lat: lat,
        last_lng: lng,
        last_updated: timestamp,
      });
    } catch (e) { console.error('Failed to create distress alert:', e); }

    let nearbyNotified = 0;
    if (isPremium) {
      try {
        const friends1 = await base44.entities.Friend.filter({ requester_id: user.id, status: 'accepted' });
        const friends2 = await base44.entities.Friend.filter({ recipient_id: user.id, status: 'accepted' });
        const allFriends = [...friends1, ...friends2];

        for (const friend of allFriends) {
          if (friend.last_lat && friend.last_lng) {
            const dist = haversine(lat, lng, friend.last_lat, friend.last_lng);
            if (dist <= 50) {
              const recipientId = friend.requester_id === user.id ? friend.recipient_id : friend.requester_id;
              try {
                await base44.asServiceRole.entities.Notification.create({
                  type: 'crash_alert',
                  title: 'Rider in Distress',
                  body: `${riderName} may need help nearby (${severity} severity). Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
                  is_read: false,
                  recipient_id: recipientId,
                  action_url: trackingLink,
                });
                nearbyNotified++;
              } catch (e) { console.error('Failed to notify friend:', e); }
            }
          }
        }
      } catch (e) { console.error('Failed to notify nearby riders:', e); }
    }

    const contactReached = contactNotified || contactMessaged;
    const updated = await base44.entities.CrashAlert.update(alert.id, {
      notified_emergency_contact: contactReached,
      notified_nearby_riders: nearbyNotified > 0,
    });

    return Response.json({
      alert: updated,
      contact_notified: contactReached,
      contact_messaged: contactMessaged,
      nearby_notified: nearbyNotified,
      tracking_link: trackingLink,
    });
  } catch (error) {
    console.error('Emergency response error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});

function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}