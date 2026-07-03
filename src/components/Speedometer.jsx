export default function Speedometer({ speed = 0, limit = 80 }) {
  const maxSpeed = 200;
  const pct = Math.min(speed / maxSpeed, 1);
  const overLimit = speed > limit;
  const r = 30;
  const cx = 40;
  const cy = 40;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75;
  const val = arc * pct;
  const color = overLimit ? '#ea4335' : '#4285F4';

  return (
    <div className="relative h-[72px] w-[72px] rounded-full bg-card/95 shadow-lg backdrop-blur-lg">
      <svg viewBox="0 0 80 80" className="absolute inset-0 h-full w-full">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="4"
          strokeDasharray={`${arc} ${C}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`} />
        <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${val} ${C}`} strokeLinecap="round" transform={`rotate(135 ${cx} ${cy})`}
          style={{ transition: 'stroke-dasharray 0.3s ease, stroke 0.3s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-lg font-black leading-none ${overLimit ? 'text-destructive' : 'text-foreground'}`}>{Math.round(speed)}</span>
        <span className="text-[8px] font-semibold text-muted-foreground">km/h</span>
      </div>
      {overLimit && (
        <div className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-destructive px-1.5 py-0.5 text-[8px] font-bold text-white">{limit}</div>
      )}
    </div>
  );
}