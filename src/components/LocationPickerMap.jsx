import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

const DEFAULT_CENTER = [-26.2041, 28.0473];

const pinIcon = L.divIcon({
  html: `<div style="width:36px;height:36px;background:#FF6F00;border-radius:50% 50% 50% 0;transform:rotate(-45deg);border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><span style="transform:rotate(45deg);font-size:16px;">🏁</span></div>`,
  className: 'custom-marker',
  iconSize: [36, 36],
  iconAnchor: [18, 34],
});

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) map.flyTo(center);
  }, [center?.[0], center?.[1], map]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

export default function LocationPickerMap({ value, onChange }) {
  const position = value ? [value.lat, value.lng] : null;
  const center = position || DEFAULT_CENTER;

  return (
    <MapContainer center={center} zoom={12} className="h-56 w-full rounded-lg border border-border" zoomControl={false} scrollWheelZoom={false}>
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; OpenStreetMap &copy; CARTO'
      />
      <Recenter center={center} />
      <ClickHandler onPick={onChange} />
      {position && (
        <Marker
          position={position}
          icon={pinIcon}
          draggable
          eventHandlers={{
            dragend: (e) => {
              const { lat, lng } = e.target.getLatLng();
              onChange(lat, lng);
            },
          }}
        />
      )}
    </MapContainer>
  );
}