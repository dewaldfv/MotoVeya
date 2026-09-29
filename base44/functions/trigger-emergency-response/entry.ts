import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runEmergencyResponse } from '../../shared/emergencyResponse.ts';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { status, body: respBody } = await runEmergencyResponse(base44, user, body);
    return Response.json(respBody, { status });
  } catch (error) {
    console.error('Rider Down response error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});