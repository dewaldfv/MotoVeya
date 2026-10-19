import { MapPin, Bell, Camera, Mic, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const ICONS = { location: MapPin, notifications: Bell, camera: Camera, microphone: Mic };

const RESULT_TEXT = {
  granted: 'Allowed',
  denied: 'Not allowed',
  unsupported: 'Not available on this device',
};

export default function PermissionStepCard({ step, status, onAllow, onSkip }) {
  const Icon = ICONS[step.key] || MapPin;
  const busy = status === 'requesting';
  const result = RESULT_TEXT[status];

  return (
    <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-white/5 p-6 text-center text-white">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff6600]">
        <Icon size={30} strokeWidth={2.2} />
      </div>
      <h2 className="mt-5 text-xl font-bold tracking-tight">{step.title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-white/55">{step.description}</p>

      {result ? (
        <p className={`mt-6 text-sm font-semibold ${status === 'granted' ? 'text-emerald-400' : 'text-white/45'}`}>
          {result}
        </p>
      ) : (
        <div className="mt-6">
          <Button className="min-h-[52px] w-full text-base" onClick={onAllow} disabled={busy}>
            {busy ? <><Loader2 size={18} className="animate-spin" /> Waiting for your device…</> : 'Allow'}
          </Button>
          <button
            type="button"
            onClick={onSkip}
            disabled={busy}
            className="mt-1 min-h-[44px] w-full text-sm text-white/45 transition-colors hover:text-white/80 disabled:opacity-40"
          >
            Not now
          </button>
        </div>
      )}
    </div>
  );
}