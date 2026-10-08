import { useState } from 'react';
import MapLibrePopup from './MapLibrePopup';
import CustomMapMarker from './CustomMapMarker';

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

function getInitial(name) {
  if (!name) return '?';
  return name.trim().charAt(0).toUpperCase();
}

export default function GroupRiderMarkers({ participants = [] }) {
  const [openId, setOpenId] = useState(null);

  return participants
    .filter((p) => p.lat != null && p.lng != null)
    .map((p) => {
      const isEmergency = p.riding_status === 'emergency';
      const color = isEmergency ? EMERGENCY_COLOR : (ROLE_COLORS[p.role] || ROLE_COLORS.member);
      const speedTxt = p.speed_kmh != null ? `${Math.round(p.speed_kmh)} km/h` : '';
      const roleBadge = p.role === 'leader' ? ' \ud83d\udc51' : p.role === 'sweep' ? ' \ud83d\udee1\ufe0f' : '';
      const ring = isEmergency ? '<div class="friend-distress-ring"></div>' : '';
      const z = isEmergency ? 1100 : 1050;
      return (
        <CustomMapMarker
          key={`grp-${p.user_id}`}
          position={[p.lat, p.lng]}
          onClick={() => setOpenId(p.user_id)}
          zIndex={z}
        >
          <div
            style={{ position: 'relative', width: 36, height: 36, lineHeight: 0 }}
            dangerouslySetInnerHTML={{
              __html: `${ring}<div style="width:36px;height:36px;border-radius:50%;background:${color};border:3px solid #fff;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:900;font-size:15px;font-family:Inter,sans-serif;">${getInitial(p.user_name)}</div>`,
            }}
          />
        </CustomMapMarker>
      );
    })
    .concat(
      participants
        .filter((p) => p.lat != null && p.lng != null && p.user_id === openId)
        .map((p) => {
          const speedTxt = p.speed_kmh != null ? `${Math.round(p.speed_kmh)} km/h` : '';
          const roleBadge = p.role === 'leader' ? ' \ud83d\udc51' : p.role === 'sweep' ? ' \ud83d\udee1\ufe0f' : '';
          return (
            <MapLibrePopup
              key={`grp-info-${p.user_id}`}
              position={{ lat: p.lat, lng: p.lng }}
              onClose={() => setOpenId(null)}
            >
              <div className="text-xs">
                <p className="font-bold">{p.user_name}{roleBadge}</p>
                <p className="text-muted-foreground">
                  {ROLE_LABELS[p.role] || 'Rider'}{speedTxt ? ` \u00b7 ${speedTxt}` : ''}
                </p>
              </div>
            </MapLibrePopup>
          );
        })
    );
}