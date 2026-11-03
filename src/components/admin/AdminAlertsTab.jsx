import { useState } from 'react';
import { AlertTriangle, Siren, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const CRASH_STATUSES = ['active', 'countdown', 'resolved', 'false_alarm'];
const DISTRESS_STATUSES = ['active', 'resolved'];

const label = (status) => String(status || 'active').replace(/_/g, ' ');

function AlertRow({ icon: Icon, title, timestamp, status, statuses, saving, onStatusChange, onRemove }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3">
      <Icon size={20} className="text-destructive" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{timestamp ? new Date(timestamp).toLocaleString('en-ZA') : 'Time unknown'}</p>
      </div>
      <Select value={status || 'active'} onValueChange={onStatusChange} disabled={saving}>
        <SelectTrigger className="h-9 w-[140px] capitalize">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statuses.map((s) => (
            <SelectItem key={s} value={s} className="capitalize">{label(s)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Badge variant={status === 'active' || status === 'countdown' ? 'destructive' : 'secondary'} className="capitalize">
        {label(status)}
      </Badge>
      {onRemove && (
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onRemove}>
          <Trash2 size={16} />
          <span className="ml-1">Remove</span>
        </Button>
      )}
    </div>
  );
}

export default function AdminAlertsTab({ crashAlerts = [], distressAlerts = [], onRefresh }) {
  const [savingId, setSavingId] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);

  const updateStatus = async (entity, alert, status) => {
    if (status === alert.status) return;
    setSavingId(alert.id);
    try {
      await base44.entities[entity].update(alert.id, { status });
      toast.success('Alert status updated');
      onRefresh?.();
    } catch (e) {
      console.error(e);
      toast.error('Could not update alert');
    } finally {
      setSavingId(null);
    }
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    try {
      await base44.entities.CrashAlert.delete(removeTarget.id);
      toast.success('Crash alert removed');
      setRemoveTarget(null);
      onRefresh?.();
    } catch (e) {
      console.error(e);
      toast.error('Could not remove alert');
    }
  };

  if (crashAlerts.length === 0 && distressAlerts.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">No alerts recorded.</p>;
  }

  return (
    <div className="space-y-2">
      {crashAlerts.map((a) => (
        <AlertRow
          key={a.id}
          icon={AlertTriangle}
          title={`Crash — ${a.rider_name || 'Unknown rider'}`}
          timestamp={a.timestamp}
          status={a.status}
          statuses={CRASH_STATUSES}
          saving={savingId === a.id}
          onStatusChange={(status) => updateStatus('CrashAlert', a, status)}
          onRemove={() => setRemoveTarget(a)}
        />
      ))}
      {distressAlerts.map((a) => (
        <AlertRow
          key={a.id}
          icon={Siren}
          title={`Distress — ${a.rider_name || 'Unknown rider'}`}
          timestamp={a.timestamp}
          status={a.status}
          statuses={DISTRESS_STATUSES}
          saving={savingId === a.id}
          onStatusChange={(status) => updateStatus('DistressAlert', a, status)}
        />
      ))}

      <AlertDialog open={!!removeTarget} onOpenChange={(o) => { if (!o) setRemoveTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this crash alert?</AlertDialogTitle>
            <AlertDialogDescription>
              The crash alert for {removeTarget?.rider_name || 'this rider'} will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={handleRemove}>
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}