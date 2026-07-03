import { AlertTriangle, Phone, ShieldCheck, MapPin, Users, Mail, Volume2, VolumeX, Battery, Gauge, Navigation, Bike } from 'lucide-react';

const SEVERITY_STYLES = {
  low: { bg: 'bg-amber-600', label: 'Low' },
  medium: { bg: 'bg-orange-600', label: 'Medium' },
  high: { bg: 'bg-destructive', label: 'High' },
};

export default function EmergencyOverlay({
  phase,
  severity = 'low',
  countdown,
  onCancel,
  onResolve,
  emergencyNumber = '112',
  contactNotified,
  nearbyNotified,
  riderName,
  location,
  incidentInfo = {},
  beaconActive,
  audioEnabled,
  onToggleAudio,
}) {
  if (!phase) return null;

  const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.low;

  if (phase === 'countdown') {
    return (
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${style.bg} p-6`}>
        <AlertTriangle size={72} className="mb-4 animate-pulse text-white" />
        <p className="mb-2 text-2xl font-bold text-white">CRASH DETECTED</p>
        <div className="mb-6 rounded-full bg-white/20 px-4 py-1 text-sm font-bold text-white">
          Severity: {style.label}
        </div>
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
      <div className={`fixed inset-0 z-[100] flex flex-col items-center justify-center ${style.bg} p-6 overflow-y-auto`}>
        {beaconActive && (
          <div className="pointer-events-none fixed inset-0 z-[101]" style={{ animation: 'strobe 0.6s infinite' }} />
        )}
        <style>{`@keyframes strobe { 0%, 100% { background: transparent; } 50% { background: rgba(255,255,255,0.85); } }`}</style>

        <AlertTriangle size={48} className="mb-2 text-white" />
        <p className="mb-1 text-2xl font-bold text-white">EMERGENCY ACTIVE</p>
        <div className="mb-3 rounded-full bg-white/20 px-3 py-0.5 text-xs font-bold text-white">
          {style.label} Severity
        </div>
        <p className="mb-4 text-center text-sm text-white/70">Live location is being transmitted continuously.</p>

        <div className="mb-4 w-full max-w-xs rounded-2xl bg-black/30 p-3 text-white">
          <p className="mb-1 text-sm font-bold">{riderName || 'Rider'}</p>
          {incidentInfo.bikeMake && (
            <p className="flex items-center gap-1 text-xs text-white/70">
              <Bike size={12} /> {incidentInfo.bikeMake} {incidentInfo.bikeModel} {incidentInfo.bikeYear || ''}
            </p>
          )}
          <p className="flex items-center gap-1 text-xs text-white/70">
            <MapPin size={12} /> {location ? `${location[0].toFixed(4)}, ${location[1].toFixed(4)}` : 'Acquiring...'}
          </p>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-white/60">
            {incidentInfo.speed != null && <span className="flex items-center gap-1"><Gauge size={11} /> {incidentInfo.speed} km/h</span>}
            {incidentInfo.heading != null && <span className="flex items-center gap-1"><Navigation size={11} /> {Math.round(incidentInfo.heading)}°</span>}
            {incidentInfo.batteryLevel != null && <span className="flex items-center gap-1"><Battery size={11} /> {incidentInfo.batteryLevel}%</span>}
          </div>
        </div>

        <div className="mb-4 w-full max-w-xs space-y-2">
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${contactNotified ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}>
            <Mail size={16} />
            <span>{contactNotified ? 'Emergency contacts notified' : 'Notifying contacts...'}</span>
          </div>
          <div className={`flex items-center gap-2 rounded-xl p-3 text-sm ${nearbyNotified ? 'bg-white/15 text-white' : 'bg-white/5 text-white/50'}`}>
            <Users size={16} />
            <span>{nearbyNotified ? 'Nearby riders alerted' : 'Alerting nearby riders...'}</span>
          </div>
        </div>

        {beaconActive && (
          <button
            onClick={onToggleAudio}
            className="mb-3 flex min-h-[44px] w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-white/10 text-sm font-bold text-white active:scale-95"
          >
            {audioEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            {audioEnabled ? 'Mute Alarm' : 'Unmute Alarm'}
          </button>
        )}

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