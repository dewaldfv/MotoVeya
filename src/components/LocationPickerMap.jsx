import { useState, useEffect, useRef, useCallback } from 'react';
import MapLibreContainer from './MapLibreContainer';
import CustomMapMarker from './CustomMapMarker';
import { useMapInstance } from '@/lib/maplibreContext';
import ImportFromGoogleMapsButton from '@/components/ImportFromGoogleMapsButton';
import LocationInfoCard from '@/components/LocationInfoCard';
import { Plus, Minus, LocateFixed, Maximize2, Minimize2, Crosshair } from 'lucide-react';
import { toast } from 'sonner';

const DEFAULT_CENTER = [-26.2041, 28.0473];

function eventPinVisual() {
  return (
    <div className="motogo-event-pin">
      <div className="motogo-event-pin__pulse" />
      <div className="motogo-event-pin__body">
        <span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="3" /><path d="M8 2v4M16 2v4M3 10h18" /></svg></span>
      </div>
    </div>
  );
}

function ClickHandler({ onPick }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const handler = (e) => {
      if (e.lngLat) onPick(e.lngLat.lat, e.lngLat.lng);
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map, onPick]);
  return null;
}

function MapController({ mapRef, value, importZoomRef }) {
  const map = useMapInstance();
  useEffect(() => {
    if (map) mapRef.current = map;
  }, [map, mapRef]);

  useEffect(() => {
    if (!map || !value) return;
    const targetZoom = importZoomRef.current || Math.max(map.getZoom(), 12);
    map.panTo([value.lng, value.lat]);
    map.setZoom(targetZoom);
    importZoomRef.current = 0;
  }, [value?.lat, value?.lng, map, importZoomRef]);

  return null;
}

function UserLocationCenterer({ active, onDone }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!active || !map) return;
    if (!navigator.geolocation) { onDone?.(); return; }
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        map.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 13, duration: 1500 });
        onDone?.();
      },
      () => { if (!cancelled) onDone?.(); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, map]);
  return null;
}

function ZoomTracker({ onZoom }) {
  const map = useMapInstance();
  useEffect(() => {
    if (!map) return;
    const emit = () => onZoom(map.getZoom());
    emit();
    map.on('zoom', emit);
    return () => map.off('zoom', emit);
  }, [map, onZoom]);
  return null;
}

export default function LocationPickerMap({ value, onChange, onImportInfo }) {
  const [layer, setLayer] = useState('standard');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [geoInfo, setGeoInfo] = useState(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [landmarks, setLandmarks] = useState([]);
  const mapRef = useRef(null);
  const importZoomRef = useRef(0);
  const [zoom, setZoom] = useState(12);
  const [userInitDone, setUserInitDone] = useState(false);

  const center = value ? { lat: value.lat, lng: value.lng } : { lat: DEFAULT_CENTER[0], lng: DEFAULT_CENTER[1] };

  const handleImport = useCallback((res) => {
    importZoomRef.current = 16;
    onChange(res.lat, res.lng);
    onImportInfo?.(res);
  }, [onChange, onImportInfo]);

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
      } catch { setGeoInfo(null); }
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
      } catch { /* nearby landmarks unavailable */ }
    }, 800);
    return () => clearTimeout(timer);
  }, [value?.lat, value?.lng, zoom]);

  const handleMyLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const m = mapRef.current;
        if (m) { m.panTo([pos.coords.longitude, pos.coords.latitude]); m.setZoom(16); }
      },
      () => toast.error('Could not get your location'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleRecenter = () => {
    const m = mapRef.current;
    if (m && value) { m.panTo([value.lng, value.lat]); m.setZoom(Math.max(zoom, 16)); }
  };

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[100] flex flex-col bg-background p-3' : 'relative'}>
      <div className="mb-2">
        <ImportFromGoogleMapsButton onImport={handleImport} />
      </div>

      <div className={`relative w-full overflow-hidden rounded-xl border border-border ${isFullscreen ? 'flex-1' : 'h-56 landscape:h-64'}`}>
        <MapLibreContainer
          center={[center.lat, center.lng]}
          zoom={12}
          layer={layer}
        >
          <ClickHandler onPick={onChange} />
          <MapController mapRef={mapRef} value={value} importZoomRef={importZoomRef} />
          <UserLocationCenterer active={!value && !userInitDone} onDone={() => setUserInitDone(true)} />
          <ZoomTracker onZoom={setZoom} />

          {value && (
            <CustomMapMarker position={[value.lat, value.lng]} anchor="bottom">
              {eventPinVisual()}
            </CustomMapMarker>
          )}

          {landmarks.map((lm) => (
            <CustomMapMarker key={lm.id} position={[lm.lat, lm.lng]}>
              <div className="motogo-landmark-dot" />
            </CustomMapMarker>
          ))}
        </MapLibreContainer>

        <div className="absolute bottom-2 left-2 z-[1000] flex gap-1 rounded-lg bg-card/95 p-1 shadow-lg backdrop-blur">
          {['standard', 'satellite', 'terrain'].map((l) => (
            <button key={l} type="button" onClick={() => setLayer(l)} className={`rounded-md px-2 py-1 text-[11px] font-semibold capitalize transition ${layer === l ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}>{l}</button>
          ))}
        </div>

        <div className="absolute right-2 top-2 z-[1000] flex flex-col gap-1.5">
          <button type="button" onClick={() => { const m = mapRef.current; if (m) m.setZoom(m.getZoom() + 1); }} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="Zoom in"><Plus size={18} /></button>
          <button type="button" onClick={() => { const m = mapRef.current; if (m) m.setZoom(m.getZoom() - 1); }} className="glove-target flex h-10 w-10 items-center justify-center rounded-lg bg-card/95 shadow-lg backdrop-blur" aria-label="Zoom out"><Minus size={18} /></button>
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