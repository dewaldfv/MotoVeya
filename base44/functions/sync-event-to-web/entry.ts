import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const WEB_ENDPOINT = 'https://web-motoveya.base44.app/functions/syncMotoGoEvents';
const SYNC_KEY = 'MV_EVENT_SYNC_6a474c2524cd25817436fd3b_20260930_7f4d9c2a';

function payloadFromEvent(ev:any) {
  return {
    motogo_event_id: ev.motoveya_event_id || ev.id,
    title: ev.title,
    description: ev.description || '',
    event_date: ev.event_date,
    end_date: ev.end_date || null,
    venue_name: ev.venue_name || '',
    lat: ev.lat ?? null,
    lng: ev.lng ?? null,
    contact_phone: ev.contact_phone || '',
    contact_email: ev.contact_email || '',
    booking_link: ev.booking_link || '',
    entry_fee_zar: ev.entry_fee_zar ?? 0,
    photo_urls: Array.isArray(ev.photo_urls) ? ev.photo_urls : [],
    status: ev.status || 'pending',
    category: ev.category || 'other',
    markerIcon: ev.markerIcon || '',
    source_app: 'motoveya',
    source_updated_at: ev.updated_date || new Date().toISOString()
  };
}

export default async function(req:any) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || !['admin','moderator'].includes(user.role)) {
      return Response.json({ error: 'Admin or moderator access required' }, { status: 403 });
    }

    const body = await req.json();
    const eventId = body?.event_id;
    if (!eventId) return Response.json({ error: 'event_id is required' }, { status: 400 });

    const ev = await base44.asServiceRole.entities.Event.get(eventId);
    if (!ev) return Response.json({ error: 'Event not found' }, { status: 404 });

    if (!ev.motoveya_event_id) {
      await base44.asServiceRole.entities.Event.update(ev.id, {
        motoveya_event_id: ev.id,
        web_sync_status: 'pending',
        web_sync_error: ''
      });
      ev.motoveya_event_id = ev.id;
    }

    const response = await fetch(WEB_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-MotoVeya-Sync-Key': SYNC_KEY
      },
      body: JSON.stringify({ event: payloadFromEvent(ev) })
    });

    const text = await response.text();
    let result:any;
    try { result = JSON.parse(text); } catch { result = { raw: text }; }

    if (!response.ok || result?.error) {
      await base44.asServiceRole.entities.Event.update(ev.id, {
        web_sync_status: 'failed',
        web_sync_error: String(result?.error || text || `HTTP ${response.status}`).slice(0,1000)
      });
      return Response.json({ ok:false, event_id: ev.id, error: result?.error || text }, { status: 502 });
    }

    await base44.asServiceRole.entities.Event.update(ev.id, {
      web_sync_status: 'synced',
      web_sync_error: '',
      web_synced_at: new Date().toISOString()
    });

    return Response.json({ ok:true, event_id:ev.id, result });
  } catch (error:any) {
    return Response.json({ error: error?.message || 'Sync failed' }, { status: 500 });
  }
}