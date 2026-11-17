import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Permanently deletes a past event together with every record that references it.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Admin access required' }, { status: 403 });

    const { event_id } = await req.json().catch(() => ({}));
    if (!event_id) return Response.json({ error: 'event_id is required' }, { status: 400 });

    const event = await base44.asServiceRole.entities.Event.get(event_id)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!event) return Response.json({ error: 'Event not found' }, { status: 404 });
    if (!event.event_date || new Date(event.event_date).getTime() >= Date.now()) {
      return Response.json({ error: 'Only past events can be deleted' }, { status: 400 });
    }

    // Related records go first, so nothing is left pointing at a deleted event.
    const related = await Promise.allSettled([
      base44.asServiceRole.entities.EventPhoto.deleteMany({ event_id }),
      base44.asServiceRole.entities.EventFavorite.deleteMany({ event_id }),
      base44.asServiceRole.entities.EventEditRequest.deleteMany({ event_id }),
      base44.asServiceRole.entities.EventRevision.deleteMany({ event_id }),
      base44.asServiceRole.entities.EventEditAudit.deleteMany({ event_id }),
      base44.asServiceRole.entities.EventSubmission.deleteMany({ event_id }),
    ]);
    const failed = related.find((r) => r.status === 'rejected');
    if (failed) {
      return Response.json({ error: `Could not delete related records: ${failed.reason?.message || 'unknown error'}` }, { status: 500 });
    }
    const deleted = related.reduce((total, r) => total + (r.value?.deleted || 0), 0);

    await base44.asServiceRole.entities.Event.delete(event_id);

    return Response.json({ success: true, deleted_related_records: deleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}