import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';
import { planIncludes, grantPlan } from '../../shared/planEntitlements.ts';

/**
 * Server-authoritative event writer.
 * Only Organizers (Organizer, Organizer+, Gold — paid or admin granted) and
 * admins/moderators may submit events. Published events are edited by admins
 * directly; organizers send a change request for approval.
 */
const CONTENT_FIELDS = [
  'title', 'description', 'event_date', 'end_date', 'venue_name', 'lat', 'lng',
  'contact_phone', 'contact_email', 'booking_link', 'entry_fee_zar', 'photo_urls',
  'category', 'markerIcon', 'marker_asset', 'marker_text', 'motoveya_event_id',
];

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

// Mirrors isOrganizer() in src/lib/plans.js.
function hasOrganizerEntitlement(me) {
  if (planIncludes(grantPlan(me.plan_grant)).organizer) return true;
  const status = me.organizer_status;
  if (status !== 'active' && status !== 'cancelled') return false;
  if (me.organizer_expiry && new Date(me.organizer_expiry) <= new Date()) return false;
  return true;
}

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!me?.id) return Response.json({ error: 'Authentication required' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const action = body.action === 'edit' ? 'edit' : 'create';
    const svc = base44.asServiceRole;
    const staff = isStaff(me);

    if (!staff && !hasOrganizerEntitlement(me)) {
      return Response.json(
        { error: 'An Organizer plan is required to submit events', code: 'organizer_required' },
        { status: 403 }
      );
    }

    const data = body.data && typeof body.data === 'object' ? body.data : {};
    const payload = pick(data, CONTENT_FIELDS);

    if (action === 'create') {
      if (!payload.title || !payload.event_date || !payload.venue_name) {
        return Response.json({ error: 'A title, date and venue are required' }, { status: 400 });
      }

      const created = await svc.entities.Event.create({
        ...payload,
        status: 'pending',
        created_by_id: me.id,
      });
      return Response.json({ event: created });
    }

    // edit
    const eventId = body.event_id;
    if (!eventId) return Response.json({ error: 'event_id required' }, { status: 400 });

    const existing = await svc.entities.Event.get(eventId).catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!existing) return Response.json({ error: 'Event not found' }, { status: 404 });

    if (staff) {
      const updated = await svc.entities.Event.update(eventId, { ...payload, status: 'approved' });
      return Response.json({ event: updated });
    }

    if (existing.created_by_id !== me.id) {
      return Response.json({ error: 'You can only edit your own events' }, { status: 403 });
    }

    const request = await svc.entities.EventEditRequest.create({
      event_id: eventId,
      submitted_by_id: me.id,
      change_payload: JSON.stringify(payload),
      status: 'pending',
      submitted_at: new Date().toISOString(),
    });
    return Response.json({ edit_request: request });
  } catch (error) {
    console.error('submit-event error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
}