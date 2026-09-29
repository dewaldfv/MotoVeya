import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const groupId = body?.group_id;
    if (!groupId) return Response.json({ error: 'group_id required' }, { status: 400 });

    const svc = base44.asServiceRole;

    // Verify the caller is a member of this group.
    const myMembership = await svc.entities.GroupMember.filter({ group_id: groupId, user_id: me.id, status: 'active' });
    if (!myMembership || myMembership.length === 0) {
      return Response.json({ error: 'Not a member of this group' }, { status: 403 });
    }

    const members = await svc.entities.GroupMember.filter({ group_id: groupId, status: 'active' }, '-created_date', 50);

    const sorted = (members || []).sort((a, b) => {
      if (a.role === 'leader' && b.role !== 'leader') return -1;
      if (a.role !== 'leader' && b.role === 'leader') return 1;
      return 0;
    });

    const result = [];
    for (const m of sorted) {
      let profile = null;
      try { profile = await svc.entities.User.get(m.user_id); } catch (e) { /* private */ }
      const lastSeenAt = profile?.last_seen_at || null;
      const online = !!(lastSeenAt && Date.now() - new Date(lastSeenAt).getTime() < 3 * 60 * 1000);
      result.push({
        id: m.id,
        user_id: m.user_id,
        role: m.role,
        name: profile?.nickname || profile?.full_name || m.user_name || 'Rider',
        nickname: profile?.nickname || m.user_nickname || null,
        avatar_url: profile?.avatar_url || null,
        cover_url: profile?.cover_url || null,
        online,
        last_seen_at: lastSeenAt,
      });
    }

    return Response.json({ members: result });
  } catch (error) {
    console.error('get-group-members-secure error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}