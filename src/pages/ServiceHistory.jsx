import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Trash2, Wrench, Calendar, MapPin, Loader2, Bike as BikeIcon } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginPrompt from '@/components/LoginPrompt';
import { toast } from 'sonner';

const SERVICE_TYPES = [
  { value: 'oil_change', label: 'Oil Change', icon: '🛢️' },
  { value: 'chain_sprockets', label: 'Chain & Sprockets', icon: '⛓️' },
  { value: 'tyres', label: 'Tyres', icon: '🛞' },
  { value: 'brakes', label: 'Brakes', icon: '🛑' },
  { value: 'battery', label: 'Battery', icon: '🔋' },
  { value: 'general_service', label: 'General Service', icon: '🔧' },
  { value: 'major_service', label: 'Major Service', icon: '⚙️' },
  { value: 'suspension', label: 'Suspension', icon: '🪛' },
  { value: 'electrical', label: 'Electrical', icon: '⚡' },
  { value: 'other', label: 'Other', icon: '🧰' },
];

const TYPE_LABEL = (v) => SERVICE_TYPES.find((t) => t.value === v)?.label || v;
const TYPE_ICON = (v) => SERVICE_TYPES.find((t) => t.value === v)?.icon || '🔧';

const EMPTY = { bike_id: '', service_type: 'general_service', description: '', workshop_name: '', cost_zar: '', odometer_km: '', service_date: new Date().toISOString().slice(0, 10), next_service_km: '' };
const num = (v) => (v === '' ? undefined : Number(v));

