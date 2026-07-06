import { base44 } from '@/api/base44Client';

// Returns user IDs of all accepted friends (both directions of the relationship).
export async function getAcceptedFriendIds(userId) {
  const [asRequester, asRecipient] = await Promise.all([
    base44.entities.Friend.filter({ requester_id: userId, status: 'accepted' }, '-created_date', 100),
    base44.entities.Friend.filter({ recipient_id: userId, status: 'accepted' }, '-created_date', 100),
  ]);
  const friends = [...(asRequester || []), ...(asRecipient || [])];
  return friends.map((f) => (f.requester_id === userId ? f.recipient_id : f.requester_id));
}

// Creates a ride_invite notification for every accepted friend with the destination
// so they can join the ride or follow along. Returns the number of friends notified.
export async function notifyFriendsOfRide(user, destination) {
  if (!user || !destination) return 0;
  const friendIds = await getAcceptedFriendIds(user.id);
  if (friendIds.length === 0) return 0;
  const riderName = user.nickname || user.full_name || 'A rider';
  const title = `${riderName} started a group ride`;
  const body = `Heading to ${destination.name}. Tap to join or follow.`;
  const data = JSON.stringify({
    rider_id: user.id,
    rider_name: riderName,
    lat: destination.lat,
    lng: destination.lng,
    name: destination.name,
  });
  const notifications = friendIds.map((recipient_id) => ({
    type: 'ride_invite',
    title,
    body,
    recipient_id,
    data,
    action_url: '/community',
    is_read: false,
  }));
  await base44.entities.Notification.bulkCreate(notifications);
  return friendIds.length;
}

// Notifies all accepted friends when a new group ride is created, including the
// destination and a direct link to join the live tracking map. Returns the count.
export async function notifyFriendsOfGroupRide(user, ride) {
  if (!user || !ride || !ride.id) return 0;
  const friendIds = await getAcceptedFriendIds(user.id);
  if (friendIds.length === 0) return 0;
  const riderName = user.nickname || user.full_name || 'A rider';
  const destName = ride.destination_name || 'a destination';
  const title = `${riderName} started a group ride`;
  const body = `Heading to ${destName}. Tap to join the live map.`;
  const data = JSON.stringify({
    group_ride_id: ride.id,
    rider_id: user.id,
    rider_name: riderName,
    destination_name: ride.destination_name || null,
    lat: ride.destination_lat ?? null,
    lng: ride.destination_lng ?? null,
  });
  const joinUrl = `/ride/group/${ride.id}`;
  const notifications = friendIds.map((recipient_id) => ({
    type: 'ride_invite',
    title,
    body,
    recipient_id,
    data,
    action_url: joinUrl,
    is_read: false,
  }));
  await base44.entities.Notification.bulkCreate(notifications);
  return friendIds.length;
}

// Sends a single ride_invite to one friend with an optional meet-up destination.
export async function inviteFriendToRide(user, friendUserId, destination) {
  if (!user || !friendUserId) return false;
  const riderName = user.nickname || user.full_name || 'A rider';
  const title = `${riderName} invited you to a ride`;
  const body = destination ? `Meet at ${destination.name}. Tap to navigate.` : 'Tap to join the ride.';
  const data = JSON.stringify({
    rider_id: user.id,
    rider_name: riderName,
    lat: destination?.lat ?? null,
    lng: destination?.lng ?? null,
    name: destination?.name || null,
  });
  await base44.entities.Notification.create({
    type: 'ride_invite',
    title,
    body,
    recipient_id: friendUserId,
    data,
    action_url: '/community',
    is_read: false,
  });
  return true;
}