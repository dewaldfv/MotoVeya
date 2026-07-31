import { Circle, useGoogleMap } from '@react-google-maps/api';
import CustomMapMarker from './CustomMapMarker';

const TRIANGLE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="40" height="48" viewBox="0 0 40 48" fill="none">
  <ellipse cx="20" cy="42" rx="8" ry="2.4" fill="rgba(0,0,0,0.35)"/>
  <path d="M20 3 L35 39 L5 39 Z" fill="#FF7A00" stroke="#FFFFFF" stroke-width="3.5" stroke-linejoin="round"/>
</svg>`;

export default function RiderMarker({ position, heading = null, accuracy = null, zIndex = 1200 }) {
  const map = useGoogleMap();
  if (!position) return null;
  const rotation = heading != null
    ? `transform:rotate(${Math.round(heading / 5) * 5}deg);transition:transform 0.3s ease;`
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
        <div style={{ width: 40, height: 48, lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: rotation ? `<div style="${rotation}">${TRIANGLE_SVG}</div>` : TRIANGLE_SVG }} />
      </CustomMapMarker>
    </>
  );
}