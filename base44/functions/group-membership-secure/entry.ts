import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveEntitlement } from '../../shared/entitlement.ts';

const FREE_LIMIT = 2;
const PREMIUM_LIMIT = 32;
const ALL_PREMIUM_LIMIT = 64;

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
    const myEntitlement = await resolveEntitlement(svc, me.id);
    const premium = myEntitlement.is_premium;

    if (action === 'create') {
      const name = String(body.name || '').trim();
      if (!name) return Response.json({ error: 'Group name required' }, { status: 400 });
      // Creator is the sole member at creation; if Premium the group starts
      // all-Premium and qualifies for the 64-rider capacity.
      const maxMembers = premium ? ALL_PREMIUM_LIMIT : FREE_LIMIT;
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

    // Determine whether every current member (leader included) AND the joining
    // rider all have active Premium. Only then does the 64-rider capacity apply.
    const allMemberIds = [...new Set([...(activeMembers || []).map((m) => m.user_id), me.id])];
    const allEntitlements = await Promise.all(allMemberIds.map((id) => resolveEntitlement(svc, id)));
    const isAllPremium = allEntitlements.every((e) => e.is_premium);

    const configuredLimit = Number(group.max_members || FREE_LIMIT);
    let effectiveLimit;
    if (isAllPremium) {
      effectiveLimit = ALL_PREMIUM_LIMIT;
    } else {
      effectiveLimit = Math.min(configuredLimit, premium ? PREMIUM_LIMIT : FREE_LIMIT);
    }

    // Keep the stored max_members in sync with the effective limit so the
    // frontend capacity display stays accurate.
    if (effectiveLimit !== configuredLimit) {
      await svc.entities.Group.update(groupId, { max_members: effectiveLimit });
    }

    if ((activeMembers || []).length >= effectiveLimit) {
      let message;
      if (isAllPremium) {
        message = 'This group has reached its 64-rider Premium capacity.';
      } else if (premium) {
        message = 'Group is full. All members need Premium to unlock the 64-rider capacity.';
      } else {
        message = 'Group is full. Upgrade to Premium for larger groups.';
      }
      return Response.json({ error: message, max_members: effectiveLimit, all_premium: isAllPremium }, { status: 409 });
    }

    const membership = await svc.entities.GroupMember.create({
      group_id: groupId,
      user_id: me.id,
      user_name: me.full_name || 'Rider',
      user_nickname: me.nickname,
      role: 'member',
      status: 'active',
    });
    return Response.json({ membership, max_members: effectiveLimit, is_premium: premium, all_premium: isAllPremium });
  } catch (error) {
    console.error('group-membership-secure error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}