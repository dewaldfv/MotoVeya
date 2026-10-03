import { useState } from 'react';
import { Megaphone, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

// Admin action: broadcasts a "Testing is Active" push notification and email
// to every registered app user via the broadcast-testing-active backend function.
export default function BroadcastCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleSend = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('broadcast-testing-active', {});
      const data = res?.data || res;
      setResult(data);
      toast.success(`Broadcast sent — ${data?.emails_sent ?? 0} emails, ${data?.push_sent ?? 0} pushes`);
    } catch (e) {
      console.error(e);
      toast.error(e.message || 'Broadcast failed');
    } finally {
      setLoading(false);
    }
  };

  const close = () => {
    setOpen(false);
    setResult(null);
  };

  return (
    <>
      <div className="rounded-2xl bg-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Megaphone size={22} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-bold">Broadcast Announcement</h2>
            <p className="text-sm text-muted-foreground">
              Send a "Testing is Active" push notification and email to every registered user.
            </p>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
          <Send size={16} className="mr-2" /> Broadcast "Testing is Active"
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast to all users?</DialogTitle>
          </DialogHeader>
          {result ? (
            <div className="space-y-2 py-2 text-sm">
              <p className="font-medium">Broadcast complete</p>
              <p className="text-muted-foreground">Total users: {result.total_users}</p>
              <p className="text-muted-foreground">Emails sent: {result.emails_sent}{result.email_failed ? ` (${result.email_failed} failed)` : ''}</p>
              <p className="text-muted-foreground">Push sent: {result.push_sent}{result.push_failed ? ` (${result.push_failed} failed)` : ''}</p>
              <p className="text-xs text-muted-foreground">Push delivery requires the native mobile build with push credentials configured.</p>
            </div>
          ) : (
            <p className="py-2 text-sm text-muted-foreground">
              This will send a push notification and an email titled "Testing is Active" to every registered user. Continue?
            </p>
          )}
          <DialogFooter>
            {result ? (
              <Button onClick={close}>Done</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={close} disabled={loading}>Cancel</Button>
                <Button onClick={handleSend} disabled={loading}>
                  {loading ? (<><Loader2 size={16} className="mr-2 animate-spin" /> Sending...</>) : 'Send to all users'}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}