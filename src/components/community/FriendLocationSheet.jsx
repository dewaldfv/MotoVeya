import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import BottomSheet from '@/components/BottomSheet';
import RiderAvatar from './RiderAvatar';
import { formatRelativeDate } from '@/lib/riderStats';

const pinIcon = L.divIcon({
  html: '<div style="width:18px;height:18px;background:hsl(26 100% 50%);border:3px solid #fff;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,.4)"></div>',
  className: 'custom-marker',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function FlyTo({ pos }) {
  const map = useMap();
  useEffect(() => { if (pos) map.flyTo(pos, 14, { duration: 1 }); }, [pos, map]);
  return null;
}

export default function FriendLocationSheet({ open, onClose, friend, rider }) {
  const pos = friend?.last_lat != null && friend?.last_lng != null ? [friend.last_lat, friend.last_lng] : null;
  const name = rider?.nickname || rider?.full_name || friend?.recipient_name || friend?.requester_name || 'Rider';
  return (
    <BottomSheet open={open} onClose={onClose} title="Live Location">
      <div className="mb-3 flex items-center gap-3">
        <RiderAvatar src={rider?.avatar_url} name={name} size={40} />
        <div>
          <p className="font-bold">{name}</p>
          <p className="text-xs text-muted-foreground">Last seen {friend?.last_updated ? formatRelativeDate(friend.last_updated) : 'recently'}</p>
        </div>
      </div>
      {pos ? (
        <div className="h-64 w-full overflow-hidden rounded-2xl">
          <MapContainer center={pos} zoom={14} className="h-full w-full" zoomControl={false}>
            <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
            <FlyTo pos={pos} />
            <Marker position={pos} icon={pinIcon} />
          </MapContainer>
        </div>
      ) : (
        <div className="rounded-2xl bg-secondary p-8 text-center text-sm text-muted-foreground">Location not shared</div>
      )}
    </BottomSheet>
  );
}