import { Bike, MapPin } from 'lucide-react';

export default function LogoMark({ size = 240, className = '' }) {
  const iconSize = Math.round(size * 0.34);
  const badge = Math.round(iconSize * 1.7);
  const wordSize = Math.max(18, Math.round(size * 0.20));
  const tagSize = Math.max(9, Math.round(wordSize * 0.32));

  return (
    <div
      className={`flex flex-col items-center justify-center ${className}`}
      style={{ maxWidth: '85vw', display: 'flex' }}
    >
      <div
        className="relative flex items-center justify-center rounded-full"
        style={{
          width: badge,
          height: badge,
          background: 'hsl(var(--primary) / 0.12)',
          border: '2px solid hsl(var(--primary) / 0.55)',
          boxShadow: '0 6px 24px hsl(var(--primary) / 0.25)',
        }}
      >
        <Bike size={iconSize} className="text-primary" strokeWidth={2.2} />
        <MapPin
          size={Math.round(iconSize * 0.5)}
          className="absolute text-primary"
          strokeWidth={2.2}
          style={{ top: -Math.round(iconSize * 0.18), fill: 'hsl(var(--primary) / 0.25)' }}
        />
      </div>

      <div
        className="mt-3 font-extrabold italic tracking-tight leading-none"
        style={{ fontSize: wordSize }}
      >
        <span className="text-foreground">Moto</span>
        <span className="text-primary">Veya</span>
      </div>

      <div
        className="mt-2 font-semibold uppercase text-muted-foreground text-center"
        style={{ fontSize: tagSize, letterSpacing: '0.25em' }}
      >
        Your bike. Anytime. Anywhere.
      </div>
    </div>
  );
}