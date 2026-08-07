import { useState, useEffect } from 'react';
import { Phone, Mail, Globe, MapPin, Clock, FileText, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ProviderEditDialog({ service, onClose, onSaved }) {
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!service) { setForm(null); return; }
    setForm({
      phone: service.phone || '',
      email: service.email || '',
      website: service.website || '',
      address: service.address || '',
      town: service.town || '',
      province: service.province || '',
      opening_hours: service.opening_hours || '',
      is_open_24h: service.is_open_24h || false,
      description: service.description || '',
    });
  }, [service]);

  if (!service || !form) return null;

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.entities.Service.update(service.id, form);
      toast.success('Listing updated');
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error('Failed to update listing');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!service} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Listing — {service.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="flex items-center gap-1"><Phone size={12} /> Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="011 123 4567" />
            </div>
            <div>
              <Label className="flex items-center gap-1"><Mail size={12} /> Email</Label>
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="shop@example.co.za" />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1"><Globe size={12} /> Website</Label>
            <Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://" />
          </div>
          <div>
            <Label className="flex items-center gap-1"><MapPin size={12} /> Street Address</Label>
            <Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main Road" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Town</Label>
              <Input value={form.town} onChange={(e) => set('town', e.target.value)} placeholder="Johannesburg" />
            </div>
            <div>
              <Label>Province</Label>
              <Input value={form.province} onChange={(e) => set('province', e.target.value)} placeholder="Gauteng" />
            </div>
          </div>
          <div>
            <Label className="flex items-center gap-1"><Clock size={12} /> Opening Hours</Label>
            <Input value={form.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} placeholder="Mon–Fri 8:00–17:00" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_open_24h} onChange={(e) => set('is_open_24h', e.target.checked)} />
            Open 24 hours
          </label>
          <div>
            <Label className="flex items-center gap-1"><FileText size={12} /> Description</Label>
            <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} placeholder="What services do you offer?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}