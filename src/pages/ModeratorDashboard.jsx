import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Check, X, Calendar, Wrench, Flag, Siren, AlertTriangle, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

const notifyOrganizer = (eventId, status, reason) =>
  base44.functions.invoke('messaging-secure', { action: 'notify_event', event_id: eventId, status, reason }).catch((e) => console.error('notify_event', e));

const notifyServiceSubmitter = (serviceId, status, reason) =>
  base44.functions.invoke('messaging-secure', { action: 'notify_service', service_id: serviceId, status, reason }).catch((e) => console.error('notify_service', e));

export default function ModeratorDashboard() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingEvents, setPendingEvents] = useState([]);
  const [pendingServices, setPendingServices] = useState([]);
  const [reports, setReports] = useState([]);
  const [crashAlerts, setCrashAlerts] = useState([]);
  const [distressAlerts, setDistressAlerts] = useState([]);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [reportTarget, setReportTarget] = useState(null);
  const [reportNotes, setReportNotes] = useState('');

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    try {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) { setLoading(false); return; }
      const me = await base44.auth.me();
      setUser(me);
      if (me.role !== 'admin' && me.role !== 'moderator') { setLoading(false); return; }
      const [pending, pendingSvc, reportData, crashData, distressData] = await Promise.all([
        base44.entities.Event.filter({ status: 'pending' }, '-created_date', 50),
        base44.entities.Service.filter({ status: 'pending' }, '-created_date', 50),
        base44.entities.Report.filter({ status: 'pending' }, '-created_date', 50),
        base44.entities.CrashAlert.list('-created_date', 20),
        base44.entities.DistressAlert.list('-created_date', 20),
      ]);
      setPendingEvents(pending || []);
      setPendingServices(pendingSvc || []);
      setReports(reportData || []);
      setCrashAlerts(crashData || []);
      setDistressAlerts(distressData || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

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

  const handleReportAction = async (newStatus) => {
    try {
      await base44.entities.Report.update(reportTarget.id, {
        status: newStatus,
        resolution_notes: reportNotes,
        handled_by_name: user?.full_name || user?.nickname || 'Moderator'
      });
      toast.success(`Report ${newStatus}`);
      setReportTarget(null);
      setReportNotes('');
      loadAll();
    } catch (e) { console.error(e); toast.error('Could not update report'); }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"><Shield size={48} className="text-muted-foreground" /><p className="text-lg text-muted-foreground">Please log in.</p></div>;
  if (user.role !== 'admin' && user.role !== 'moderator') return <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center"><Shield size={48} className="text-muted-foreground" /><p className="text-lg text-muted-foreground">Moderator access required.</p></div>;

  return (
    <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <div className="mb-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="glove-target flex h-10 w-10 items-center justify-center rounded-full bg-card"><ArrowLeft size={20} /></button>
        <Shield size={24} className="text-primary" />
        <h1 className="text-2xl font-bold">Moderator Dashboard</h1>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl bg-card p-3 text-center"><Calendar size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{pendingEvents.length}</div><div className="text-[10px] text-muted-foreground">Events</div></div>
        <div className="rounded-2xl bg-card p-3 text-center"><Wrench size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{pendingServices.length}</div><div className="text-[10px] text-muted-foreground">Services</div></div>
        <div className="rounded-2xl bg-card p-3 text-center"><Flag size={18} className="mx-auto mb-1 text-primary" /><div className="text-xl font-black">{reports.length}</div><div className="text-[10px] text-muted-foreground">Reports</div></div>
      </div>

      <Tabs defaultValue="events">
        <TabsList className="mb-4 w-full">
          <TabsTrigger value="events" className="flex-1">Events ({pendingEvents.length})</TabsTrigger>
          <TabsTrigger value="services" className="flex-1">Services ({pendingServices.length})</TabsTrigger>
          <TabsTrigger value="reports" className="flex-1">Reports ({reports.length})</TabsTrigger>
          <TabsTrigger value="safety" className="flex-1">Safety</TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="space-y-3">
          {pendingEvents.length === 0 ? <p className="py-8 text-center text-muted-foreground">No pending events.</p> : pendingEvents.map((ev) => (
            <div key={ev.id} className="rounded-2xl bg-card p-4">
              <Badge variant="secondary" className="mb-1 capitalize">{ev.category?.replace('_', ' ')}</Badge>
              <h3 className="font-bold">{ev.title}</h3>
              <p className="text-sm text-muted-foreground">{ev.venue_name} · {new Date(ev.event_date).toLocaleDateString('en-ZA')}</p>
              {ev.description && <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{ev.description}</p>}
              <div className="mt-3 flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => handleApproveEvent(ev.id)}><Check size={16} className="mr-1" /> Approve</Button>
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
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary"><Wrench size={24} className="text-muted-foreground" /></div>
                )}
                <div className="min-w-0 flex-1">
                  <Badge variant="secondary" className="mb-1 capitalize">{svc.category?.replace('_', ' ')}</Badge>
                  <h3 className="font-bold">{svc.name}</h3>
                  <p className="text-sm text-muted-foreground">{[svc.town, svc.province].filter(Boolean).join(', ') || svc.address}</p>
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

        <TabsContent value="reports" className="space-y-3">
          {reports.length === 0 ? <p className="py-8 text-center text-muted-foreground">No pending reports.</p> : reports.map((r) => (
            <div key={r.id} className="rounded-2xl bg-card p-4">
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="capitalize">{r.target_type}</Badge>
                <Badge variant="outline" className="capitalize">{r.reason}</Badge>
              </div>
              <h3 className="mt-1 font-bold">{r.target_name || 'Unnamed target'}</h3>
              {r.description && <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>}
              <p className="mt-1 text-xs text-muted-foreground">Reported by {r.reporter_name || 'a rider'}</p>
              <Button size="sm" className="mt-3 w-full" onClick={() => setReportTarget(r)}><Flag size={16} className="mr-1" /> Review</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="safety" className="space-y-2">
          {crashAlerts.length === 0 && distressAlerts.length === 0 ? <p className="py-8 text-center text-muted-foreground">No safety alerts recorded.</p> : (
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

      <Dialog open={!!reportTarget} onOpenChange={(o) => { if (!o) { setReportTarget(null); setReportNotes(''); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Review Report</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">{reportTarget?.target_name} — <span className="capitalize">{reportTarget?.reason}</span></p>
            <Label>Resolution notes</Label>
            <Input value={reportNotes} onChange={(e) => setReportNotes(e.target.value)} placeholder="Action taken or decision" />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReportTarget(null); setReportNotes(''); }}>Cancel</Button>
            <Button variant="secondary" onClick={() => handleReportAction('dismissed')}>Dismiss</Button>
            <Button onClick={() => handleReportAction('resolved')}>Mark Resolved</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}