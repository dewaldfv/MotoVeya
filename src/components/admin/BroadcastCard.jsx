import { useState } from 'react';
import { Megaphone, Loader2, Send } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

// Admin action: broadcasts a custom push notification and email to every
// registered app user via the broadcast-testing-active backend function.
export default function BroadcastCard() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [title, setTitle] = useState('Testing is Active');
  const [message, setMessage] = useState('MotoVeya testing is currently active. Thanks for being part of the community!');

  const handleSend = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('broadcast-testing-active', { title, message });
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
              Send a custom push notification and email to every registered user.
            </p>
          </div>
        </div>
        <Button className="mt-4 w-full" onClick={() => setOpen(true)}>
          <Send size={16} className="mr-2" /> Compose Broadcast
        </Button>
      </div>

      <Dialog open={open} onOpenChange={(o) => { if (!o) close(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{result ? 'Broadcast complete' : 'Compose broadcast'}</DialogTitle>
          </DialogHeader>
          {result ? (
            <div className="space-y-2 py-2 text-sm">
              <p className="text-muted-foreground">Total users: {result.total_users}</p>
              <p className="text-muted-foreground">Web push delivered: {result.web_push_sent ?? 0}</p>
              <p className="text-muted-foreground">Native push: {result.native_push_sent ?? 0}{result.push_failed ? ` (${result.push_failed} not deliverable)` : ''}</p>
              <p className="text-muted-foreground">In-app notifications: {result.in_app_notified ?? 0}</p>
              <p className="text-muted-foreground">Emails sent: {result.emails_sent}{result.email_failed ? ` (${result.email_failed} failed)` : ''}</p>
              {result.web_push_sent === 0 && result.native_push_sent === 0 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">No push subscriptions found. Users must enable notifications in Settings to receive pushes.</p>
              )}
            </div>
          ) : (
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="broadcast-title">Title</Label>
                <Input
                  id="broadcast-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Testing is Active"
                  maxLength={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="broadcast-message">Message</Label>
                <Textarea
                  id="broadcast-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Write the announcement body..."
                  rows={4}
                  maxLength={1000}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This sends a push notification and an email to every registered user.
              </p>
            </div>
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