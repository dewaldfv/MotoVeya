import { Bike, Check, X } from 'lucide-react';

export default function AutoStopCountdown({ countdown, onEnd, onContinue }) {
  if (countdown === null) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-card p-6 text-center shadow-2xl landscape:max-w-md">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Bike size={32} className="text-primary" />
        </div>
        <h3 className="mb-2 text-lg font-bold">Stopped riding?</h3>
        <p className="mb-4 text-sm text-muted-foreground">
          It looks like you've stopped riding. End this ride?
        </p>
        <div className="mb-6 text-5xl font-black text-primary landscape:text-6xl">{countdown}</div>
        <div className="space-y-2">
          <button
            onClick={onEnd}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-2xl bg-primary font-bold text-primary-foreground transition-transform active:scale-95"
          >
            <Check size={20} /> End Ride
          </button>
          <button
            onClick={onContinue}
            className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-secondary font-medium transition-transform active:scale-95"
          >
            <X size={18} /> Continue Riding
          </button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          Moving again? The ride will continue automatically.
        </p>
      </div>
    </div>
  );
}