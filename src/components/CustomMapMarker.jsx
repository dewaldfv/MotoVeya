import { OverlayView } from '@react-google-maps/api';

/**
 * Renders arbitrary HTML content at a geographic position on a GoogleMap.
 * Uses OverlayView (floatPane) so it sits above the base map tiles.
 * @param {number[]|{lat:number,lng:number}} position - [lat, lng] or {lat, lng}
 * @param {React.ReactNode} children - marker visual content
 * @param {function} onClick - click handler
 * @param {string} anchor - 'center' (default) or 'bottom' (pin-style)
 */
export default function CustomMapMarker({ position, children, onClick, zIndex = 0, anchor = 'center' }) {
  if (!position) return null;
  const lat = Array.isArray(position) ? position[0] : position.lat;
  const lng = Array.isArray(position) ? position[1] : position.lng;
  const transform = anchor === 'bottom'
    ? 'translate3d(-50%, -100%, 0)'
    : 'translate3d(-50%, -50%, 0)';
  return (
    <OverlayView position={{ lat, lng }} mapPaneName="floatPane">
      <div
        onClick={onClick}
        style={{
          transform,
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          WebkitBackfaceVisibility: 'hidden',
          cursor: onClick ? 'pointer' : 'default',
          zIndex,
          position: 'relative',
        }}
      >
        {children}
      </div>
    </OverlayView>
  );
}