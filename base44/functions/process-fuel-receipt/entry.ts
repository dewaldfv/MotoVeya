import { createClientFromRequest } from 'npm:@base44/sdk@0.8.31';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const me = await base44.auth.me();
    if (!me) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { image_url } = await req.json().catch(() => ({}));
    if (!image_url) return Response.json({ error: 'Missing image_url.' }, { status: 400 });

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are MotoVeya's fuel-receipt extraction engine for South African petrol-station receipts.
Extract ONLY information visibly supported by the receipt. Never invent values.
Identify the fuel station/merchant, transaction date, litres purchased, price per litre, total amount paid, odometer reading if printed, and fuel type if visible.
South African currency is ZAR. Convert numeric values to numbers without currency symbols.
A receipt may contain multiple numeric amounts; distinguish litres, unit price and total using labels and arithmetic consistency.
If a field is not visible or cannot be determined confidently, return null.
Return a confidence score from 0 to 1 based on the quality and consistency of the extraction.`,
      file_urls: [image_url],
      response_json_schema: {
        type: 'object',
        properties: {
          location_name: { type: ['string', 'null'] },
          refill_date: { type: ['string', 'null'] },
          litres: { type: ['number', 'null'] },
          fuel_price_per_litre: { type: ['number', 'null'] },
          total_cost: { type: ['number', 'null'] },
          odometer_km: { type: ['number', 'null'] },
          fuel_type: { type: ['string', 'null'] },
          confidence_score: { type: 'number' },
          missing_fields: { type: 'array', items: { type: 'string' } }
        },
        required: ['confidence_score', 'missing_fields']
      }
    });

    const data = normalize(result || {});
    return Response.json({ success: true, data });
  } catch (error) {
    console.error('process-fuel-receipt error', error);
    return Response.json({ error: error?.message || 'Failed to process fuel receipt.' }, { status: 500 });
  }
});

function normalize(v) {
  const out = { ...v };
  for (const key of ['litres', 'fuel_price_per_litre', 'total_cost', 'odometer_km', 'confidence_score']) {
    if (out[key] === '' || out[key] == null || Number.isNaN(Number(out[key]))) out[key] = null;
    else out[key] = Number(out[key]);
  }
  if (!Array.isArray(out.missing_fields)) out.missing_fields = [];
  return out;
}
