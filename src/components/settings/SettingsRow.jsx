import { ChevronRight } from 'lucide-react';

export default function SettingsRow({ icon, label, value, onClick, destructive, showChevron, children }) {
  const hasAction = !!onClick;
  const Tag = hasAction ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      disabled={hasAction && !onClick}
      className={`flex w-full items-center justify-between px-4 py-3.5 text-left transition-colors ${hasAction ? 'active:bg-secondary' : 'cursor-default'}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon && (
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${destructive ? 'bg-destructive/10 text-destructive' : 'bg-secondary text-muted-foreground'}`}>
            {icon}
          </span>
        )}
        <span className={`truncate text-sm font-medium ${destructive ? 'text-destructive' : ''}`}>{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {value && <span className="text-sm text-muted-foreground">{value}</span>}
        {children}
        {hasAction && showChevron !== false && !value && <ChevronRight size={18} className="text-muted-foreground" />}
      </div>
    </Tag>
  );
}