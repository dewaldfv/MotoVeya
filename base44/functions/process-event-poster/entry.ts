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

    const prompt = `You are the event-data extraction engine for MotoVeya, a South African motorcycle events app. Analyze the uploaded event poster image and extract ONLY information that is visibly supported by the poster. Never invent missing information. Return JSON matching the supplied schema. Infer event category only from the poster wording/visual context. Dates/times must be ISO-8601 when possible; if a time is absent, use the date at 00:00:00 and set time_confidence low. If a location is not clear, leave latitude/longitude null and provide the best venue/address text. Extract South African rand amounts as numbers. Detect phone, email and booking/website URLs. Also provide a concise rider-facing description. Confidence values are 0-1. Also extract the event name exactly as it appears in the most prominent lettering on the poster into marker_text, and describe that lettering through marker_family, marker_weight, marker_italic, marker_uppercase, marker_spacing and marker_color so a matching text-only map marker can be rebuilt; marker_color must be the hex colour of the lettering. If no event name is clearly legible, return an empty marker_text.`;

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
          marker_text: { type: 'string' },
          marker_family: { type: 'string', enum: ['sans','condensed','serif','mono','cursive','fantasy'] },
          marker_weight: { type: 'string', enum: ['400','700','900'] },
          marker_italic: { type: 'boolean' },
          marker_uppercase: { type: 'boolean' },
          marker_spacing: { type: 'number' },
          marker_color: { type: 'string' },
          confidence_score: { type: 'number' },
          location_confidence: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } },
        },
        required: ['title','description','event_date','venue_name','category','confidence_score','location_confidence','missing_fields']
      }
    });

    const data = normalize(result || {});

    const markerSvg = buildTextMarkerSvg(data);
    const marker_asset = markerSvg ? `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markerSvg)}` : null;
    const marker_text = markerSvg ? String(data.marker_text || '').trim() : '';
    const marker_error = marker_asset ? null : 'We could not read a clear event name from this image. Please upload a clearer image.';

    if ((data.lat == null || data.lng == null) && (data.address || data.venue_name || data.city)) {
      const geo = await geocodeLocation([data.venue_name, data.address, data.city, data.province, 'South Africa'].filter(Boolean).join(', '));
      if (geo) {
        data.lat = geo.lat;
        data.lng = geo.lng;
        data.location_confidence = Math.max(data.location_confidence || 0, geo.confidence);
      }
    }
    const needsReview = !data.title || !data.event_date || !data.venue_name || data.confidence_score < 0.75 || data.location_confidence < 0.75 || data.lat == null || data.lng == null;
    const status = needsReview ? 'needs_review' : 'ready';

    await svc.entities.EventSubmission.update(submission.id, {
      extracted_data: JSON.stringify(data),
      confidence_score: data.confidence_score,
      location_confidence: data.location_confidence,
      processing_status: status,
      error_message: needsReview ? 'Review the extracted details and confirm the event location before publishing.' : undefined,
    });

    return Response.json({ success: true, submission_id: submission.id, status, data, marker_asset, marker_text, marker_error });
  } catch (error) {
    console.error('process-event-poster error', error);
    return Response.json({ error: error?.message || 'Failed to process event poster.' }, { status: 500 });
  }
});

async function geocodeLocation(query) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'MotoVeya-App/1.0' } });
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.[0]) return null;
    const importance = Number(rows[0].importance || 0);
    return { lat: Number(rows[0].lat), lng: Number(rows[0].lon), confidence: Math.min(0.9, Math.max(0.75, importance || 0.75)) };
  } catch (_) { return null; }
}

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

// Font stacks the SVG renderer can resolve everywhere. Generic families are used
// as the final fallback so the marker always draws even if a named face is absent.
const MARKER_FONTS = {
  sans: "'Helvetica Neue', Arial, Helvetica, sans-serif",
  condensed: "'Arial Narrow', Impact, 'Helvetica Neue', sans-serif",
  serif: "Georgia, 'Times New Roman', Times, serif",
  mono: "'Courier New', Courier, monospace",
  cursive: "'Brush Script MT', 'Segoe Script', cursive",
  fantasy: "Impact, 'Arial Black', fantasy",
};
const MARKER_CHAR_FACTOR = { sans: 0.58, condensed: 0.46, serif: 0.55, mono: 0.62, cursive: 0.5, fantasy: 0.62 };

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}

// Builds a transparent-background SVG containing only the event name, styled to
// echo the lettering on the poster. Returns null when no name could be read.
function buildTextMarkerSvg(d) {
  const raw = String(d?.marker_text || '').trim();
  if (!raw) return null;
  const family = MARKER_FONTS[d.marker_family] ? d.marker_family : 'sans';
  const weight = ['400', '700', '900'].includes(String(d.marker_weight)) ? String(d.marker_weight) : '700';
  const italic = !!d.marker_italic;
  const text = d.marker_uppercase ? raw.toUpperCase() : raw;
  const spacing = Math.min(0.4, Math.max(0, Number(d.marker_spacing) || 0));
  const rgb = hexToRgb(d.marker_color);
  const fill = rgb ? `#${[rgb.r, rgb.g, rgb.b].map((v) => v.toString(16).padStart(2, '0')).join('')}` : '#ffffff';
  const fillLum = rgb ? (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255 : 1;
  const outline = fillLum > 0.6 ? '#0b0b0b' : '#ffffff';
  const charFactor = (MARKER_CHAR_FACTOR[family] || 0.58) * (weight === '900' ? 1.06 : weight === '700' ? 1.02 : 1);
  const PAD = 22;
  const MAX_W = 1600;
  const measure = (size) => text.length * size * charFactor + spacing * size * Math.max(0, text.length - 1);
  let fontSize = 68;
  if (measure(fontSize) > MAX_W) fontSize = Math.max(18, Math.floor((fontSize * MAX_W) / measure(fontSize)));
  const width = Math.ceil(measure(fontSize) + PAD * 2);
  const height = Math.ceil(fontSize * 1.5);
  const ls = (spacing * fontSize).toFixed(1);
  const x = (width / 2 + (spacing * fontSize) / 2).toFixed(1);
  const y = (height * 0.73).toFixed(1);
  const outlineW = Math.max(2, fontSize * 0.055).toFixed(1);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><text x="${x}" y="${y}" text-anchor="middle" font-family="${MARKER_FONTS[family]}" font-size="${fontSize}" font-weight="${weight}" font-style="${italic ? 'italic' : 'normal'}" letter-spacing="${ls}" fill="${fill}" stroke="${outline}" stroke-width="${outlineW}" stroke-linejoin="round" paint-order="stroke">${escapeXml(text)}</text></svg>`;
}

function escapeXml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}