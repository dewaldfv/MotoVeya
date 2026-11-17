import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

export default function RemoveRecordDialog({ target, onCancel, onConfirm }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setReason('');
    setBusy(false);
  }, [target]);

  if (!target) return null;

  const isService = target.type === 'service';
  const name = isService ? target.record?.name : target.record?.title;
  const canRemove = reason.trim().length > 0 && !busy;

  const handleRemove = async () => {
    if (!canRemove) return;
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove {isService ? 'Service' : 'Event'}</DialogTitle>
          <DialogDescription>
            “{name}” will be taken down from MotoVeya. The submitter receives a notification with your reason.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="removal-reason">Reason for removal *</Label>
          <Textarea
            id="removal-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={isService ? 'e.g. Business has closed down' : 'e.g. Event was cancelled by the organiser'}
          />
          {reason.trim().length === 0 && (
            <p className="text-xs text-muted-foreground">A reason is required so the submitter knows why.</p>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button variant="destructive" onClick={handleRemove} disabled={!canRemove}>
            <Trash2 size={16} className="mr-2" />
            {busy ? 'Removing…' : 'Remove'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}