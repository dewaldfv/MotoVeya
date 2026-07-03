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
    const isPremium = body.is_premium || user.subscription_tier === 'premium';
    const indicators = body.indicators;

    if (lat == null || lng == null) return Response.json({ error: 'Location required' }, { status: 400 });

    const timestamp = new Date().toISOString();
    const trackingLink = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=18/${lat}/${lng}`;

    const alert = await base44.entities.CrashAlert.create({
      rider_id: user.id,
      rider_name: riderName,
      lat, lng,
      timestamp,
      status: 'active',
      is_premium: isPremium,
      notified_emergency_contact: false,
      notified_emergency_services: false,
      notified_nearby_riders: false,
      last_lat: lat,
      last_lng: lng,
      last_updated: timestamp,
      crash_indicators: indicators ? JSON.stringify(indicators) : 'manual',
    });

    let contactNotified = false;
    const contactEmail = user.emergency_contact_email;
    if (contactEmail) {
      try {
        await base44.integrations.Core.SendEmail({
          to: contactEmail,
          subject: `EMERGENCY: MotoGo Crash Alert — ${riderName}`,
          body: `EMERGENCY ALERT — MotoGo Rider in Distress

Rider: ${riderName}
Time: ${new Date().toLocaleString('en-ZA', { timeZone: 'Africa/Johannesburg' })}
Location: ${lat.toFixed(5)}, ${lng.toFixed(5)}
Live tracking: ${trackingLink}

MotoGo has detected a potential motorcycle crash. The rider's live GPS location is being transmitted and updated continuously.

Please attempt to contact the rider immediately. If you cannot reach them, please contact emergency services (112 in South Africa) and provide the location coordinates above.

This is an automated emergency alert from MotoGo.`,
        });
        contactNotified = true;
      } catch (e) { console.error('Failed to send emergency email:', e); }
    }

    try {
      await base44.entities.DistressAlert.create({
        rider_id: user.id,
        rider_name: riderName,
        lat, lng,
        timestamp,
        status: 'active',
        reason: 'Crash detected — emergency response activated',
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
                  body: `${riderName} may need help nearby. Location: ${lat.toFixed(4)}, ${lng.toFixed(4)}`,
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

    const updated = await base44.entities.CrashAlert.update(alert.id, {
      notified_emergency_contact: contactNotified,
      notified_nearby_riders: nearbyNotified > 0,
    });

    return Response.json({
      alert: updated,
      contact_notified: contactNotified,
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