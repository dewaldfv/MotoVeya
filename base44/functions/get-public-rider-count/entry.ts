import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Public marketing statistic: returns the number of registered MotoVeya
// accounts in the canonical app. No user records or personal data are exposed.
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    let total = 0;
    const pageSize = 500;
    let skip = 0;

    while (true) {
      const page = await base44.asServiceRole.entities.User.list(
        '-created_date',
        pageSize,
        skip,
        ['id']
      );
      const count = page?.length || 0;
      total += count;
      if (count < pageSize) break;
      skip += pageSize;
    }

    return Response.json({
      riders: total,
      source: 'canonical_registered_motoveya_accounts',
      generated_at: new Date().toISOString(),
    }, {
      headers: {
        'Cache-Control': 'public, max-age=30, s-maxage=30',
      },
    });
  } catch (error) {
    console.error('get-public-rider-count error:', error);
    return Response.json({ error: 'Unable to load rider count' }, { status: 500 });
  }
});
