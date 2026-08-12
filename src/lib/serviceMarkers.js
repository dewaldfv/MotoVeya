import { getServiceCategory } from './serviceCategories';

const ICON_SIZE = 44;

function escapeXml(s) {
  return String(s).replace(/[<>&'"]/g, (c) => ({
    '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;',
  }[c]));
}

// Builds a teardrop-free circular pin (matches the round event-pin aesthetic) in the
// service category colour with the category emoji centred. Returned as an SVG data URI
// so it can be used directly as a google.maps.Marker icon URL — no image upload needed.
function buildPinSvg(color, emoji) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <circle cx="22" cy="22" r="20" fill="${color}" stroke="#ffffff" stroke-width="3"/>
  <text x="22" y="30" font-size="20" text-anchor="middle" font-family="Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif">${escapeXml(emoji)}</text>
</svg>`;
}

function buildClusterSvg(count) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON_SIZE}" height="${ICON_SIZE}" viewBox="0 0 ${ICON_SIZE} ${ICON_SIZE}">
  <circle cx="22" cy="22" r="20" fill="#FF6F00" stroke="#ffffff" stroke-width="3"/>
  <text x="22" y="29" font-size="16" font-weight="bold" text-anchor="middle" fill="#ffffff" font-family="sans-serif">${count}</text>
</svg>`;
}

const markerUrlCache = {};

export function getServiceMarkerUrl(category) {
  const cat = getServiceCategory(category);
  if (markerUrlCache[cat.key]) return markerUrlCache[cat.key];
  const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildPinSvg(cat.color, cat.emoji))}`;
  markerUrlCache[cat.key] = url;
  return url;
}

export function getClusterMarkerUrl(count) {
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(buildClusterSvg(count))}`;
}

// Composites a service's logo into a circular map-marker icon (white background,
// cover-cropped logo, white border ring) via canvas and returns a PNG data URI.
// Cached per logo URL. Rejects if there is no logo or the image can't be drawn
// (CORS/tainted canvas), so the caller can fall back to the category pin.
const logoMarkerCache = new Map();

export function getLogoMarkerUrl(logoUrl) {
  if (!logoUrl) return Promise.reject(new Error('no logo'));
  const cached = logoMarkerCache.get(logoUrl);
  if (cached !== undefined) {
    return cached instanceof Promise ? cached : (cached ? Promise.resolve(cached) : Promise.reject(new Error('cached fail')));
  }

  const promise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const size = ICON_SIZE;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2);
        ctx.clip();
        const iw = img.naturalWidth || img.width || size;
        const ih = img.naturalHeight || img.height || size;
        const scale = Math.max(size / iw, size / ih);
        const dw = iw * scale;
        const dh = ih * scale;
        ctx.drawImage(img, (size - dw) / 2, (size - dh) / 2, dw, dh);
        ctx.restore();

        ctx.beginPath();
        ctx.arc(size / 2, size / 2, size / 2 - 1.5, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.stroke();

        const url = canvas.toDataURL('image/png');
        logoMarkerCache.set(logoUrl, url);
        resolve(url);
      } catch (e) {
        logoMarkerCache.set(logoUrl, null);
        reject(e);
      }
    };
    img.onerror = () => {
      logoMarkerCache.set(logoUrl, null);
      reject(new Error('logo load failed'));
    };
    img.src = logoUrl;
  });

  logoMarkerCache.set(logoUrl, promise);
  return promise;
}