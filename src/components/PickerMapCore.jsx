import { useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plus, Minus, LocateFixed, Crosshair, Maximize2, Loader2, Map, Satellite, Mountain } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_CENTER = [-26.2041, 28.0473];

const pinIcon = L.divIcon({
  html: `<div style="width:40px;height:48px;">
    <div style="width:36px;height:36px;background:#FF6F00;border:2.5px solid #fff;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 6px 14px rgba(0,0,0,0.45);display:flex;align-items:center;justify-content:center;margin-left:2px;">
      <span style="transform:rotate(45deg);font-size:18px;line-height:1;">📍</span>
    </div>
  </div>`,
  className: 'custom-marker',
  iconSize: [40, 48],
  iconAnchor: [20, 46],
});

function getTileConfig(layer, isDark) {
  if (layer === 'satellite') {
    return {
      tiles: [
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri, Maxar, Earthstar Geographics', detectRetina: false },
        { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', attribution: '', detectRetina: false },
      ],
    };
  }
  if (layer === 'terrain') {
    return {
      tiles: [
        { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap (CC-BY-SA)', detectRetina: false },
      ],
    };
  }
  // standard — theme aware, high-contrast Voyager with retina for crisp text
  if (isDark) {
    return { tiles: [{ url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', detectRetina: true }] };
  }
  return { tiles: [{ url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO', detectRetina: true }] };
}

function MapRefSetter({ onReady }) {
  const map = useMap();
  useEffect(() => {
    onReady(map);
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(map.getContainer());
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => { ro.disconnect(); clearTimeout(t); };
  }, [map, onReady]);
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], target.zoom ?? map.getZoom(), { duration: 1.2 });
  }, [target?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function TileLoadWatcher({ onLoadingChange }) {
  const map = useMap();
  useEffect(() => {
    const start = () => onLoadingChange(true);
    const done = () => onLoadingChange(false);
    map.on('loading', start);
    map.on('load', done);
    onLoadingChange(true);
    return () => { map.off('loading', start); map.off('load', done); };
  }, [map, onLoadingChange]);
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({ click(e) { onPick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

const LAYER_OPTIONS = [
  { key: 'standard', Icon: Map, label: 'Standard' },
  { key: 'satellite', Icon: Satellite, label: 'Satellite' },
  { key: 'terrain', Icon: Mountain, label: 'Terrain' },
];

export default function PickerMapCore({ value, onChange, height, layer, onLayerChange, isDark, flyTarget, onFullscreen, hideFullscreen = false }) {
  const [map, setMap] = useState(null);
  const [tilesLoading, setTilesLoading] = useState(true);

  const position = value ? [value.lat, value.lng] : null;
  const center = position || DEFAULT_CENTER;
  const tileConfig = useMemo(() => getTileConfig(layer, isDark), [layer, isDark]);

  const handleMyLocation = () => {
    if (!navigator.geolocation || !map) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => map.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.2 }),
      () => toast.error('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };
  const handleRecenter = () => {
    if (!map) return;
    if (value) map.flyTo([value.lat, value.lng], Math.max(map.getZoom(), 16), { duration: 1.0 });
    else handleMyLocation();
  };

  const h = typeof height === 'number' ? `${height}px` : height;

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-neutral-900" style={{ height: h }}>
      <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl={false} scrollWheelZoom>
        <MapRefSetter onReady={setMap} />
        <TileLoadWatcher onLoadingChange={setTilesLoading} />
        <FlyTo target={flyTarget} />
        <ClickHandler onPick={onChange} />
        {tileConfig.tiles.map((t, i) => (
          <TileLayer key={`${layer}-${isDark}-${i}`} url={t.url} attribution={t.attribution} detectRetina={t.detectRetina} maxZoom={20} />
        ))}
        {position && (
          <Marker
            position={position}
            icon={pinIcon}
            draggable
            eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); onChange(lat, lng); } }}
          />
        )}
      </MapContainer>

      {/* Layer toggle */}
      <div className="absolute left-2 top-2 z-[1000] flex overflow-hidden rounded-lg border border-border bg-card/95 shadow backdrop-blur">
        {LAYER_OPTIONS.map(({ key, Icon }) => (
          <button
            key={key}
            onClick={() => onLayerChange(key)}
            aria-label={key}
            className={`flex h-9 w-9 items-center justify-center transition-colors ${layer === key ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-secondary'}`}
          >
            <Icon size={16} />
          </button>
        ))}
      </div>

      {/* Fullscreen */}
      {!hideFullscreen && onFullscreen && (
        <button
          onClick={onFullscreen}
          aria-label="Full screen map"
          className="absolute right-2 top-2 z-[1000] flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/95 text-foreground shadow backdrop-blur hover:bg-secondary"
        >
          <Maximize2 size={16} />
        </button>
      )}

      {/* Zoom controls */}
      <div className="absolute right-2 bottom-2 z-[1000] flex flex-col overflow-hidden rounded-lg border border-border bg-card/95 shadow backdrop-blur">
        <button onClick={() => map?.zoomIn()} aria-label="Zoom in" className="flex h-9 w-9 items-center justify-center text-foreground hover:bg-secondary"><Plus size={16} /></button>
        <div className="h-px bg-border" />
        <button onClick={() => map?.zoomOut()} aria-label="Zoom out" className="flex h-9 w-9 items-center justify-center text-foreground hover:bg-secondary"><Minus size={16} /></button>
      </div>

      {/* My location + recenter */}
      <div className="absolute left-2 bottom-2 z-[1000] flex gap-1.5">
        <button onClick={handleMyLocation} aria-label="My location" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/95 text-primary shadow backdrop-blur hover:bg-secondary"><LocateFixed size={16} /></button>
        <button onClick={handleRecenter} aria-label="Re-center" className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/95 text-foreground shadow backdrop-blur hover:bg-secondary"><Crosshair size={16} /></button>
      </div>

      {/* Loading overlay */}
      {tilesLoading && (
        <div className="pointer-events-none absolute inset-0 z-[900] flex items-center justify-center bg-background/30 backdrop-blur-[2px]">
          <div className="flex items-center gap-2 rounded-full bg-card/95 px-3 py-1.5 text-xs font-medium shadow">
            <Loader2 size={14} className="animate-spin text-primary" /> Loading map…
          </div>
        </div>
      )}
    </div>
  );
}