import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

function isPremium(subscriptions) {
  const now = new Date();
  return (subscriptions || []).some((sub) =>
    sub.plan === 'premium' && ['active', 'trialing'].includes(sub.status) &&
    (!sub.expiry_date || new Date(sub.expiry_date) > now)
  );
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json().catch(() => ({}));
    const action = body.action;
    const groupId = body.group_id;
    if (!['create', 'join', 'leave'].includes(action)) {
      return Response.json({ error: 'valid action required' }, { status: 400 });
    }
    if (action !== 'create' && !groupId) {
      return Response.json({ error: 'group_id required' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const premium = isPremium(await svc.entities.Subscription.filter({ user_id: me.id }, '-created_date', 50));

    if (action === 'create') {
      const name = String(body.name || '').trim();
      if (!name) return Response.json({ error: 'Group name required' }, { status: 400 });
      const maxMembers = premium ? 32 : 2;
      const inviteCode = String(body.invite_code || '').trim().toUpperCase().slice(0, 12);
      if (!inviteCode) return Response.json({ error: 'Invite code required' }, { status: 400 });

      const group = await svc.entities.Group.create({
        name,
        invite_code: inviteCode,
        max_members: maxMembers,
        created_by_name: me.nickname || me.full_name || 'Rider',
        is_active: true,
      });
      await svc.entities.GroupMember.create({
        group_id: group.id,
        user_id: me.id,
        user_name: me.full_name || 'Rider',
        user_nickname: me.nickname,
        role: 'leader',
        status: 'active',
      });
      return Response.json({ group, max_members: maxMembers, is_premium: premium });
    }

    const group = await svc.entities.Group.get(groupId).catch(() => null);
    if (!group || !group.is_active) return Response.json({ error: 'Group not found' }, { status: 404 });

    const mine = (await svc.entities.GroupMember.filter({ group_id: groupId, user_id: me.id }))?.[0];

    if (action === 'leave') {
      if (!mine || mine.status !== 'active') return Response.json({ error: 'Not an active member' }, { status: 400 });
      await svc.entities.GroupMember.update(mine.id, { status: 'left' });
      return Response.json({ success: true });
    }

    if (mine?.status === 'active') return Response.json({ success: true, already_member: true });

    const activeMembers = await svc.entities.GroupMember.filter({ group_id: groupId, status: 'active' });
    const serverLimit = premium ? 32 : 2;
    const configuredLimit = Number(group.max_members || 2);
    const effectiveLimit = Math.min(configuredLimit, serverLimit);
    if ((activeMembers || []).length >= effectiveLimit) {
      return Response.json({ error: 'Group is full', max_members: effectiveLimit }, { status: 409 });
    }

    const membership = await svc.entities.GroupMember.create({
      group_id: groupId,
      user_id: me.id,
      user_name: me.full_name || 'Rider',
      user_nickname: me.nickname,
      role: 'member',
      status: 'active',
    });
    return Response.json({ membership, max_members: effectiveLimit, is_premium: premium });
  } catch (error) {
    console.error('group-membership-secure error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
