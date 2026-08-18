import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

/** Server-authoritative subscription entitlement. Never trust a client-supplied premium flag. */
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const svc = base44.asServiceRole;
    const now = new Date();
    const subs = await svc.entities.Subscription.filter({ user_id: me.id }, '-created_date', 50);