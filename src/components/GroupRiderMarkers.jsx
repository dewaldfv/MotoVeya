import { Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const ROLE_COLORS = {
  leader: '#FF7A00',
  sweep: '#a855f7',
  member: '#3b82f6',
};

const ROLE_LABELS = {
  leader: 'Leader',
  sweep: 'Sweep',
  member: 'Rider',
};

const EMERGENCY_COLOR = '#ef4444';

const iconCache = {};
function getIcon(color, initial, isEmergency) {
  const key = `${color}-${initial}-${isEmergency}`;
  if (!iconCache[key]) {
    const ring = isEmergency ? '<div class="friend-distress-ring"></div>' : '';
    iconCache[key] = L.divIcon({
      html: `<div style="position:relative;width:36px;height:36px;line-height:0;">${ring}<div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;font-family:Inter,sans-serif;">${initial}</div></div>`,
      className: 'custom-marker',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18],
    });
  }
  return iconCache[key];
}

function getInitial(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export default function GroupRiderMarkers({ participants = [] }) {
  return participants
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      const isEmergency = p.riding_status === 'emergency';
      const color = isEmergency ? EMERGENCY_COLOR : (ROLE_COLORS[p.role] || ROLE_COLORS.member);
      const icon = getIcon(color, getInitial(p.user_name), isEmergency);
      const speedTxt = p.speed_kmh != null ? `${Math.round(p.speed_kmh)} km/h` : '';
      const roleBadge = p.role === 'leader' ? ' 👑' : p.role === 'sweep' ? ' 🛡️' : '';
      return (
        <Marker
          key={`grp-${p.user_id}`}
          position={[p.lat, p.lng]}
          icon={icon}
          zIndexOffset={isEmergency ? 1100 : 1050}
        >
          <Popup>
            <div className="text-xs">
              <p className="font-bold">{p.user_name}{roleBadge}</p>
              <p className="text-muted-foreground">
                {ROLE_LABELS[p.role] || 'Rider'}{speedTxt ? ` · ${speedTxt}` : ''}
              </p>
            </div>
          </Popup>
        </Marker>
      );
    });
}