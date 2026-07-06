import { Layers, LocateFixed, Compass } from 'lucide-react';

export default function NavControls({ active, headingUp, onLayers, onToggleHeading, onRecenter }) {
  const btn = 'flex h-11 w-11 items-center justify-center rounded-full bg-card/95 shadow-lg backdrop-blur-lg transition-transform active:scale-90';
  return (
    <div
      className="absolute right-3 z-10 flex flex-col gap-2"
      style={{ top: active ? 'calc(0.75rem + env(safe-area-inset-top))' : 'calc(4.5rem + env(safe-area-inset-top))' }}
    >
      <button onClick={onLayers} aria-label="Map layers" className={btn}>
        <Layers size={20} className="text-foreground" />
      </button>
      {active ? (
        <button onClick={onToggleHeading} aria-label="Toggle heading-up" className={btn}>
          <Compass size={20} className={headingUp ? 'text-primary' : 'text-muted-foreground'} />
        </button>
      ) : (
        <button onClick={onRecenter} aria-label="My location" className={btn}>
          <LocateFixed size={20} className="text-foreground" />
        </button>
      )}
    </div>
  );
}