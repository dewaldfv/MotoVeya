import { Siren, AlertTriangle, Square } from 'lucide-react';

export default function NavActionButtons({ onDistress, onCrash, onEnd, distressActive, ending, disabled }) {
  return (
    <div className="flex flex-col gap-2.5">
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