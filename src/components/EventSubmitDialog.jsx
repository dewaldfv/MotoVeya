import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

export default function EventSubmitDialog({ open, onOpenChange, onSubmitted }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', venue_name: '', lat: '', lng: '', contact_phone: '', contact_email: '', booking_link: '', entry_fee_zar: '', category: 'meet' });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.title || !form.event_date || !form.venue_name) { toast.error('Please fill in all required fields'); return; }
    setSaving(true);
    try {
      await base44.entities.Event.create({
        ...form,
        event_date: new Date(form.event_date).toISOString(),
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        entry_fee_zar: form.entry_fee_zar ? Number(form.entry_fee_zar) : 0,
        status: 'pending',
      });
      toast.success('Event submitted! Awaiting admin approval.');
      onOpenChange(false);
      onSubmitted?.();
      setForm({ title: '', description: '', event_date: '', venue_name: '', lat: '', lng: '', contact_phone: '', contact_email: '', booking_link: '', entry_fee_zar: '', category: 'meet' });
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit event');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Submit Event</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Event Title *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Sunday Breakfast Run" className="min-h-[48px]" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Tell riders about your event" rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date & Time *</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className="min-h-[48px]" /></div>
            <div>
              <Label>Category</Label>
              <Select value={form.category} onValueChange={(v) => set('category', v)}>
                <SelectTrigger className="min-h-[48px] w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meet">Meet</SelectItem>
                  <SelectItem value="rally">Rally</SelectItem>
                  <SelectItem value="race">Race</SelectItem>
                  <SelectItem value="charity">Charity</SelectItem>
                  <SelectItem value="track_day">Track Day</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Venue Name *</Label><Input value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)} placeholder="Kyalami Circuit" className="min-h-[48px]" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Latitude</Label><Input type="number" step="any" value={form.lat} onChange={(e) => set('lat', e.target.value)} placeholder="-25.99" className="min-h-[48px]" /></div>
            <div><Label>Longitude</Label><Input type="number" step="any" value={form.lng} onChange={(e) => set('lng', e.target.value)} placeholder="28.07" className="min-h-[48px]" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact Phone</Label><Input type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="+27 82 123 4567" className="min-h-[48px]" /></div>
            <div><Label>Entry Fee (R)</Label><Input type="number" value={form.entry_fee_zar} onChange={(e) => set('entry_fee_zar', e.target.value)} placeholder="150" className="min-h-[48px]" /></div>
          </div>
          <div><Label>Booking Link</Label><Input value={form.booking_link} onChange={(e) => set('booking_link', e.target.value)} placeholder="https://..." className="min-h-[48px]" /></div>
          <p className="text-xs text-muted-foreground">Your event will be reviewed by an admin before appearing on the map.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleSubmit}>{saving ? 'Submitting...' : 'Submit Event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}