import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Server-authoritative service listing writer.
 * Only Service Providers (active provider entitlement) and admins/moderators
 * may create or edit listings, providers only their own, and providers are
 * capped at 10 listings that are approved or pending review.
 */
const SLOT_LIMIT = 10;
const COUNTED_STATUSES = ['pending', 'approved', 'rejected_needs_changes'];

const CONTENT_FIELDS = [
  'name', 'category', 'description', 'logo_url', 'photo_urls', 'lat', 'lng',
  'address', 'town', 'province', 'phone', 'website', 'email', 'opening_hours',
  'is_open_24h', 'price_range', 'service_menu', 'social_links', 'submitter_notes',
];

const ADMIN_FIELDS = ['status', 'rejection_reason', 'is_verified', 'is_featured', 'is_premium_partner'];

function pick(data, fields) {
  const out = {};
  for (const key of fields) {
    if (data[key] !== undefined) out[key] = data[key];
  }
  return out;
}

function isStaff(me) {
  return me?.role === 'admin' || me?.role === 'moderator';
}

async function hasProviderEntitlement(svc, userId) {
  const now = new Date();
  const subs = await svc.entities.Subscription.filter({ user_id: userId, plan: 'provider' }, '-created_date', 10);
  return subs.some((s) => {
    if (!['active', 'trialing', 'cancelled', 'past_due'].includes(s.status)) return false;
    if (s.expiry_date && new Date(s.expiry_date) <= now) return false;
    return true;
  });
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    let me;
    try {
      me = await base44.auth.me();
    } catch (e) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }
    if (!me?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action === 'update' ? 'update' : 'create';
    const svc = base44.asServiceRole;
    const staff = isStaff(me);

    // An admin-granted provider counts as entitled without a paid package.
    const entitled = me.provider_grant === 'admin' || (await hasProviderEntitlement(svc, me.id));
    if (!staff && !entitled) {
      return Response.json(
        { error: 'A Service Provider package is required to manage listings', code: 'provider_required' },
        { status: 403 }
      );
    }

    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const fields = staff ? [...CONTENT_FIELDS, ...ADMIN_FIELDS] : CONTENT_FIELDS;
    const payload = pick(data, fields);

    if (action === 'create') {
      if (!payload.name || !payload.category) {
        return Response.json({ error: 'A business name and category are required' }, { status: 400 });
      }
      if (typeof payload.lat !== 'number' || typeof payload.lng !== 'number') {
        return Response.json({ error: 'A location is required' }, { status: 400 });
      }

      if (!staff) {
        const existing = await svc.entities.Service.filter({ created_by_id: me.id }, '-created_date', 500);
        const used = (existing || []).filter((s) => s.status === 'pending' || s.status === 'approved').length;
        if (used >= SLOT_LIMIT) {
          return Response.json(
            {
              error: `You have used all ${SLOT_LIMIT} listing slots. Remove or wait for a pending listing to be rejected to free one up.`,
              code: 'slot_limit_reached',
              slots_used: used,
              slot_limit: SLOT_LIMIT,
            },
            { status: 409 }
          );
        }
      }

      const created = await svc.entities.Service.create({
        ...payload,
        status: staff && payload.status ? payload.status : 'pending',
        created_by_id: me.id,
      });
      return Response.json({ service: created, slot_limit: SLOT_LIMIT });
    }

    // update
    const serviceId = body.service_id;
    if (!serviceId) return Response.json({ error: 'service_id required' }, { status: 400 });

    const existing = await svc.entities.Service.get(serviceId).catch(() => null);
    if (!existing) return Response.json({ error: 'Listing not found' }, { status: 404 });

    if (!staff && existing.created_by_id !== me.id) {
      return Response.json({ error: 'You can only edit your own listings' }, { status: 403 });
    }

    const updated = await svc.entities.Service.update(serviceId, payload);
    return Response.json({ service: updated, slot_limit: SLOT_LIMIT });
  } catch (error) {
    console.error('manage-service-listing error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}