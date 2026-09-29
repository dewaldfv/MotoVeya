// Token-authenticated crash ingestion for the native background service.
// The native layer has no live user session when the screen is locked, so it
// authenticates with the device_token registered via register-native-device.
// Resolves the device -> user, then runs the same rider-down logic as the
// session-based trigger-emergency-response.

import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { runEmergencyResponse } from '../../shared/emergencyResponse.ts';

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const token = String(body.device_token || '');
    if (token.length < 32) {
      return Response.json({ error: 'Invalid device token' }, { status: 400 });
    }

    const hash = await sha256(token);
    const devices = await base44.asServiceRole.entities.NativeDevice.filter(
      { device_token_hash: hash }, '-created_date', 1
    );
    const device = devices?.[0];
    if (!device || device.tracking_enabled === false) {
      return Response.json({ error: 'Device not registered or tracking disabled' }, { status: 403 });
    }

    const user = await base44.asServiceRole.entities.User.get(device.user_id);
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const { status, body: respBody } = await runEmergencyResponse(base44, user, body);
    return Response.json(respBody, { status });
  } catch (error) {
    console.error('trigger-emergency-native:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});