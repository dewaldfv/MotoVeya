import { useEffect, useState, useCallback } from 'react';
import ImportFromGoogleMapsButton from '@/components/ImportFromGoogleMapsButton';
import PickerMapCore from '@/components/PickerMapCore';
import LocationInfoCard from '@/components/LocationInfoCard';
import FullscreenMapDialog from '@/components/FullscreenMapDialog';

function useIsDark() {
  const [dark, setDark] = useState(() => typeof document !== 'undefined' && document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => setDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);
  return dark;
}

export default function LocationPickerMap({ value, onChange, onImportInfo }) {
  const isDark = useIsDark();
  const [layer, setLayer] = useState('standard');
  const [fullscreen, setFullscreen] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null);
  const [importInfo, setImportInfo] = useState(null);

  const handleChange = useCallback((lat, lng) => {
    onChange(lat, lng);
    setImportInfo(null);
    setFlyTarget(null);
  }, [onChange]);

  const handleImport = useCallback((res) => {
    onChange(res.lat, res.lng);
    if (res.name || res.address) { setImportInfo(res); onImportInfo?.(res); }
    setFlyTarget({ lat: res.lat, lng: res.lng, zoom: 16, nonce: Date.now() });
  }, [onChange, onImportInfo]);

  return (
    <div>
      <div className="mb-2">
        <ImportFromGoogleMapsButton onImport={handleImport} />
      </div>
      <PickerMapCore
        value={value}
        onChange={handleChange}
        height={320}
        layer={layer}
        onLayerChange={setLayer}
        isDark={isDark}
        flyTarget={flyTarget}
        onFullscreen={() => setFullscreen(true)}
      />
      <LocationInfoCard value={value} importInfo={importInfo} />
      <FullscreenMapDialog
        open={fullscreen}
        onOpenChange={setFullscreen}
        value={value}
        onChange={handleChange}
        layer={layer}
        onLayerChange={setLayer}
        isDark={isDark}
        flyTarget={flyTarget}
        importInfo={importInfo}
      />
    </div>
  );
}