export default function ServiceHistory() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [bikeFilter, setBikeFilter] = useState('');
  const [autoRecord, setAutoRecord] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const bikeId = params.get('bike');
    if (bikeId) setBikeFilter(bikeId);
    if (params.get('record') === '1') setAutoRecord(true);
  }, []);

  useEffect(() => {
    (async () => {
      try { const ok = await base44.auth.isAuthenticated(); if (ok) setUser(await base44.auth.me()); }
      catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const { data: bikes = [] } = useQuery({
    queryKey: ['bikes', user?.id],
    queryFn: () => base44.entities.Bike.filter({}, '-created_date', 50),
    enabled: !!user?.id,
  });

  // Auto-open the Record Service dialog when arriving via a "record" deep link.
  useEffect(() => {
    if (!autoRecord || bikes.length === 0) return;
    const preselect = bikeFilter || bikes.find((b) => b.is_primary)?.id || bikes[0]?.id || '';
    setForm({ ...EMPTY, bike_id: preselect });
    setDialog(true);
    setAutoRecord(false);
  }, [autoRecord, bikes, bikeFilter]);

  const { data: records = [] } = useQuery({
    queryKey: ['service-records', user?.id],
    queryFn: () => base44.entities.ServiceRecord.filter({}, '-service_date', 200),
    enabled: !!user?.id,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.ServiceRecord.create(data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['service-records'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ServiceRecord.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['service-records'] }),
  });

  const openAdd = () => { setForm({ ...EMPTY, bike_id: bikeFilter || bikes.find((b) => b.is_primary)?.id || bikes[0]?.id || '' }); setDialog(true); };

  const handleSave = async () => {
    if (!form.bike_id) { toast.error('Select a motorcycle'); return; }
    const bike = bikes.find((b) => b.id === form.bike_id);
    try {
      await createMutation.mutateAsync({
        bike_id: form.bike_id,
        bike_make: bike?.make,
        bike_model: bike?.model,
        service_type: form.service_type,
        description: form.description.trim() || undefined,
        workshop_name: form.workshop_name.trim() || undefined,
        cost_zar: num(form.cost_zar),
        odometer_km: num(form.odometer_km),
        service_date: new Date(form.service_date).toISOString(),
        next_service_km: num(form.next_service_km),
      });
      setDialog(false);
      toast.success('Service recorded');
    } catch (e) { console.error(e); toast.error('Could not save service record'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this service record?')) return;
    try { await deleteMutation.mutateAsync(id); toast.success('Record deleted'); }
    catch (e) { toast.error('Could not delete'); }
  };

  const filteredRecords = bikeFilter ? records.filter((r) => r.bike_id === bikeFilter) : records;
  const totalCost = filteredRecords.reduce((s, r) => s + (r.cost_zar || 0), 0);
  const lastService = filteredRecords[0];
  const nextService = [...filteredRecords].filter((r) => r.next_service_km).sort((a, b) => (b.odometer_km || 0) + (b.next_service_km || 0) - ((a.odometer_km || 0) + (a.next_service_km || 0)))[0];
  const filteredBike = bikeFilter ? bikes.find((b) => b.id === bikeFilter) : null;

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt />;

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Service History</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        {filteredBike && (
          <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-3">
            <p className="text-sm text-muted-foreground">Showing <span className="font-semibold text-foreground">{filteredBike.make} {filteredBike.model}</span></p>
            <button onClick={() => setBikeFilter('')} className="text-xs font-semibold text-primary">Show all</button>
          </div>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Services" value={filteredRecords.length} />
          <Stat label="Total Spent" value={`R${Math.round(totalCost)}`} />
          <Stat label="Last Service" value={lastService ? new Date(lastService.service_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : '—'} />
        </div>

        <Button onClick={openAdd} disabled={bikes.length === 0} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold">
          <Plus size={20} /> Record Service
        </Button>

        {bikes.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <BikeIcon size={40} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Add a motorcycle in the Bike Garage before recording services.</p>
            <Button variant="secondary" className="mt-3" onClick={() => navigate('/bike-garage')}>Open Bike Garage</Button>
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <Wrench size={40} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No service records yet. Log your first workshop visit to keep your bike running sweet.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredRecords.map((r) => (
              <div key={r.id} className="rounded-3xl border border-border bg-card p-4">
                <div className="flex items-start justify-between">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="text-2xl">{TYPE_ICON(r.service_type)}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-bold">{TYPE_LABEL(r.service_type)}</h3>
                        {r.cost_zar != null && <Badge variant="secondary" className="text-[10px]">R{r.cost_zar}</Badge>}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{r.bike_make} {r.bike_model}</p>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(r.id)} className="shrink-0 rounded-lg p-2 text-destructive" aria-label="Delete"><Trash2 size={16} /></button>
                </div>
                {r.description && <p className="mt-2 text-sm text-foreground/90">{r.description}</p>}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(r.service_date).toLocaleDateString('en-ZA')}</span>
                  {r.workshop_name && <span className="flex items-center gap-1"><MapPin size={12} /> {r.workshop_name}</span>}
                  {r.odometer_km != null && <span>{Math.round(r.odometer_km).toLocaleString()} km</span>}
                  {r.next_service_km != null && <span className="font-semibold text-primary">Next: {Math.round((r.odometer_km || 0) + r.next_service_km).toLocaleString()} km</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Record Service</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Motorcycle</Label>
              <select value={form.bike_id} onChange={(e) => setForm({ ...form, bike_id: e.target.value })} className="mt-1 flex h-10 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none">
                <option value="">Select bike...</option>
                {bikes.map((b) => <option key={b.id} value={b.id}>{b.make} {b.model}{b.nickname ? ` "${b.nickname}"` : ''}</option>)}
              </select>
            </div>
            <div>
              <Label>Service type</Label>
              <div className="mt-1 grid grid-cols-2 gap-2">
                {SERVICE_TYPES.map((t) => (
                  <button key={t.value} type="button" onClick={() => setForm({ ...form, service_type: t.value })}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${form.service_type === t.value ? 'border-primary bg-primary/10 font-semibold' : 'border-border'}`}>
                    <span>{t.icon}</span>{t.label}
                  </button>
                ))}
              </div>
            </div>
            <div><Label>Description</Label><Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Oil and filter change, chain adjusted" /></div>
            <div><Label>Workshop</Label><Input value={form.workshop_name} onChange={(e) => setForm({ ...form, workshop_name: e.target.value })} placeholder="KTM Centurion" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Cost (R)</Label><Input type="number" value={form.cost_zar} onChange={(e) => setForm({ ...form, cost_zar: e.target.value })} placeholder="1200" /></div>
              <div><Label>Odometer (km)</Label><Input type="number" value={form.odometer_km} onChange={(e) => setForm({ ...form, odometer_km: e.target.value })} placeholder="15000" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Service date</Label><Input type="date" value={form.service_date} onChange={(e) => setForm({ ...form, service_date: e.target.value })} /></div>
              <div><Label>Next service in (km)</Label><Input type="number" value={form.next_service_km} onChange={(e) => setForm({ ...form, next_service_km: e.target.value })} placeholder="5000" /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending}>
              {createMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : null} Save Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 text-center">
      <p className="text-lg font-black">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}