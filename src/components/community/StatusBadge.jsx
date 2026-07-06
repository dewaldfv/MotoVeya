export default function StatusBadge({ status }) {
  const cfg = {
    riding: { label: 'Riding', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', pulse: true },
    online: { label: 'Online', dot: 'bg-emerald-500', text: 'text-emerald-600 dark:text-emerald-400', pulse: false },
    offline: { label: 'Offline', dot: 'bg-muted-foreground', text: 'text-muted-foreground', pulse: false },
  }[status?.key] || { label: 'Offline', dot: 'bg-muted-foreground', text: 'text-muted-foreground', pulse: false };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${cfg.text}`}>
      <span className="relative flex h-2 w-2">
        {cfg.pulse && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${cfg.dot} opacity-75`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${cfg.dot}`} />
      </span>
      {cfg.label}
    </span>
  );
}