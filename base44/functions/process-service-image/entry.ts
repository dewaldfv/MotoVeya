import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

const SERVICE_CATEGORY_KEYS = [
  'maintenance_repair', 'tyres_wheels', 'batteries', 'oil_lubricants', 'spare_parts',
  'dealerships', 'riding_gear', 'custom_paint', 'custom_builders', 'performance_tuning',
  'electrical', 'suspension', 'chains_sprockets', 'detailing', 'transport',
  'roadside_assist', 'training_schools', 'photography',
  'food_restaurant', 'food_pub_bar', 'food_cafe', 'food_fast_food', 'food_breakfast',
  'food_bakery', 'food_market', 'other',
];

export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { image_url, food_only } = await req.json().catch(() => ({}));
    if (!image_url || typeof image_url !== 'string') {
      return Response.json({ error: 'Missing image_url.' }, { status: 400 });
    }

    const svc = base44.asServiceRole;
    const allowed = food_only
      ? SERVICE_CATEGORY_KEYS.filter((k) => k.startsWith('food_'))
      : SERVICE_CATEGORY_KEYS;

    const prompt = `You are the service-listing data extraction engine for MotoVeya, a South African motorcycle app. Analyze the uploaded image (a business card, flyer, shop front, logo or photo of a motorcycle business) and extract ONLY information that is visibly supported by the image. Never invent details. Return JSON matching the supplied schema. Pick the single best-fitting business category from the provided enum. Extract phone, email and website/social links exactly as printed. Extract operating hours into a compact string such as "Mon-Fri 08:00-17:00, Sat 08:00-13:00"; set is_open_24h only when the image states 24 hours or 24/7. Extract any printed pricing into price_range (for example "R1500 - R10 000") and list the services or products offered into service_menu, one per line. Provide a concise rider-facing description of the business. Extract the South African town/city and province if visible, plus the street address. If the image suggests coordinates or a clear street address, provide latitude/longitude; otherwise leave them null. Confidence values are 0-1.`;

    const result = await svc.integrations.Core.InvokeLLM({
      prompt,
      file_urls: [image_url],
      response_json_schema: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          category: { type: 'string', enum: allowed },
          description: { type: 'string' },
          address: { type: 'string' },
          town: { type: 'string' },
          province: { type: 'string' },
          lat: { type: 'number' },
          lng: { type: 'number' },
          phone: { type: 'string' },
          email: { type: 'string' },
          website: { type: 'string' },
          opening_hours: { type: 'string' },
          is_open_24h: { type: 'boolean' },
          price_range: { type: 'string' },
          service_menu: { type: 'string' },
          social_links: { type: 'string' },
          confidence_score: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } },
        },
        required: ['name', 'category', 'description', 'confidence_score', 'missing_fields'],
      },
    });

    const data = normalize(result || {}, allowed);

    if ((data.lat == null || data.lng == null) && (data.address || data.town || data.name)) {
      const geo = await geocodeLocation([data.name, data.address, data.town, data.province, 'South Africa'].filter(Boolean).join(', '));
      if (geo) {
        data.lat = geo.lat;
        data.lng = geo.lng;
      }
    }

    return Response.json({ success: true, data });
  } catch (error) {
    console.error('process-service-image error', error);
    return Response.json({ error: error?.message || 'Failed to read the service image.' }, { status: 500 });
  }
}

function normalize(v, allowed) {
  const out = { ...v };
  if (!allowed.includes(out.category)) out.category = allowed[0];
  for (const key of ['lat', 'lng', 'confidence_score']) {
    if (out[key] === '' || out[key] == null || Number.isNaN(Number(out[key]))) out[key] = null;
    else out[key] = Number(out[key]);
  }
  out.is_open_24h = !!out.is_open_24h;
  if (!Array.isArray(out.missing_fields)) out.missing_fields = [];
  for (const key of ['name', 'description', 'address', 'town', 'province', 'phone', 'email', 'website', 'opening_hours', 'price_range', 'service_menu', 'social_links']) {
    out[key] = typeof out[key] === 'string' ? out[key].trim() : '';
  }
  return out;
}

async function geocodeLocation(query) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=za&q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'MotoVeya-App/1.0' }, signal: AbortSignal.timeout(9000) },
    );
    if (!res.ok) return null;
    const rows = await res.json();
    if (!rows?.[0]) return null;
    return { lat: Number(rows[0].lat), lng: Number(rows[0].lon) };
  } catch (_) {
    return null;
  }
}