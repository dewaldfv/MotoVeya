import { Eye, Clock, BadgeCheck, AlertCircle, Hourglass, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getServiceCategory } from '@/lib/serviceCategories';

const STATUS_CONFIG = {
  pending: { label: 'Pending Review', icon: Hourglass, className: 'bg-yellow-500/15 text-yellow-600' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-green-500/15 text-green-600' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-red-500/15 text-red-600' },
};

export default function ProviderListingCard({ service, onEdit }) {
  const cat = getServiceCategory(service.category);
  const status = STATUS_CONFIG[service.status] || STATUS_CONFIG.pending;
  const StatusIcon = status.icon;
  const views = service.view_count || 0;

  return (
    <div className="rounded-2xl bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl" style={{ backgroundColor: cat.color + '20' }}>{cat.emoji}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate font-bold">{service.name}</h3>
            <span className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${status.className}`}>
              <StatusIcon size={12} /> {status.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{cat.label}</p>
          {service.town && <p className="text-xs text-muted-foreground">{service.town}{service.province ? `, ${service.province}` : ''}</p>}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground"><Eye size={15} /> {views} {views === 1 ? 'view' : 'views'}</span>
        {service.is_verified && <span className="flex items-center gap-1 text-blue-600"><BadgeCheck size={15} /> Verified</span>}
      </div>

      {service.status === 'rejected' && service.rejection_reason && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-red-500/10 p-2.5 text-sm text-red-600">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          <p>{service.rejection_reason}</p>
        </div>
      )}

      <Button variant="outline" className="mt-3 min-h-[48px] w-full" onClick={onEdit}>
        Edit Contact Info
      </Button>
    </div>
  );
}