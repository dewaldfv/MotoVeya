import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Returns (a) the caller's own active Saved Places and (b) all active Saved
 * Places of any rider who shares at least one active group membership with the
 * caller. Cross-user reads go through asServiceRole — the SavedPlace RLS stays
 * owner-only. The user chose "All their places", so every Saved Place of a
 * group-mate is returned regardless of that place's group_ids.
 */
export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const svc = base44.asServiceRole;

    const own = await svc.entities.SavedPlace.filter({ created_by_id: me.id, active: true }, '-created_date', 50);

    const memberships = await svc.entities.GroupMember.filter({ user_id: me.id, status: 'active' });
    const groupIds = [...new Set((memberships || []).map((m: any) => m.group_id))];

    let group: any[] = [];
    if (groupIds.length) {
      const mateIds = new Set<string>();
      for (const gid of groupIds) {
        const members = await svc.entities.GroupMember.filter({ group_id: gid, status: 'active' });
        for (const m of (members || [])) if (m.user_id !== me.id) mateIds.add(m.user_id);
      }

      const mateList = [...mateIds].slice(0, 40);
      const ownerIds = new Set<string>();
      for (const mateId of mateList) {
        const places = await svc.entities.SavedPlace.filter({ created_by_id: mateId, active: true }, '-created_date', 50);
        for (const p of (places || [])) {
          ownerIds.add(p.created_by_id);
          group.push({ ...p, owner_id: p.created_by_id });
        }
      }

      if (ownerIds.size) {
        const userMap = new Map<string, any>();
        for (const oid of ownerIds) {
          try { userMap.set(oid, await svc.entities.User.get(oid)); } catch {}
        }
        group = group.map((p) => ({
          ...p,
          owner_name: userMap.get(p.owner_id)?.nickname || userMap.get(p.owner_id)?.full_name || 'Rider',
        }));
      }
    }

    return Response.json({ own: own || [], group });
  } catch (error) {
    console.error('get-visible-saved-places error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}