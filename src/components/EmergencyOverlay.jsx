import { AlertTriangle, Phone, ShieldCheck, MapPin, Users, Mail } from 'lucide-react';

export default function EmergencyOverlay({
  phase,
  countdown,
  onCancel,
  onResolve,
  emergencyNumber = '112',
  contactNotified,
  nearbyNotified,
  riderName,
  location,
}) {
  if (!phase) return null;

  if (phase === 'countdown') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-destructive p-6">
        <AlertTriangle size={72} className="mb-4 animate-pulse text-white" />
        <p className="mb-2 text-2xl font-bold text-white">CRASH DETECTED</p>
        <p className="mb-6 text-lg text-white/80">Emergency alert in</p>
        <div className="mb-8 text-8xl font-black text-white landscape:text-6xl">{countdown}</div>
        <button
          onClick={onCancel}
          className="min-h-[64px] rounded-2xl bg-white px-12 text-xl font-bold text-destructive transition-transform active:scale-95"
        >
          I'M OK — CANCEL
        </button>
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-destructive/95 p-6">
        <AlertTriangle size={56} className="mb-3 text-white" />
        <p className="mb-1 text-2xl font-bold text-white">EMERGENCY ACTIVE</p>
        <p className="mb-4 text-center text-sm text-white/70">
          Live location is being transmitted continuously.
        </p>

        <div className="mb-6 w-full max-w-xs space-y-2">
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${contactNotified ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}>
            <Mail size={16} />
            <span>{contactNotified ? 'Emergency contacts notified' : 'Notifying contacts...'}</span>
          </div>
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${nearbyNotified ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}>
            <Users size={16} />
            <span>{nearbyNotified ? 'Nearby riders alerted' : 'Alerting nearby riders...'}</span>
          </div>
          {location && (
            <div className="flex items-center gap-2 rounded-xl p-3 text-sm bg-white/5 text-white/70">
              <MapPin size={16} />
              <span className="font-mono">{location[0].toFixed(4)}, {location[1].toFixed(4)}</span>
            </div>
          )}
        </div>

        <a
          href={`tel:${emergencyNumber}`}
          className="mb-3 flex min-h-[64px] w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-white text-xl font-bold text-destructive transition-transform active:scale-95"
        >
          <Phone size={24} /> CALL {emergencyNumber}
        </a>

        <button
          onClick={onResolve}
          className="flex min-h-[56px] w-full max-w-xs items-center justify-center gap-2 rounded-2xl border-2 border-white/30 text-lg font-bold text-white transition-transform active:scale-95"
        >
          <ShieldCheck size={20} /> I'M SAFE — END
        </button>
      </div>
    );
  }

  return null;
}