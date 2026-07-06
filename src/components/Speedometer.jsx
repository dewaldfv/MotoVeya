export default function Speedometer({ speed = 0, limit = null }) {
  const maxSpeed = 200;
  const pct = Math.min(speed / maxSpeed, 1);
  const overLimit = limit != null && speed > limit;
  const r = 38;
  const cx = 50;
  const cy = 50;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75;
  const val = arc * pct;
  const color = overLimit ? '#ea4335' : '#2D7FF9';

  return (
    <div className={`relative h-[100px] w-[100px] rounded-full bg-card/95 shadow-xl backdrop-blur-lg ${overLimit ? 'ring-4 ring-destructive/40' : ''}`}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="5"
          strokeDasharray={`${arc} ${C}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="5"
          strokeDasharray={`${val} ${C}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-3xl font-black leading-none ${overLimit ? 'text-destructive' : 'text-foreground'}`}>{Math.round(speed)}</span>
        <span className="text-[9px] font-bold text-muted-foreground">km/h</span>
      </div>
    </div>
  );
}