import { Circle, useGoogleMap } from '@react-google-maps/api';
import CustomMapMarker from './CustomMapMarker';

const MOTORCYCLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52" fill="none">
  <ellipse cx="21" cy="47" rx="9" ry="2.5" fill="rgba(0,0,0,0.42)"/>
  <path d="M21 4 C24 4 26 6 26 9 L26 15 L31 21 L34 34 C35 39 31 43 27 43 L15 43 C11 43 7 39 8 34 L11 21 L16 15 L16 9 C16 6 18 4 21 4Z" fill="#FF7800" stroke="#FFFFFF" stroke-width="2.8" stroke-linejoin="round"/>
  <path d="M16 20 L26 20 M13 27 L29 27 M14 35 L28 35" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" opacity="0.9"/>
  <circle cx="21" cy="12" r="3" fill="#111111" stroke="#FFFFFF" stroke-width="1.5"/>
</svg>`;

export default function RiderMarker({ position, heading = null, accuracy = null, zIndex = 1200 }) {
  const map = useGoogleMap();
  if (!position) return null;
  const rotation = heading != null
    ? `transform:rotate(${Math.round(heading / 5) * 5}deg);transition:transform 0.3s ease;transform-origin:center center;`
    : '';

  return (
    <>
      {accuracy != null && accuracy > 0 && map && (
        <Circle
          center={{ lat: position[0], lng: position[1] }}
          radius={accuracy}
          options={{
            fillColor: '#3b82f6',
            fillOpacity: 0.15,
            strokeColor: '#3b82f6',
            strokeOpacity: 0.4,
            strokeWeight: 1,
            clickable: false,
          }}
        />
      )}
      <CustomMapMarker position={position} zIndex={zIndex}>
        <div className="motoveya-rider-marker" style={{ width: 42, height: 52, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: rotation ? `<div style="${rotation}">${MOTORCYCLE_SVG}</div>` : MOTORCYCLE_SVG }} />
      </CustomMapMarker>
    </>
  );
}