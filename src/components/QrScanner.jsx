import { useEffect, useRef, useState } from 'react';
import { Keyboard } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

// Camera QR scanner using the native BarcodeDetector API (Android Chrome).
// Falls back to manual code entry when the camera is unavailable/unsupported.
// onScan(text, mode) must return a Promise<boolean> — true closes the scanner.
export default function QrScanner({ open, mode = 'auto', onClose, onScan }) {
  const videoRef = useRef(null);
  const scannedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState(null);
  const [manual, setManual] = useState('');
  const [hint, setHint] = useState(null);

  useEffect(() => {
    if (!open) { setManual(''); setHint(null); setError(null); setCameraReady(false); return; }
    scannedRef.current = false;
    const supported = typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices;
    if (!supported) { setError('Camera scanning is not available on this device. Enter the code manually below.'); return; }
    let detector, stream, raf, stopped = false;
    const start = async () => {
      try {
        detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraReady(true); }
        const tick = async () => {
          if (stopped || !videoRef.current) return;
          try {
            const codes = await detector.detect(videoRef.current);
            if (codes.length > 0 && !scannedRef.current) {
              scannedRef.current = true;
              const ok = await onScan(codes[0].rawValue, mode);
              if (ok) { onClose(); return; }
              scannedRef.current = false;
            }
          } catch (e) { /* frame error — keep scanning */ }
          raf = requestAnimationFrame(tick);
        };
        tick();
      } catch (e) { setError('Camera unavailable. Enter the code manually below.'); }
    };
    start();
    return () => { stopped = true; if (raf) cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
  }, [open]);

  const handleManual = async () => {
    if (!manual.trim()) return;
    setHint(null);
    const ok = await onScan(manual.trim(), mode);
    if (ok) { onClose(); } else { setHint('Not recognized — try again.'); }
  };

  const placeholder = mode === 'group' ? 'Enter invite code' : mode === 'friend' ? 'Enter rider code' : 'Enter code';

  return (
    <BottomSheet open={open} onClose={onClose} title="Scan QR Code">
      <div className="flex flex-col items-center gap-4">
        {error ? (
          <div className="flex w-full flex-col items-center gap-2 rounded-2xl bg-secondary p-6 text-center">
            <Keyboard size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : (
          <div className="relative aspect-square w-full max-w-xs overflow-hidden rounded-2xl bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-2xl border-4 border-white/70" />
            </div>
            {!cameraReady && <div className="absolute inset-0 flex items-center justify-center text-sm text-white/70">Starting camera…</div>}
          </div>
        )}
        <div className="w-full space-y-2">
          <p className="text-center text-xs text-muted-foreground">Or enter the code manually</p>
          <Input value={manual} onChange={(e) => { setManual(e.target.value); setHint(null); }} placeholder={placeholder} className="text-center" />
          {hint && <p className="text-center text-xs text-destructive">{hint}</p>}
          <Button className="min-h-[48px] w-full" onClick={handleManual} disabled={!manual.trim()}>Submit Code</Button>
        </div>
      </div>
    </BottomSheet>
  );
}