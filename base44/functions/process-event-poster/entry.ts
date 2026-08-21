import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

const EVENT_CATEGORIES = ['rally','breakfast_run','pub_ride','birthday_bash','camping','track_day','charity_ride','bike_night','scenic_ride','day_jol','other'];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!['organizer','admin','moderator'].includes(me.role)) return Response.json({ error: 'Only organisers can process event posters.' }, { status: 403 });

    const { image_url, submission_id } = await req.json().catch(() => ({}));
    if (!image_url) return Response.json({ error: 'Missing image_url.' }, { status: 400 });

    const svc = base44.asServiceRole;
    let submission = submission_id ? await svc.entities.EventSubmission.get(submission_id) : null;
    if (!submission) {
      submission = await svc.entities.EventSubmission.create({
        source_image_url: image_url,
        processing_status: 'processing',
      });
    } else {
      await svc.entities.EventSubmission.update(submission.id, { processing_status: 'processing', source_image_url: image_url });
    }

    const prompt = `You are the event-data extraction engine for MotoVeya, a South African motorcycle events app. Analyze the uploaded event poster image and extract ONLY information that is visibly supported by the poster. Never invent missing information. Return JSON matching the supplied schema. Infer event category only from the poster wording/visual context. Dates/times must be ISO-8601 when possible; if a time is absent, use the date at 00:00:00 and set time_confidence low. If a location is not clear, leave latitude/longitude null and provide the best venue/address text. Extract South African rand amounts as numbers. Detect phone, email and booking/website URLs. Also provide a concise rider-facing description. Confidence values are 0-1.`;

    const result = await svc.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [image_url],
      response_json_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          description: { type: 'string' },
          event_date: { type: 'string' },
          end_date: { type: 'string' },
          venue_name: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          province: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          contact_phone: { type: 'string' },
          contact_email: { type: 'string' },
          booking_link: { type: 'string' },
          entry_fee_zar: { type: 'number' },
          category: { type: 'string', enum: EVENT_CATEGORIES },
          confidence_score: { type: 'number' },
          location_confidence: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } },
        },
        required: ['title','description','event_date','venue_name','category','confidence_score','location_confidence','missing_fields']
      }
    });

    const data = normalize(result || {});
    const needsReview = !data.title || !data.event_date || !data.venue_name || data.confidence_score < 0.75 || data.location_confidence < 0.75 || data.lat == null || data.lng == null;
    const status = needsReview ? 'needs_review' : 'ready';

    await svc.entities.EventSubmission.update(submission.id, {
      extracted_data: JSON.stringify(data),
      confidence_score: data.confidence_score,
      location_confidence: data.location_confidence,
      processing_status: status,
      error_message: needsReview ? 'Review the extracted details and confirm the event location before publishing.' : undefined,
    });

    return Response.json({ success: true, submission_id: submission.id, status, data });
  } catch (error) {
    console.error('process-event-poster error', error);
    return Response.json({ error: error?.message || 'Failed to process event poster.' }, { status: 500 });
  }
});

function normalize(v) {
  const out = { ...v };
  if (!EVENT_CATEGORIES.includes(out.category)) out.category = 'other';
  for (const key of ['lat','lng','entry_fee_zar','confidence_score','location_confidence']) {
    if (out[key] === '' || out[key] == null || Number.isNaN(Number(out[key]))) out[key] = null;
    else out[key] = Number(out[key]);
  }
  if (!Array.isArray(out.missing_fields)) out.missing_fields = [];
  return out;
}