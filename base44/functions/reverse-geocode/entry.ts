Deno.serve(async (req) => {
  try {
    const body = await req.json().catch(() => ({}));
    const lat = Number(body?.lat);
    const lng = Number(body?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'Missing coordinates' }, { status: 400 });
    }
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=14&addressdetails=1`,
      { headers: { 'User-Agent': 'MotoVeya-App/1.0' } }
    );
    if (!res.ok) return Response.json({ name: null });
    const data = await res.json();
    const name =
      data?.name ||
      data?.address?.suburb ||
      data?.address?.town ||
      data?.address?.city ||
      data?.address?.village ||
      data?.display_name?.split(',')[0] ||
      null;
    return Response.json({ name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});