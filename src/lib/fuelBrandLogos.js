// Supplier-provided fuel brand logos used on the map's fuel station markers.
export const FUEL_BRAND_LOGOS = {
  engen: {
    label: 'Engen',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/82f328c23_BoldRedStylizedELogo.png',
  },
  shell: {
    label: 'Shell',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/db5041d16_ShellEmblemonTransparentBackground.png',
  },
  'astron energy': {
    label: 'Astron Energy',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/05ab0442d_WhiteandPurpleRibbonLogo.png',
  },
  caltex: {
    label: 'Caltex',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/67f6e49e7_GreenandRedStarCircleEmblem.png',
  },
  bp: {
    label: 'BP',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/1b6e2d610_GreenandYellowHeliosEmblem.png',
  },
  'puma energy': {
    label: 'Puma Energy',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/1127450c1_LeapingWhiteBigCatSilhouette.png',
  },
  sasol: {
    label: 'Sasol',
    url: 'https://media.base44.com/images/public/6a474c2524cd25817436fd3b/399c8c497_GlossyBlueMolecularOrbitalLogo.png',
  },
};

// Common OpenStreetMap spellings and legacy South African names.
const ALIASES = {
  'engen petroleum': 'engen',
  'engen south africa': 'engen',
  'shell south africa': 'shell',
  'shell ultra city': 'shell',
  'astron': 'astron energy',
  'astron energy': 'astron energy',
  'caltex south africa': 'caltex',
  'bp south africa': 'bp',
  'puma': 'puma energy',
  'puma energy': 'puma energy',
  'sasol oil': 'sasol',
};

const BRAND_KEYS = Object.keys(FUEL_BRAND_LOGOS).sort((a, b) => b.length - a.length);

export function normalizeFuelBrand(value) {
  const key = String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!key) return null;
  return ALIASES[key] || key;
}

/**
 * Matches a whole brand tag first, then a brand name inside a longer station
 * name ("Engen Roodepoort", "SHELL ULTRA CITY N1"), so loosely tagged
 * OpenStreetMap stations still show their logo.
 */
function matchBrandKey(candidate) {
  const key = normalizeFuelBrand(candidate);
  if (!key) return null;
  if (FUEL_BRAND_LOGOS[key]) return key;
  return BRAND_KEYS.find((brandKey) =>
    new RegExp(`(^|[^a-z])${brandKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z]|$)`).test(key)
  ) || null;
}

/**
 * Resolves the supplied logo for a station. Station brand metadata is tried
 * first, then the operator tag, then the station name.
 */
export function resolveFuelBrand(station) {
  const candidates = [station?.raw_brand, station?.brand, station?.operator, station?.name];
  for (const candidate of candidates) {
    const key = matchBrandKey(candidate);
    if (key) return { key, ...FUEL_BRAND_LOGOS[key] };
  }
  // Brand records maintained in the app can carry their own logo.
  // Favicons are too coarse for a 36px map chip, so they are skipped.
  if (station?.logo_url && !/favicon|\.ico($|\?)/i.test(station.logo_url)) {
    return { key: 'custom', label: station.brand || 'Fuel', url: station.logo_url };
  }
  return null;
}