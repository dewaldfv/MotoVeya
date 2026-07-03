import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bike as BikeIcon, Plus, Crown, Phone, LogOut, Route, TrendingUp, Pencil, Trash2, Copy, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import LoginPrompt from '@/components/LoginPrompt';
import { toast } from 'sonner';

const coerceBike = (form) => ({
  ...form,
  year: Number(form.year) || undefined,
  engine_size_cc: Number(form.engine_size_cc) || undefined,
  tank_capacity_l: Number(form.tank_capacity_l) || undefined,
  fuel_consumption_l_per_100km: Number(form.fuel_consumption_l_per_100km) || undefined,
});

export default function Profile() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [bikeDialog, setBikeDialog] = useState(false);
  const [editingBike, setEditingBike] = useState(null);
  const [copied, setCopied] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bikeForm, setBikeForm] = useState({ make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '', color: '', nickname: '', is_primary: false });

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) { setLoading(false); return; }
        const me = await base44.auth.me();
        setUser(me);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const { data: bikes = [], isLoading: bikesLoading } = useQuery({
    queryKey: ['bikes'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      return (await base44.entities.Bike.list('-created_date', 20)) || [];
    },
  });

  const saveBikeMutation = useMutation({
    mutationFn: ({ editing, form }) => {
      const data = coerceBike(form);
      if (editing) return base44.entities.Bike.update(editing.id, data);
      return base44.entities.Bike.create(data);
    },
    onMutate: async ({ editing, form }) => {
      await queryClient.cancelQueries({ queryKey: ['bikes'] });
      const prev = queryClient.getQueryData(['bikes']);
      const data = coerceBike(form);
      queryClient.setQueryData(['bikes'], (old) => {
        const list = old || [];
        if (editing) {
          return list.map((b) => {
            if (b.id !== editing.id) return b;
            const merged = { ...b };
            Object.entries(data).forEach(([k, v]) => { if (v !== undefined) merged[k] = v; });
            return merged;
          });
        }
        return [...list, { ...data, id: 'temp-' + Date.now(), created_date: new Date().toISOString() }];
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['bikes'], ctx.prev); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['bikes'] }); },
  });

  const deleteBikeMutation = useMutation({
    mutationFn: (id) => base44.entities.Bike.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['bikes'] });
      const prev = queryClient.getQueryData(['bikes']);
      queryClient.setQueryData(['bikes'], (old) => (old || []).filter((b) => b.id !== id));
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['bikes'], ctx.prev); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['bikes'] }); },
  });

  const openAddBike = () => { setEditingBike(null); setBikeForm({ make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '', color: '', nickname: '', is_primary: bikes.length === 0 }); setBikeDialog(true); };
  const openEditBike = (bike) => { setEditingBike(bike); setBikeForm({ ...bike, year: bike.year || '', engine_size_cc: bike.engine_size_cc || '', tank_capacity_l: bike.tank_capacity_l || '', fuel_consumption_l_per_100km: bike.fuel_consumption_l_per_100km || '' }); setBikeDialog(true); };

  const handleSaveBike = async () => {
    try {
      await saveBikeMutation.mutateAsync({ editing: editingBike, form: bikeForm });
      setBikeDialog(false);
    } catch (e) { console.error(e); toast.error('Failed to save bike'); }
  };

  const handleDeleteBike = async (id) => { try { await deleteBikeMutation.mutateAsync(id); } catch (e) { console.error(e); } };

  const handleUpgrade = () => navigate('/premium');

  const handleLogout = () => base44.auth.logout('/');

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.entities.User.delete(user.id);
      base44.auth.logout('/');
    } catch (e) {
      console.error(e);
      toast.error('Failed to delete account');
      setDeleting(false);
      setDeleteDialogOpen(false);
    }
  };

  const copyCode = () => { navigator.clipboard.writeText(user.id); setCopied(true); setTimeout(() => setCopied(false), 2000); };

  if (loading || bikesLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt />;

  const isPremium = user.subscription_tier === 'premium';

  return (
    <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-2xl font-black text-primary">
          {user.nickname?.[0]?.toUpperCase() || user.full_name?.[0]?.toUpperCase() || 'R'}
        </div>
        <h1 className="mt-3 text-xl font-bold">{user.nickname || user.full_name}</h1>
        {user.motorcycle_club && <p className="text-sm text-muted-foreground">{user.motorcycle_club}</p>}
        <div className="mt-2 flex items-center gap-2">
          <Badge variant={isPremium ? 'default' : 'secondary'} className={isPremium ? 'bg-primary' : ''}>
            {isPremium ? <><Crown size={12} className="mr-1" /> Premium</> : 'Free Rider'}
          </Badge>
          <Button variant="ghost" size="sm" onClick={copyCode} className="h-7 gap-1 text-xs">
            {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Code'}
          </Button>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-card p-4 text-center">
          <Route size={20} className="mx-auto mb-1 text-primary" />
          <div className="text-2xl font-black">{user.total_rides || 0}</div>
          <div className="text-xs text-muted-foreground">Total Rides</div>
        </div>
        <div className="rounded-2xl bg-card p-4 text-center">
          <TrendingUp size={20} className="mx-auto mb-1 text-primary" />
          <div className="text-2xl font-black">{Math.round(user.total_distance_km || 0)}</div>
          <div className="text-xs text-muted-foreground">Total KM</div>
        </div>
      </div>

      {!isPremium && (
        <div className="mb-4 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-4">
          <div className="flex items-center gap-2"><Crown size={20} className="text-primary" /><h3 className="font-bold">Upgrade to Premium</h3></div>
          <p className="mt-1 text-sm text-muted-foreground">R79.99/month — Rider In Distress, 32-rider groups, friends network, emergency services.</p>
          <Button className="mt-3 min-h-[48px] w-full" onClick={handleUpgrade}>Go Premium — R79.99/mo</Button>
        </div>
      )}

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-bold">My Bikes</h2>
          <Button variant="ghost" size="sm" onClick={openAddBike}><Plus size={16} className="mr-1" /> Add</Button>
        </div>
        {bikes.length === 0 ? (
          <div className="rounded-2xl bg-card p-6 text-center">
            <BikeIcon size={32} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No bikes added yet. Add your motorcycle to track fuel and stats.</p>
            <Button className="mt-3 min-h-[48px]" onClick={openAddBike}><Plus size={18} className="mr-1" /> Add Bike</Button>
          </div>
        ) : (
          <div className="space-y-2 landscape:grid landscape:grid-cols-2 landscape:gap-2 landscape:space-y-0">
            {bikes.map((bike) => (
              <div key={bike.id} className="rounded-2xl bg-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold">{bike.make} {bike.model}</h3>
                      {bike.is_primary && <Badge className="bg-primary text-[10px]">Primary</Badge>}
                    </div>
                    <p className="text-sm text-muted-foreground">{bike.year} · {bike.engine_size_cc || '?'}cc</p>
                    {bike.tank_capacity_l && <p className="text-xs text-muted-foreground">{bike.tank_capacity_l}L tank · {bike.fuel_consumption_l_per_100km}L/100km</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openEditBike(bike)}><Pencil size={14} /></Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => handleDeleteBike(bike.id)}><Trash2 size={14} /></Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4 space-y-2">
        <h2 className="mb-2 font-bold">Emergency Contact</h2>
        <div className="rounded-2xl bg-card p-4">
          {user.emergency_contact_name ? (
            <div className="space-y-1">
              <p className="font-medium">{user.emergency_contact_name}</p>
              {user.emergency_contact_phone && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Phone size={14} /> {user.emergency_contact_phone}</p>}
              {user.medical_notes && <p className="text-xs text-muted-foreground">Medical: {user.medical_notes}</p>}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No emergency contact set. Add one during onboarding or edit your profile.</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Button variant="ghost" className="min-h-[48px] w-full justify-start text-destructive" onClick={handleLogout}>
          <LogOut size={18} className="mr-2" /> Log Out
        </Button>
        <Button variant="ghost" className="min-h-[48px] w-full justify-start text-destructive" onClick={() => setDeleteDialogOpen(true)}>
          <Trash2 size={18} className="mr-2" /> Delete Account
        </Button>
      </div>

      <Dialog open={bikeDialog} onOpenChange={setBikeDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingBike ? 'Edit Bike' : 'Add Bike'}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Make *</Label><Input value={bikeForm.make} onChange={(e) => setBikeForm({ ...bikeForm, make: e.target.value })} placeholder="KTM" /></div>
              <div><Label>Model *</Label><Input value={bikeForm.model} onChange={(e) => setBikeForm({ ...bikeForm, model: e.target.value })} placeholder="390 Adventure" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Year</Label><Input type="number" value={bikeForm.year} onChange={(e) => setBikeForm({ ...bikeForm, year: e.target.value })} placeholder="2024" /></div>
              <div><Label>Engine (cc)</Label><Input type="number" value={bikeForm.engine_size_cc} onChange={(e) => setBikeForm({ ...bikeForm, engine_size_cc: e.target.value })} placeholder="373" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Tank (L)</Label><Input type="number" step="0.1" value={bikeForm.tank_capacity_l} onChange={(e) => setBikeForm({ ...bikeForm, tank_capacity_l: e.target.value })} placeholder="14.5" /></div>
              <div><Label>Consumption (L/100km)</Label><Input type="number" step="0.1" value={bikeForm.fuel_consumption_l_per_100km} onChange={(e) => setBikeForm({ ...bikeForm, fuel_consumption_l_per_100km: e.target.value })} placeholder="3.5" /></div>
            </div>
            <div><Label>Nickname</Label><Input value={bikeForm.nickname} onChange={(e) => setBikeForm({ ...bikeForm, nickname: e.target.value })} placeholder="The Beast" /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={bikeForm.is_primary} onChange={(e) => setBikeForm({ ...bikeForm, is_primary: e.target.checked })} /> Set as primary bike</label>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBikeDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveBike}>{editingBike ? 'Save' : 'Add Bike'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Account?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete your MotoGo account. This action cannot be undone. Your ride history, bikes, and profile data will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteAccount} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting ? 'Deleting...' : 'Delete Account'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}