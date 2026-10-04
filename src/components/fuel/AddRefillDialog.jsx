import { useState, useEffect } from 'react';
import { Fuel, Loader2, ScanLine } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

export default function AddRefillDialog({ open, onClose, bike, onSaved, editRefill = null }) {
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scanConfidence, setScanConfidence] = useState(null);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [form, setForm] = useState({
    litres: '', odometer_km: '', fuel_price_per_litre: '', total_cost: '',
    refill_date: new Date().toISOString().slice(0, 10), location_name: '', is_full_tank: true,
  });

  useEffect(() => {
    if (!open) return;
    if (editRefill) {
      setForm({
        litres: editRefill.litres ?? '',
        odometer_km: editRefill.odometer_km ?? '',
        fuel_price_per_litre: editRefill.fuel_price_per_litre ?? '',
        total_cost: editRefill.total_cost ?? '',
        refill_date: editRefill.refill_date ? new Date(editRefill.refill_date).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
        location_name: editRefill.location_name ?? '',
        is_full_tank: editRefill.is_full_tank !== false,
      });
      setReceiptUrl(editRefill.receipt_url || '');
      setScanConfidence(editRefill.scan_confidence ?? null);
    } else {
      setForm({
        litres: '', odometer_km: '', fuel_price_per_litre: '', total_cost: '',
        refill_date: new Date().toISOString().slice(0, 10), location_name: '', is_full_tank: true,
      });
      setReceiptUrl('');
      setScanConfidence(null);
    }
  }, [open, editRefill]);

  const calculatedTotal = (Number(form.litres) || 0) * (Number(form.fuel_price_per_litre) || 0);
  const displayedTotal = form.total_cost !== '' ? Number(form.total_cost) || 0 : calculatedTotal;
  const updateField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  const handleReceiptScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.functions.invoke('process-fuel-receipt', { image_url: file_url });
      const data = result?.data || result;
      if (!data?.data) throw new Error(data?.error || 'The fuel receipt could not be read');

      const extracted = data.data;
      setReceiptUrl(file_url);
      setScanConfidence(extracted.confidence_score ?? null);
      setForm((current) => ({
        ...current,
        litres: extracted.litres != null ? String(extracted.litres) : current.litres,
        fuel_price_per_litre: extracted.fuel_price_per_litre != null ? String(extracted.fuel_price_per_litre) : current.fuel_price_per_litre,
        total_cost: extracted.total_cost != null ? String(extracted.total_cost) : current.total_cost,
        odometer_km: extracted.odometer_km != null ? String(extracted.odometer_km) : current.odometer_km,
        location_name: extracted.location_name || current.location_name,
        refill_date: extracted.refill_date ? new Date(extracted.refill_date).toISOString().slice(0, 10) : current.refill_date,
      }));

      const confidence = extracted.confidence_score != null ? Math.round(extracted.confidence_score * 100) : null;
      toast.success(confidence != null ? 'Receipt scanned — ' + confidence + '% confidence. Please review before saving.' : 'Receipt scanned. Please review before saving.');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not read the fuel receipt');
    } finally {
      setScanning(false);
      e.target.value = '';
    }
  };

  const handleSave = async () => {
    if (!form.litres || !bike) return;
    setSaving(true);
    const refillData = {
      bike_id: bike.id,
      bike_make: bike.make,
      bike_model: bike.model,
      litres: Number(form.litres),
      odometer_km: form.odometer_km !== '' ? Number(form.odometer_km) : undefined,
      fuel_price_per_litre: form.fuel_price_per_litre !== '' ? Number(form.fuel_price_per_litre) : undefined,
      total_cost: displayedTotal || undefined,
      refill_date: new Date(form.refill_date).toISOString(),
      location_name: form.location_name || undefined,
      is_full_tank: form.is_full_tank,
    };

    try {
      if (editRefill) await base44.entities.FuelRefill.update(editRefill.id, refillData);
      else await base44.entities.FuelRefill.create(refillData);
      try { await base44.functions.invoke('recalculate-fuel-profile', { bike_id: bike.id }); } catch (e) { console.error('Profile recalc failed:', e); }
      toast.success(editRefill ? 'Refill updated' : 'Refill logged');
      onSaved?.();
      onClose();
    } catch (e) {
      console.error(e);
      if (!editRefill && !navigator.onLine) {
        const queue = JSON.parse(localStorage.getItem('motogo_fuel_queue') || '[]');
        queue.push({ ...refillData, queued_at: Date.now() });
        localStorage.setItem('motogo_fuel_queue', JSON.stringify(queue));
        toast.success('Saved offline — will sync when connected');
        onSaved?.();
        onClose();
      } else toast.error(editRefill ? 'Failed to update refill' : 'Failed to log refill');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editRefill ? 'Edit Fuel Refill' : 'Log Fuel Refill'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {!editRefill && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label className="text-base">Scan Fuel Slip</Label>
                  <p className="mt-1 text-xs text-muted-foreground">Take a photo of the receipt or choose one from your gallery. MotoVeya will fill the refill details for you.</p>
                </div>
                <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                  {scanning ? <><Loader2 size={16} className="animate-spin" /> Reading...</> : <><ScanLine size={16} /> Scan</>}
                  <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleReceiptScan} disabled={scanning} />
                </label>
              </div>
              {scanConfidence != null && <p className="mt-2 text-xs text-muted-foreground">OCR confidence: <strong>{Math.round(scanConfidence * 100)}%</strong>. Check the fields before saving.</p>}
            </div>
          )}

          <div className="rounded-xl bg-secondary p-3 text-center text-sm">
            <Fuel size={18} className="mx-auto mb-1 text-primary" />
            {bike?.make} {bike?.model}
          </div>
          <div><Label>Litres Added *</Label><Input type="number" step="0.01" value={form.litres} onChange={(e) => updateField('litres', e.target.value)} placeholder="12.5" /></div>
          <div><Label>Odometer Reading (km)</Label><Input type="number" value={form.odometer_km} onChange={(e) => updateField('odometer_km', e.target.value)} placeholder="15420" /><p className="mt-1 text-xs text-muted-foreground">Enter your bike's total odometer. Used to calculate actual consumption between full refills.</p></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Price/L (R)</Label><Input type="number" step="0.01" value={form.fuel_price_per_litre} onChange={(e) => updateField('fuel_price_per_litre', e.target.value)} placeholder="23.50" /></div>
            <div><Label>Date</Label><Input type="date" value={form.refill_date} onChange={(e) => updateField('refill_date', e.target.value)} /></div>
          </div>
          <div><Label>Total Cost (R)</Label><Input type="number" step="0.01" value={form.total_cost} onChange={(e) => updateField('total_cost', e.target.value)} placeholder={calculatedTotal ? calculatedTotal.toFixed(2) : '293.75'} /></div>
          {displayedTotal > 0 && <div className="rounded-xl bg-primary/10 p-3 text-center"><span className="text-sm text-muted-foreground">Total Cost: </span><span className="font-bold text-primary">R{displayedTotal.toFixed(2)}</span></div>}
          <div><Label>Location (optional)</Label><Input value={form.location_name} onChange={(e) => updateField('location_name', e.target.value)} placeholder="Engen N1" /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_full_tank} onChange={(e) => updateField('is_full_tank', e.target.checked)} />Full tank (recommended for accurate tracking)</label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || !form.litres}>{saving && <Loader2 size={16} className="animate-spin" />}{saving ? 'Saving...' : editRefill ? 'Save Changes' : 'Log Refill'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}