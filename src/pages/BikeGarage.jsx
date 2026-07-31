import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Plus, Pencil, Trash2, Bike as BikeIcon, Camera, Loader2, Star, Fuel } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginPrompt from '@/components/LoginPrompt';
import { toast } from 'sonner';

const EMPTY = { make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '', color: '', nickname: '', is_primary: false, photo_url: '' };

const num = (v) => (v === '' ? undefined : Number(v));

export default function BikeGarage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  useEffect(() => {
    (async () => {
      try {
        const ok = await base44.auth.isAuthenticated();
        if (ok) setUser(await base44.auth.me());
      } catch (e) { /* ignore */ }
      setLoading(false);
    })();
  }, []);

  const { data: bikes = [] } = useQuery({
    queryKey: ['bikes', user?.id],
    queryFn: () => base44.entities.Bike.filter({}, '-created_date', 50),
    enabled: !!user?.id,
  });

  const { data: refills = [] } = useQuery({
    queryKey: ['garage-refills', user?.id],
    queryFn: () => base44.entities.FuelRefill.filter({}, '-refill_date', 200),
    enabled: !!user?.id,
  });

  const saveMutation = useMutation({
    mutationFn: ({ editing, data }) => editing ? base44.entities.Bike.update(editing.id, data) : base44.entities.Bike.create(data),
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['bikes'] }); queryClient.invalidateQueries({ queryKey: ['profile-rides'] }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Bike.delete(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bikes'] }),
  });

  const primaryMutation = useMutation({
    mutationFn: async ({ id, make }) => {
      await Promise.all(bikes.filter(b => b.id !== id).map(b => base44.entities.Bike.update(b.id, { is_primary: false })));
      return base44.entities.Bike.update(id, { is_primary: make });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['bikes'] }),
  });

  const openAdd = () => { setEditing(null); setForm({ ...EMPTY, is_primary: bikes.length === 0 }); setDialog(true); };
  const openEdit = (bike) => {
    setEditing(bike);
    setForm({ ...bike, year: bike.year || '', engine_size_cc: bike.engine_size_cc || '', tank_capacity_l: bike.tank_capacity_l || '', fuel_consumption_l_per_100km: bike.fuel_consumption_l_per_100km || '', photo_url: bike.photo_url || '' });
    setDialog(true);
  };

  const handlePhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_url: file_url }));
      toast.success('Photo uploaded');
    } catch (err) { console.error(err); toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleSave = async () => {
    if (!form.make.trim() || !form.model.trim()) { toast.error('Make and model are required'); return; }
    const data = {
      ...form,
      year: num(form.year),
      engine_size_cc: num(form.engine_size_cc),
      tank_capacity_l: num(form.tank_capacity_l),
      fuel_consumption_l_per_100km: num(form.fuel_consumption_l_per_100km),
    };
    try {
      await saveMutation.mutateAsync({ editing, data });
      setDialog(false);
      toast.success(editing ? 'Bike updated' : 'Bike added');
    } catch (err) { console.error(err); toast.error('Could not save bike'); }
  };

  const handleDelete = async (bike) => {
    if (!confirm(`Delete ${bike.make} ${bike.model}?`)) return;
    try { await deleteMutation.mutateAsync(bike.id); toast.success('Bike removed'); }
    catch (e) { toast.error('Could not delete'); }
  };

  const setPrimary = (bike) => primaryMutation.mutate({ id: bike.id, make: true });

  const totalLitres = refills.reduce((s, r) => s + (r.litres || 0), 0);
  const totalDist = refills.reduce((s, r) => s + (r.trip_distance_km || 0), 0);
  const avgConsumption = totalDist > 0 ? (totalLitres / totalDist * 100).toFixed(1) : null;

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt />;

  return (
    <div className="min-h-screen bg-background pb-28" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Bike Garage</h1>
      </div>

      <div className="mx-auto max-w-2xl space-y-4 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Bikes" value={bikes.length} />
          <Stat label="Total Fuel" value={`${Math.round(totalLitres)}L`} />
          <Stat label="Avg L/100km" value={avgConsumption || '—'} />
        </div>

        <Button onClick={openAdd} className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold">
          <Plus size={20} /> Add Motorcycle
        </Button>

        {bikes.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <BikeIcon size={40} className="mx-auto text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">No bikes in your garage yet. Add your first motorcycle to start tracking.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bikes.map((bike) => (
              <div key={bike.id} className="overflow-hidden rounded-3xl border border-border bg-card">
                {bike.photo_url ? (
                  <div className="h-40 w-full overflow-hidden bg-muted">
                    <img src={bike.photo_url} alt={`${bike.make} ${bike.model}`} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="flex h-24 w-full items-center justify-center bg-muted">
                    <BikeIcon size={36} className="text-muted-foreground" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate font-bold">{bike.make} {bike.model}</h3>
                        {bike.is_primary && <Badge className="bg-primary text-[10px]">Primary</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{bike.year || '—'} · {bike.engine_size_cc || '?'}cc</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEdit(bike)}><Pencil size={16} /></Button>
                      <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleDelete(bike)}><Trash2 size={16} /></Button>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div className="rounded-xl bg-secondary p-2"><Fuel size={12} className="mr-1 inline text-primary" />{bike.tank_capacity_l || '?'}L tank</div>
                    <div className="rounded-xl bg-secondary p-2"><Fuel size={12} className="mr-1 inline text-primary" />{bike.fuel_consumption_l_per_100km || avgConsumption || '?'}L/100km</div>
                  </div>
                  {bike.nickname && <p className="mt-2 text-xs font-medium text-primary">"{bike.nickname}"</p>}
                  {!bike.is_primary && (
                    <button onClick={() => setPrimary(bike)} className="mt-3 flex items-center gap-1 text-xs font-semibold text-primary"><Star size={12} /> Set as primary</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit Motorcycle' : 'Add Motorcycle'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <button onClick={() => fileRef.current?.click()} className="flex h-32 w-full items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-border bg-muted">
              {form.photo_url ? <img src={form.photo_url} alt="bike" className="h-full w-full object-cover" /> : (
                <div className="flex flex-col items-center gap-1 text-muted-foreground">
                  <Camera size={24} />
                  <span className="text-xs">{uploading ? 'Uploading...' : 'Add bike photo'}</span>
                </div>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </button>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make *</Label><Input value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} placeholder="KTM" /></div>
              <div><Label>Model *</Label><Input value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} placeholder="390 Adventure" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Year</Label><Input type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} placeholder="2024" /></div>
              <div><Label>Engine (cc)</Label><Input type="number" value={form.engine_size_cc} onChange={(e) => setForm({ ...form, engine_size_cc: e.target.value })} placeholder="373" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tank (L)</Label><Input type="number" step="0.1" value={form.tank_capacity_l} onChange={(e) => setForm({ ...form, tank_capacity_l: e.target.value })} placeholder="14.5" /></div>
              <div><Label>Consumption (L/100km)</Label><Input type="number" step="0.1" value={form.fuel_consumption_l_per_100km} onChange={(e) => setForm({ ...form, fuel_consumption_l_per_100km: e.target.value })} placeholder="3.5" /></div>
            </div>
            <div><Label>Colour</Label><Input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} placeholder="Orange" /></div>
            <div><Label>Nickname</Label><Input value={form.nickname} onChange={(e) => setForm({ ...form, nickname: e.target.value })} placeholder="The Beast" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_primary} onChange={(e) => setForm({ ...form, is_primary: e.target.checked })} /> Set as primary bike</label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending || uploading}>
              {saveMutation.isPending ? <Loader2 size={16} className="mr-2 animate-spin" /> : null}{editing ? 'Save' : 'Add Motorcycle'}
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