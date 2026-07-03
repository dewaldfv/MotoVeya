import { useState, useEffect } from 'react';
import { Shield, Check, X, Users, Calendar, TrendingUp, AlertTriangle, Siren } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginPrompt from '@/components/LoginPrompt';
import { toast } from 'sonner';

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [users, setUsers] = useState([]);
  const [crashAlerts, setCrashAlerts] = useState([]);
  const [distressAlerts, setDistressAlerts] = useState([]);
  const [rejectEvent, setRejectEvent] = useState(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) { setLoading(false); return; }
      const me = await base44.auth.me();
      setUser(me);
      if (me.role !== 'admin') { setLoading(false); return; }
      const [pending, events, crashData, distressData] = await Promise.all([
        base44.entities.Event.filter({ status: 'pending' }, '-created_date', 50),
        base44.entities.Event.list('-created_date', 20),
        base44.entities.CrashAlert.list('-created_date', 20),
        base44.entities.DistressAlert.list('-created_date', 20),
      ]);
      setPendingEvents(pending || []); setAllEvents(events || []); setCrashAlerts(crashData || []); setDistressAlerts(distressData || []);
      try { const userData = await base44.entities.User.list('-created_date', 50); setUsers(userData || []); } catch (e) { console.error(e); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleApprove = async (id) => { try { await base44.entities.Event.update(id, { status: 'approved' }); toast.success('Event approved'); loadAll(); } catch (e) { console.error(e); } };
  const handleReject = async () => { try { await base44.entities.Event.update(rejectEvent.id, { status: 'rejected', rejection_reason: rejectReason }); setRejectEvent(null); setRejectReason(''); loadAll(); } catch (e) { console.error(e); } };
  const handleRoleChange = async (userId, newRole) => { try { await base44.entities.User.update(userId, { role: newRole }); toast.success('Role updated'); loadAll(); } catch (e) { console.error(e); } };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt message="Admin access required" />;
  if (user.role !== 'admin') return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"><Shield size={48} className="text-muted-foreground" /><p className="text-lg text-muted-foreground">Admin access required.</p></div>;

  return (
    <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <div className="mb-4 flex items-center gap-2">
        <Shield size={24} className="text-primary" />
        <h1 className="text-2xl font-bold">Admin Portal</h1>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card p-3 text-center"><Users size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{users.length}</div><div className="text-[10px] text-muted-foreground">Users</div></div>
        <div className="rounded-2xl bg-card p-3 text-center"><Calendar size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{allEvents.length}</div><div className="text-[10px] text-muted-foreground">Events</div></div>
        <div className="rounded-2xl bg-card p-3 text-center"><TrendingUp size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{pendingEvents.length}</div><div className="text-[10px] text-muted-foreground">Pending</div></div>
      </div>

      <Tabs defaultValue="events">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="events" className="flex-1">Events ({pendingEvents.length})</TabsTrigger>
          <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1">Alerts</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-3">
          {pendingEvents.length === 0 ? <p className="py-8 text-center text-muted-foreground">No pending events.</p> : pendingEvents.map((ev) => (
            <div key={ev.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <Badge variant="secondary" className="mb-1 capitalize">{ev.category?.replace('_', ' ')}</Badge>
                  <h3 className="font-bold">{ev.title}</h3>
                  <p className="text-sm text-muted-foreground">{ev.venue_name} · {new Date(ev.event_date).toLocaleDateString('en-ZA')}</p>
                  {ev.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ev.description}</p>}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => handleApprove(ev.id)}><Check size={16} className="mr-1" /> Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectEvent(ev)}><X size={16} className="mr-1" /> Reject</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="users" className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
              <div>
                <p className="font-medium">{u.full_name || u.nickname || 'Unknown'}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{u.role}</Badge>
                {u.role !== 'organizer' && <Button size="sm" variant="ghost" onClick={() => handleRoleChange(u.id, 'organizer')}>Make Organizer</Button>}
                {u.role === 'organizer' && <Button size="sm" variant="ghost" onClick={() => handleRoleChange(u.id, 'user')}>Revoke</Button>}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="alerts" className="space-y-2">
          {crashAlerts.length === 0 && distressAlerts.length === 0 ? <p className="py-8 text-center text-muted-foreground">No alerts recorded.</p> : (
            <>
              {crashAlerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                  <AlertTriangle size={20} className="text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium">Crash — {a.rider_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleString('en-ZA')}</p>
                  </div>
                  <Badge variant={a.status === 'resolved' ? 'secondary' : 'destructive'}>{a.status}</Badge>
                </div>
              ))}
              {distressAlerts.map((a) => (
                <div key={a.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                  <Siren size={20} className="text-destructive" />
                  <div className="flex-1">
                    <p className="font-medium">Distress — {a.rider_name}</p>
                    <p className="text-xs text-muted-foreground">{new Date(a.timestamp).toLocaleString('en-ZA')}</p>
                  </div>
                  <Badge variant={a.status === 'resolved' ? 'secondary' : 'destructive'}>{a.status}</Badge>
                </div>
              ))}
            </>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectEvent} onOpenChange={(o) => { if (!o) { setRejectEvent(null); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject Event</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason for rejection</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Incomplete details, not a motorcycle event" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectEvent(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject Event</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}