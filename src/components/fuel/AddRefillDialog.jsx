import { useState, useEffect } from 'react';
import { Fuel, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function AddRefillDialog({ open, onClose, bike, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    litres: '', odometer_km: '', fuel_price_per_litre: '',
    refill_date: new Date().toISOString().slice(0, 10), location_name: '', is_full_tank: true,
  });

  useEffect(() => {
    if (open) {
      setForm({
        litres: '', odometer_km: '', fuel_price_per_litre: '',
        refill_date: new Date().toISOString().slice(0, 10), location_name: '', is_full_tank: true,
      });
    }
  }, [open]);

  const totalCost = (Number(form.litres) || 0) * (Number(form.fuel_price_per_litre) || 0);

  const handleSave = async () => {
    if (!form.litres || !bike) return;
    setSaving(true);
    const refillData = {
      bike_id: bike.id, bike_make: bike.make, bike_model: bike.model,
      litres: Number(form.litres),
      odometer_km: form.odometer_km ? Number(form.odometer_km) : undefined,
      fuel_price_per_litre: form.fuel_price_per_litre ? Number(form.fuel_price_per_litre) : undefined,
      total_cost: totalCost || undefined,
      refill_date: new Date(form.refill_date).toISOString(),
      location_name: form.location_name || undefined,
      is_full_tank: form.is_full_tank,
    };
    try {
      await base44.entities.FuelRefill.create(refillData);
      try { await base44.functions.invoke('recalculate-fuel-profile', { bike_id: bike.id }); } catch (e) { console.error('Profile recalc failed:', e); }
      toast.success('Refill logged');
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      if (!navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('motogo_fuel_queue') || '[]');
        queue.push({ ...refillData, queued_at: Date.now() });
        localStorage.setItem('motogo_fuel_queue', JSON.stringify(queue));
        toast.success('Saved offline — will sync when connected');
        onSaved?.();
        onClose();
      } else {
        toast.error('Failed to log refill');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Log Fuel Refill</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl bg-secondary p-3 text-center text-sm">
            <Fuel size={18} className="mx-auto mb-1 text-primary" />
            {bike?.make} {bike?.model}
          </div>
          <div>
            <Label>Litres Added *</Label>
            <Input type="number" step="0.01" value={form.litres} onChange={(e) => setForm({ ...form, litres: e.target.value })} placeholder="12.5" />
          </div>
          <div>
            <Label>Odometer Reading (km)</Label>
            <Input type="number" value={form.odometer_km} onChange={(e) => setForm({ ...form, odometer_km: e.target.value })} placeholder="15420" />
            <p className="mt-1 text-xs text-muted-foreground">Enter your bike's total odometer. Used to calculate actual consumption between full refills.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Price/L (R)</Label>
              <Input type="number" step="0.01" value={form.fuel_price_per_litre} onChange={(e) => setForm({ ...form, fuel_price_per_litre: e.target.value })} placeholder="23.50" />
            </div>
            <div>
              <Label>Date</Label>
              <Input type="date" value={form.refill_date} onChange={(e) => setForm({ ...form, refill_date: e.target.value })} />
            </div>
          </div>
          {totalCost > 0 && (
            <div className="rounded-xl bg-primary/10 p-3 text-center">
              <span className="text-sm text-muted-foreground">Total Cost: </span>
              <span className="font-bold text-primary">R{totalCost.toFixed(2)}</span>
            </div>
          )}
          <div>
            <Label>Location (optional)</Label>
            <Input value={form.location_name} onChange={(e) => setForm({ ...form, location_name: e.target.value })} placeholder="Engen N1" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_full_tank} onChange={(e) => setForm({ ...form, is_full_tank: e.target.checked })} />
            Full tank (recommended for accurate tracking)
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.litres}>
            {saving && <Loader2 size={16} className="animate-spin" />}
            {saving ? 'Saving...' : 'Log Refill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}