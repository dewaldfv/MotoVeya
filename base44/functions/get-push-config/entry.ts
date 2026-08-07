import { secrets } from 'base44:runtime';

// Returns the public VAPID key the client needs to subscribe to Web Push.
// The public key is safe to expose to the browser.
export default async function (req) {
  try {
    const vapidPublicKey = secrets.get('VAPID_PUBLIC_KEY') || null;
    if (!vapidPublicKey) {
      return Response.json({ error: 'Push notifications not configured' }, { status: 503 });
    }
    return Response.json({ vapidPublicKey });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}