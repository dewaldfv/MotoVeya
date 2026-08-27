import { useState, useEffect } from 'react';
import { Shield, Check, X, Users, Calendar, TrendingUp, AlertTriangle, Siren, Crown, Wrench, MapPin, Pencil, Eye } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginPrompt from '@/components/LoginPrompt';
import EditUserDialog from '@/components/admin/EditUserDialog';
import POISubmitDialog from '@/components/services/POISubmitDialog';
import EventSubmitDialog from '@/components/EventSubmitDialog';
import { toast } from 'sonner';

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [pendingServices, setPendingServices] = useState([]);
  const [users, setUsers] = useState([]);
  const [crashAlerts, setCrashAlerts] = useState([]);
  const [distressAlerts, setDistressAlerts] = useState([]);
  const [rejectTarget, setRejectTarget] = useState(null); // { type: 'event'|'service', record }
  const [rejectReason, setRejectReason] = useState('');
  const [editUser, setEditUser] = useState(null);
  const [poiSubmitOpen, setPoiSubmitOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);
  const [editRequests, setEditRequests] = useState([]);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) { setLoading(false); return; }
      const me = await base44.auth.me();
      setUser(me);
      if (me.role !== 'admin') { setLoading(false); return; }
      const [pending, events, pendingSvc, crashData, distressData] = await Promise.all([
        base44.entities.Event.filter({ status: 'pending' }, '-created_date', 50),
        base44.entities.Event.list('-created_date', 20),
        base44.entities.Service.filter({ status: 'pending' }, '-created_date', 50),
        base44.entities.CrashAlert.list('-created_date', 20),
        base44.entities.DistressAlert.list('-created_date', 20),
      ]);
      let requests = [];
      try { requests = await base44.entities.EventEditRequest.list('-created_date', 50); } catch (e) { console.error(e); }
      setEditRequests(requests || []);
      setPendingEvents(pending || []); setAllEvents(events || []); setPendingServices(pendingSvc || []); setCrashAlerts(crashData || []); setDistressAlerts(distressData || []);
      try { const userData = await base44.entities.User.list('-created_date', 50); setUsers(userData || []); } catch (e) { console.error(e); }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const notifyOrganizer = (eventId, status, reason) =>
    base44.functions.invoke('messaging-secure', { action: 'notify_event', event_id: eventId, status, reason }).catch((e) => console.error('notify_event', e));

  const notifyServiceSubmitter = (serviceId, status, reason) =>
    base44.functions.invoke('messaging-secure', { action: 'notify_service', service_id: serviceId, status, reason }).catch((e) => console.error('notify_service', e));

  const handleApproveEvent = async (id) => {
    try {
      await base44.entities.Event.update(id, { status: 'approved' });
      toast.success('Event approved — organizer notified');
      notifyOrganizer(id, 'approved');
      loadAll();
    } catch (e) { console.error(e); toast.error('Could not approve event'); }
  };

  const handleApproveService = async (id) => {
    try {
      await base44.entities.Service.update(id, { status: 'approved' });
      toast.success('Service approved — submitter notified');
      notifyServiceSubmitter(id, 'approved');
      loadAll();
    } catch (e) { console.error(e); toast.error('Could not approve service'); }
  };

  const handleReject = async () => {
    try {
      if (rejectTarget?.type === 'service') {
        await base44.entities.Service.update(rejectTarget.record.id, { status: 'rejected', rejection_reason: rejectReason });
        toast.success('Service rejected — submitter notified');
        notifyServiceSubmitter(rejectTarget.record.id, 'rejected', rejectReason);
      } else {
        await base44.entities.Event.update(rejectTarget.record.id, { status: 'rejected', rejection_reason: rejectReason });
        toast.success('Event rejected — organizer notified');
        notifyOrganizer(rejectTarget.record.id, 'rejected', rejectReason);
      }
      setRejectTarget(null);
      setRejectReason('');
      loadAll();
    } catch (e) { console.error(e); toast.error('Could not reject'); }
  };
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
        <div className="rounded-2xl bg-card p-3 text-center"><Wrench size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{pendingServices.length}</div><div className="text-[10px] text-muted-foreground">Services</div></div>
      </div>

      <Tabs defaultValue="events">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="events" className="flex-1">Events ({pendingEvents.length + editRequests.filter((r) => r.status === 'pending').length})</TabsTrigger>
          <TabsTrigger value="services" className="flex-1">Services ({pendingServices.length})</TabsTrigger>
          <TabsTrigger value="users" className="flex-1">Users</TabsTrigger>
          <TabsTrigger value="alerts" className="flex-1">Alerts</TabsTrigger>
          <TabsTrigger value="poi" className="flex-1">POIs</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-3">
          {editRequests.filter((r) => r.status === 'pending').map((req) => {
            const ev = allEvents.find((e) => e.id === req.event_id);
            return ev ? <div key={`edit-${req.id}`} className="rounded-2xl border border-primary/30 bg-card p-4">
              <div className="flex items-start gap-3">
                {ev.photo_urls?.[0] && <img src={ev.photo_urls[0]} alt={ev.title} className="h-16 w-16 rounded-xl object-cover" />}
                <div className="flex-1"><Badge className="mb-1">Changes Pending</Badge><h3 className="font-bold">{ev.title}</h3><p className="text-sm text-muted-foreground">{ev.venue_name} · {new Date(ev.event_date).toLocaleDateString('en-ZA')}</p></div>
              </div>
              <div className="mt-3 flex gap-2"><Button size="sm" className="flex-1" onClick={async () => { try { const payload = JSON.parse(req.change_payload || '{}'); await base44.entities.Event.update(ev.id, { ...payload, status: 'approved' }); await base44.entities.EventEditRequest.update(req.id, { status: 'approved', reviewed_by_id: user.id, reviewed_at: new Date().toISOString(), review_notes: 'Changes approved and published' }); toast.success('Changes approved and published'); loadAll(); } catch (e) { console.error(e); toast.error('Could not approve changes'); } }}><Check size={16} className="mr-1" /> Approve Changes</Button><Button size="sm" variant="secondary" onClick={() => setEditEvent(ev)}><Pencil size={16} className="mr-1" /> Edit</Button><Button size="sm" variant="outline" onClick={async () => { try { await base44.entities.EventEditRequest.update(req.id, { status: 'rejected', reviewed_by_id: user.id, reviewed_at: new Date().toISOString(), review_notes: 'Changes rejected by admin' }); toast.success('Change request rejected'); loadAll(); } catch (e) { toast.error('Could not reject changes'); } }}><X size={16} className="mr-1" /> Reject</Button></div>
            </div> : null;
          })}
          {pendingEvents.length === 0 ? <p className="py-8 text-center text-muted-foreground">No new event submissions.</p> : pendingEvents.map((ev) => (
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
                <Button size="sm" className="flex-1" onClick={() => handleApproveEvent(ev.id)}><Check size={16} className="mr-1" /> Approve</Button>
                <Button size="sm" variant="secondary" onClick={() => setEditEvent(ev)}><Pencil size={16} className="mr-1" /> Edit</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectTarget({ type: 'event', record: ev })}><X size={16} className="mr-1" /> Reject</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="services" className="space-y-3">
          {pendingServices.length === 0 ? <p className="py-8 text-center text-muted-foreground">No pending services.</p> : pendingServices.map((svc) => (
            <div key={svc.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-start gap-3">
                {svc.photo_urls?.[0] || svc.logo_url ? (
                  <img src={svc.photo_urls?.[0] || svc.logo_url} alt={svc.name} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl"><Wrench size={24} className="text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="mb-1 capitalize">{svc.category?.replace('_', ' ')}</Badge>
                  <h3 className="font-bold">{svc.name}</h3>
                  <p className="text-sm text-muted-foreground">{[svc.town, svc.province].filter(Boolean).join(', ') || svc.address}</p>
                  {svc.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{svc.description}</p>}
                  {svc.submitter_notes && <p className="mt-1 text-xs italic text-muted-foreground">Notes: {svc.submitter_notes}</p>}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => handleApproveService(svc.id)}><Check size={16} className="mr-1" /> Approve</Button>
                <Button size="sm" variant="destructive" onClick={() => setRejectTarget({ type: 'service', record: svc })}><X size={16} className="mr-1" /> Reject</Button>
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
                {u.subscription_tier === 'premium' && <Badge className="capitalize"><Crown size={12} className="mr-1" />Premium</Badge>}
                <Badge variant={u.role === 'admin' ? 'default' : 'secondary'} className="capitalize">{u.role}</Badge>
                {u.role !== 'organizer' && <Button size="sm" variant="ghost" onClick={() => handleRoleChange(u.id, 'organizer')}>Make Organizer</Button>}
                {u.role === 'organizer' && <Button size="sm" variant="ghost" onClick={() => handleRoleChange(u.id, 'user')}>Revoke</Button>}
                <Button size="sm" variant="ghost" onClick={() => setEditUser(u)}>Edit</Button>
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="poi" className="space-y-4">
          <div className="rounded-2xl bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><MapPin size={22} /></div>
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">Add POI</h2>
                <p className="text-sm text-muted-foreground">Create a POI using the same form, fields, location picker and image handling as Services. POIs are administered here and are not automatically imported.</p>
              </div>
            </div>
            <Button className="mt-4 w-full" onClick={() => setPoiSubmitOpen(true)}><MapPin size={16} className="mr-2" /> Add POI</Button>
          </div>
          <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
            POIs are currently admin-managed only. No automatic OSM POIs are displayed on the map.
          </div>
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

      <Dialog open={!!rejectTarget} onOpenChange={(o) => { if (!o) { setRejectTarget(null); setRejectReason(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject {rejectTarget?.type === 'service' ? 'Service' : 'Event'}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label>Reason for rejection</Label>
            <Input value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} placeholder="e.g. Incomplete details, not a motorcycle service" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setRejectTarget(null); setRejectReason(''); }}>Cancel</Button>
            <Button variant="destructive" onClick={handleReject}>Reject</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <POISubmitDialog
        open={poiSubmitOpen}
        onOpenChange={setPoiSubmitOpen}
        onSubmitted={() => loadAll()}
      />

      <EventSubmitDialog open={!!editEvent} onOpenChange={(o) => { if (!o) setEditEvent(null); }} onSubmitted={loadAll} editEvent={editEvent} onEditClose={() => setEditEvent(null)} />

      {editUser && (
        <EditUserDialog
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={loadAll}
        />
      )}
    </div>
  );
}