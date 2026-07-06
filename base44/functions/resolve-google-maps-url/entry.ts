Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const url = (body?.url || '').trim();

    if (!url) {
      return Response.json({ error: 'Please paste a Google Maps link.' }, { status: 400 });
    }

    let finalUrl = url;
    let resolvedShortLink = false;

    // Resolve short links (maps.app.goo.gl, goo.gl/maps)
    if (/goo\.gl/i.test(url)) {
      try {
        const res = await fetch(url, { redirect: 'follow', headers: { 'User-Agent': 'Mozilla/5.0 MotoGo-App' } });
        finalUrl = res.url || url;
        resolvedShortLink = true;

        // If final URL still has no coords, try extracting a maps URL from the HTML body
        if (!extractCoords(finalUrl)) {
          const html = await res.text();
          const urlMatch = html.match(/https:\/\/www\.google\.com\/maps[^"'\s<>]+/i);
          if (urlMatch) finalUrl = urlMatch[0];
        }
      } catch (e) {
        console.error('Short link resolution failed:', e.message);
      }
    }

    const coords = extractCoords(finalUrl);
    if (!coords) {
      return Response.json({
        error: 'Could not find coordinates in this link. Please paste a valid Google Maps share link, dropped pin, or coordinates URL.',
      }, { status: 400 });
    }

    const placeName = extractPlaceName(finalUrl);

    let address = null;
    try {
      address = await reverseGeocode(coords.lat, coords.lng);
    } catch (e) {
      console.error('Reverse geocode failed:', e.message);
    }

    return Response.json({
      lat: coords.lat,
      lng: coords.lng,
      name: placeName,
      address: address,
      resolved_short_link: resolvedShortLink,
    });
  } catch (error) {
    console.error('resolve-google-maps-url error:', error.message);
    return Response.json({ error: 'Failed to process the link. Please try again.' }, { status: 500 });
  }
});

function extractCoords(url) {
  if (!url || typeof url !== 'string') return null;

  let parsed = null;
  try {
    parsed = new URL(url);
  } catch (e) {
    // not a valid URL object — fall through to generic regex
  }

  if (parsed) {
    // 1. ?q=lat,lng  ?query=lat,lng  ?ll=lat,lng
    for (const param of ['q', 'query', 'll']) {
      const val = parsed.searchParams.get(param);
      if (val) {
        const m = val.match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
        if (m) {
          const lat = parseFloat(m[1]);
          const lng = parseFloat(m[2]);
          if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
        }
      }
    }

    // 2. @lat,lng in path (e.g. /maps/place/.../@-28.4,29.1,15z)
    const atMatch = parsed.pathname.match(/@(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/);
    if (atMatch) {
      const lat = parseFloat(atMatch[1]);
      const lng = parseFloat(atMatch[2]);
      if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
    }
  }

  // 3. !3dlat!4dlng (common in full Google Maps data params, anywhere in URL)
  const d3 = url.match(/!3d(-?\d{1,3}\.\d{3,})/);
  const d4 = url.match(/!4d(-?\d{1,3}\.\d{3,})/);
  if (d3 && d4) {
    const lat = parseFloat(d3[1]);
    const lng = parseFloat(d4[1]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }

  // 4. Generic fallback: any lat,lng pair in the raw string
  const generic = url.match(/(-?\d{1,3}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/);
  if (generic) {
    const lat = parseFloat(generic[1]);
    const lng = parseFloat(generic[2]);
    if (Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat, lng };
  }

  return null;
}

function extractPlaceName(url) {
  try {
    const u = new URL(url);
    const placeMatch = u.pathname.match(/\/place\/([^/@]+)/);
    if (placeMatch) {
      return decodeURIComponent(placeMatch[1].replace(/\+/g, ' '));
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function reverseGeocode(lat, lng) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`,
    { headers: { 'User-Agent': 'MotoGo-App/1.0' } }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.display_name || null;
}