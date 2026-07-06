export default function SpeedLimitBadge({ limit = null, speed = 0 }) {
  if (limit == null) return null;
  const over = speed > limit;
  return (
    <div className={`flex h-12 w-12 flex-col items-center justify-center rounded-full bg-white shadow-lg ring-2 ring-destructive ${over ? 'animate-pulse' : ''}`}>
      <span className="text-[7px] font-black leading-none text-destructive">MAX</span>
      <span className="text-lg font-black leading-none text-black">{limit}</span>
    </div>
  );
}