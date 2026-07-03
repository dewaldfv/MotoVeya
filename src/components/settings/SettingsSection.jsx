export default function SettingsSection({ title, icon, children }) {
  return (
    <div className="mb-6">
      {title && (
        <div className="mb-2 flex items-center gap-1.5 px-1">
          {icon && <span className="text-sm">{icon}</span>}
          <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{title}</h2>
        </div>
      )}
      <div className="divide-y divide-border overflow-hidden rounded-2xl bg-card">
        {children}
      </div>
    </div>
  );
}