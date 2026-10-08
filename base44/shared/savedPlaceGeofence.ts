/**
 * Geofence transition detection for Saved Places.
 * Called from update-my-location (web) and update-rider-location-native (native)
 * on every location ping, fire-and-forget. Detects enter/exit transitions and
 * notifies the group members of any Saved Place the rider crosses.
 */

const haversineMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371000, toRad = (v: number) => v * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

export async function runGeofenceCheck(
  svc: any,
  userId: string,
  userObj: any,
  lat: number,
  lng: number
) {
  const places = await svc.entities.SavedPlace.filter({ created_by_id: userId, active: true });
  const transitions: any[] = [];
  for (const p of (places || [])) {
    const inside = haversineMeters(Number(lat), Number(lng), Number(p.lat), Number(p.lng)) <= Number(p.radius_m || 1000);
    const wasInside = !!p.last_inside;
    if (inside === wasInside) continue;

    await svc.entities.SavedPlace.update(p.id, { last_inside: inside });
    transitions.push({ place_id: p.id, event: inside ? 'enter' : 'exit', name: p.name });

    const shouldNotify = (inside && p.notify_enter !== false) || (!inside && p.notify_exit !== false);
    if (!shouldNotify) continue;

    const riderName = userObj?.nickname || userObj?.full_name || 'A rider';
    const groupIds = Array.isArray(p.group_ids) ? p.group_ids : [];
    const dataPayload = JSON.stringify({ type: 'saved_place_geofence', place_id: p.id, event: inside ? 'enter' : 'exit', lat: Number(lat), lng: Number(lng) });

    const notifications: any[] = [{
      type: 'group_update',
      title: inside ? '📍 Entered saved zone' : '📍 Left saved zone',
      body: inside ? `You have entered ${p.name}.` : `You have left ${p.name}.`,
      recipient_id: userId,
      data: dataPayload,
    }];

    const recipients = new Set<string>();
    for (const gid of groupIds) {
      const members = await svc.entities.GroupMember.filter({ group_id: gid, status: 'active' });
      for (const m of (members || [])) if (m.user_id !== userId) recipients.add(m.user_id);
    }
    for (const recipient_id of recipients) {
      notifications.push({
        type: 'group_update',
        title: inside ? '📍 Rider Arrival' : '📍 Rider Departure',
        body: inside ? `${riderName} has entered ${p.name}.` : `${riderName} has left ${p.name}.`,
        recipient_id,
        data: dataPayload,
      });
    }
    await svc.entities.Notification.bulkCreate(notifications);
  }
  return transitions;
}