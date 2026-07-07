import { Siren, AlertTriangle, Square, Volume2, VolumeX } from 'lucide-react';

export default function NavActionButtons({ onDistress, onCrash, onEnd, distressActive, ending, disabled, voiceEnabled = true, onToggleVoice, showVoiceToggle = false }) {
  return (
    <div className="flex flex-col gap-2.5">
      {showVoiceToggle && (
        <button onClick={onToggleVoice} aria-label={voiceEnabled ? 'Mute voice navigation' : 'Enable voice navigation'}
          className={`flex h-11 w-11 items-center justify-center rounded-full shadow-lg transition-transform active:scale-90 ${voiceEnabled ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'}`}>
          {voiceEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
      )}
      {distressActive ? (
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive shadow-lg animate-pulse">
          <Siren size={18} className="text-white" />
        </div>
      ) : (
        <button onClick={onDistress} disabled={disabled} aria-label="Distress"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive shadow-lg transition-transform active:scale-90 disabled:opacity-40">
          <Siren size={18} className="text-white" />
        </button>
      )}
      <button onClick={onCrash} aria-label="Crash detection"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-card shadow-lg ring-2 ring-destructive transition-transform active:scale-90">
        <AlertTriangle size={18} className="text-destructive" />
      </button>
      <button onClick={onEnd} disabled={ending} aria-label="End ride"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-primary shadow-lg transition-transform active:scale-90 disabled:opacity-50">
        <Square size={16} className="text-white" fill="white" />
      </button>
    </div>
  );
}