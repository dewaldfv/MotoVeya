import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    const body = await req.json();
    const serviceId = body?.service_id;
    if (!serviceId) return Response.json({ error: 'service_id required' }, { status: 400 });
    let service;
    try {
      service = await base44.asServiceRole.entities.Service.get(serviceId);
    } catch (_) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    if (!service) return Response.json({ error: 'Not found' }, { status: 404 });
    const newCount = (service.view_count || 0) + 1;
    await base44.asServiceRole.entities.Service.update(serviceId, { view_count: newCount });
    return Response.json({ view_count: newCount });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}