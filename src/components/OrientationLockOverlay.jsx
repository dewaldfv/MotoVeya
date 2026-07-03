import { useState, useEffect } from 'react';
import { useAppSettings } from '@/hooks/useAppSettings';
import { RotateCw } from 'lucide-react';

export default function OrientationLockOverlay() {
  const { orientation } = useAppSettings();
  const [deviceOrient, setDeviceOrient] = useState(
    typeof window !== 'undefined' && window.innerWidth > window.innerHeight ? 'landscape' : 'portrait'
  );

  useEffect(() => {
    const handler = () => {
      setDeviceOrient(window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
    };
    window.addEventListener('resize', handler);
    window.addEventListener('orientationchange', handler);
    return () => {
      window.removeEventListener('resize', handler);
      window.removeEventListener('orientationchange', handler);
    };
  }, []);

  if (orientation === 'auto') return null;
  const lockedTo = orientation;
  const isWrong = (lockedTo === 'portrait' && deviceOrient === 'landscape') ||
                  (lockedTo === 'landscape' && deviceOrient === 'portrait');
  if (!isWrong) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background px-8 text-center">
      <RotateCw size={64} className="mb-6 animate-pulse text-primary" />
      <p className="text-lg font-bold">Rotate your device</p>
      <p className="mt-1 text-sm text-muted-foreground">
        MotoGo is locked to {lockedTo} mode. Rotate to {lockedTo} to continue.
      </p>
    </div>
  );
}