import { useState, useEffect, useRef, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Plus, Minus, LocateFixed, Maximize2, Minimize2, Crosshair } from 'lucide-react';
import ImportFromGoogleMapsButton from '@/components/ImportFromGoogleMapsButton';
import LocationInfoCard from '@/components/LocationInfoCard';
import { toast } from 'sonner';

const DEFAULT_CENTER = [-26.2041, 28.0473];

const eventPinIcon = L.divIcon({
  html: `<div class="motogo-event-pin"><div class="motogo-event-pin__pulse"></div><div class="motogo-event-pin__body"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M8 2v4M16 2v4M3 10h18"/></svg></span></div></div>`,
  className: 'custom-marker',
  iconSize: [44, 44],
  iconAnchor: [22, 40],
});

const landmarkIcon = L.divIcon({
  html: `<div class="motogo-landmark-dot"></div>`,
  className: 'motogo-landmark-marker',
  iconSize: [12, 12],
  iconAnchor: [6, 6],
});

function useIsDark() {
  const [isDark, setIsDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return isDark;
}

function getTileConfig(layer, isDark) {
  if (layer === 'satellite') {
    return { url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', attribution: '&copy; Esri, Maxar, Earthstar Geographics' };
  }
  if (layer === 'terrain') {
    return { url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', attribution: '&copy; OpenTopoMap (CC-BY-SA)' };
  }
  if (isDark) {
    return { url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' };
  }
  return { url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', attribution: '&copy; OpenStreetMap &copy; CARTO' };
}

function MapBindings({ onReady, onZoom }) {
  const map = useMap();
  useEffect(() => { onReady(map); }, [map, onReady]);
  useMapEvents({ zoomend: () => onZoom(map.getZoom()) });
  return null;
}

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick(e.latlng.lat, e.latlng.lng) });
  return null;
}

export default function LocationPickerMap({ value, onChange, onImportInfo }) {
  const isDark = useIsDark();
  const [layer, setLayer] = useState('standard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [map, setMap] = useState(null);
  const [zoom, setZoom] = useState(12);
  const [geoInfo, setGeoInfo] = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [landmarks, setLandmarks] = useState([]);
  const importZoomRef = useRef(0);

  const position = value ? [value.lat, value.lng] : null;
  const center = position || DEFAULT_CENTER;
  const tileConfig = getTileConfig(layer, isDark);
  const handleReady = useCallback((m) => setMap(m), []);

  useEffect(() => {
    if (!map || !value) return;
    const targetZoom = importZoomRef.current || Math.max(map.getZoom(), 12);
    map.flyTo([value.lat, value.lng], targetZoom, { duration: 1.2 });
    importZoomRef.current = 0;
  }, [value?.lat, value?.lng, map]);

  useEffect(() => {
    if (!map) return;
    const t = setTimeout(() => map.invalidateSize(), 150);
    return () => clearTimeout(t);
  }, [isFullscreen, map, layer]);

  useEffect(() => {
    if (!value) { setGeoInfo(null); return; }
    setLoadingGeo(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${value.lat}&lon=${value.lng}&format=json&zoom=18&addressdetails=1`, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        const a = data.address || {};
        setGeoInfo({
          address: data.display_name,
          road: a.road || a.pedestrian || a.path || a.cycleway,
          town: a.town || a.city || a.village || a.suburb || a.hamlet || a.county,
        });
      } catch (e) { setGeoInfo(null); }
      finally { setLoadingGeo(false); }
    }, 500);
    return () => clearTimeout(timer);
  }, [value?.lat, value?.lng]);

  useEffect(() => {
    if (!value || zoom < 14) { setLandmarks([]); return; }
    const timer = setTimeout(async () => {
      try {
        const query = `[out:json][timeout:5];(node["tourism"](around:2000,${value.lat},${value.lng});node["amenity"~"restaurant|cafe|fuel|atm|pharmacy|hospital|place_of_worship"](around:2000,${value.lat},${value.lng}););out 15;`;
        const res = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: 'data=' + encodeURIComponent(query) });
        const data = await res.json();
        setLandmarks((data.elements || []).map((el) => ({
          id: el.id, lat: el.lat, lng: el.lon, name: el.tags?.name, type: el.tags?.tourism || el.tags?.amenity,
        })).filter((l) => l.name));
      } catch (e) { /* nearby landmarks unavailable */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [value?.lat, value?.lng, zoom]);

  const handleImport = (res) => {
    importZoomRef.current = 16;
    onChange(res.lat, res.lng);
    onImportInfo?.(res);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => { map?.flyTo([pos.coords.latitude, pos.coords.longitude], 16, { duration: 1.2 }); },
      () => toast.error('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRecenter = () => {
    if (value) map?.flyTo([value.lat, value.lng], Math.max(zoom, 16), { duration: 1.2 });
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-background p-3' : 'relative'}>
      <div className="mb-2">
        <ImportFromGoogleMapsButton onImport={handleImport} />
      </div>

      <div className={`relative w-full overflow-hidden rounded-xl border border-border ${isFullscreen ? 'flex-1' : 'h-56 landscape:h-64'}`}>
        <MapContainer center={center} zoom={12} className="h-full w-full" zoomControl={false} scrollWheelZoom>
          <MapBindings onReady={handleReady} onZoom={setZoom} />
          <ClickHandler onPick={onChange} />
          <TileLayer key={tileConfig.url} url={tileConfig.url} attribution={tileConfig.attribution} />
          {position && (
            <Marker position={position} icon={eventPinIcon} draggable eventHandlers={{ dragend: (e) => { const { lat, lng } = e.target.getLatLng(); onChange(lat, lng); } }} />
          )}
          {landmarks.map((lm) => (
            <Marker key={lm.id} position={[lm.lat, lm.lng]} icon={landmarkIcon} title={lm.name} />
          ))}
        </MapContainer>

        <div className="absolute bottom-2 left-2 z-[1000] flex gap-1 rounded-lg bg-card/95 p-1 shadow-lg backdrop-blur">
          {['standard', 'satellite', 'terrain'].map((l) => (
            <button key={l} type="button" onClick={() => setLayer(l)} className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize transition ${layer === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{l}</button>
          ))}
        </div>

        <div className="absolute right-2 top-2 z-[1000] flex flex-col gap-1.5">
          <button type="button" onClick={() => map?.zoomIn()} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="Zoom in"><Plus size={18} /></button>
          <button type="button" onClick={() => map?.zoomOut()} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="Zoom out"><Minus size={18} /></button>
        </div>

        <div className="absolute bottom-2 right-2 z-[1000] flex flex-col gap-1.5">
          <button type="button" onClick={handleMyLocation} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="My location"><LocateFixed size={18} className="text-primary" /></button>
          <button type="button" onClick={handleRecenter} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="Re-center on pin"><Crosshair size={18} /></button>
          <button type="button" onClick={() => setIsFullscreen((f) => !f)} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="Toggle fullscreen">{isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        </div>
      </div>

      <LocationInfoCard address={geoInfo?.address} lat={value?.lat} lng={value?.lng} town={geoInfo?.town} road={geoInfo?.road} loading={loadingGeo} />

      {isFullscreen && (
        <button type="button" onClick={() => setIsFullscreen(false)} className="mt-2 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground">
          <Minimize2 size={18} /> Done
        </button>
      )}
    </div>
  );
}