import { dayLabels } from '@/lib/riderStats';

export default function MiniActivityChart({ activity = [], height = 44 }) {
  const labels = dayLabels();
  const max = Math.max(1, ...activity);
  return (
    <div className="flex items-end justify-between gap-1" style={{ height }}>
      {activity.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div
              className="w-full rounded-t-md bg-primary/80 transition-all"
              style={{ height: `${Math.max(4, (v / max) * 100)}%`, opacity: v > 0 ? 1 : 0.25 }}
            />
          </div>
          <span className="text-[9px] text-muted-foreground">{labels[i]}</span>
        </div>
      ))}
    </div>
  );
}