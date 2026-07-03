import { ChevronRight } from 'lucide-react';
import { getCategoryConfig } from '@/lib/serviceCategories';

export default function ServiceCard({ service, onClick }) {
  const config = getCategoryConfig(service.category);
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left transition active:scale-[0.98]"
    >
      <div
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
        style={{ backgroundColor: config.color + '20' }}
      >
        {config.icon}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-semibold">{service.name}</h3>
        <p className="truncate text-xs text-muted-foreground">{config.label}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs">
          <span className="font-medium text-primary">{service.distance}km</span>
          {service.phone && <span className="text-muted-foreground">· Has phone</span>}
        </div>
      </div>
      <ChevronRight size={18} className="shrink-0 text-muted-foreground" />
    </button>
  );
}