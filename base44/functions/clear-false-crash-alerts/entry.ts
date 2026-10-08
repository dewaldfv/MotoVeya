import { createClientFromRequest } from 'npm:@base44/sdk@0.8.52';

/**
 * Clears weekly crash alerts flagged as false_alarm for the authenticated rider.
 * Deletes CrashAlert records with status "false_alarm" and timestamp within the
 * last 7 days. Returns the count of cleared records so the caller can refresh.
 */
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    // Find weekly false-alarm crash alerts for the current rider.
    const falseAlarms = await svc.entities.CrashAlert.filter(
      { rider_id: me.id, status: 'false_alarm', timestamp: { $gte: weekAgo } },
      '-timestamp',
      200
    );

    if (!falseAlarms || falseAlarms.length === 0) {
      return Response.json({ cleared: 0 });
    }

    // Delete each record individually so per-record side effects fire correctly.
    let cleared = 0;
    for (const alert of falseAlarms) {
      try {
        await svc.entities.CrashAlert.delete(alert.id);
        cleared++;
      } catch (e) {
        console.error('clear-false-crash-alerts: failed to delete', alert.id, e);
      }
    }

    return Response.json({ cleared });
  } catch (error) {
    console.error('clear-false-crash-alerts error', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}