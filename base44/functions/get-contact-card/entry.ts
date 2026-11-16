import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

/**
 * Display card for an event organizer or service provider a rider wants to
 * message. Returns only public display fields.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const userId = body?.user_id;
    if (!userId || typeof userId !== 'string') {
      return Response.json({ error: 'user_id is required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const profile = await svc.entities.User.get(userId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!profile) return Response.json({ error: 'Not found' }, { status: 404 });

    return Response.json({
      user_id: userId,
      name: profile.nickname || profile.full_name || 'Rider',
      avatar_url: profile.avatar_url || null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}