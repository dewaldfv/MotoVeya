import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ChevronDown, Check, ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LocationPickerMap from '@/components/LocationPickerMap';

const CATEGORIES = [
  { value: 'meet', label: 'Meet' },
  { value: 'rally', label: 'Rally' },
  { value: 'race', label: 'Race' },
  { value: 'charity', label: 'Charity' },
  { value: 'track_day', label: 'Track Day' },
  { value: 'other', label: 'Other' },
];

export default function EventSubmitDialog({ open, onOpenChange, onSubmitted }) {
  const [saving, setSaving] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', event_date: '', venue_name: '', lat: '', lng: '', contact_phone: '', contact_email: '', booking_link: '', entry_fee_zar: '', category: 'meet', photo_urls: [] });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_urls: [...(f.photo_urls || []), file_url] }));
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemoveImage = (idx) => {
    setForm((f) => ({ ...f, photo_urls: f.photo_urls.filter((_, i) => i !== idx) }));
  };

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
      setForm({ title: '', description: '', event_date: '', venue_name: '', lat: '', lng: '', contact_phone: '', contact_email: '', booking_link: '', entry_fee_zar: '', category: 'meet', photo_urls: [] });
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit event');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = CATEGORIES.find((c) => c.value === form.category)?.label || 'Meet';

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
              <Drawer open={categoryDrawerOpen} onOpenChange={setCategoryDrawerOpen}>
                <DrawerTrigger asChild>
                  <button type="button" className="flex min-h-[48px] w-full items-center justify-between rounded-md border border-input bg-background px-3 text-sm">
                    <span>{categoryLabel}</span>
                    <ChevronDown size={16} className="text-muted-foreground" />
                  </button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader><DrawerTitle>Select Category</DrawerTitle></DrawerHeader>
                  <div className="p-4 pb-8">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.value}
                        onClick={() => { set('category', cat.value); setCategoryDrawerOpen(false); }}
                        className={`flex min-h-[48px] w-full items-center justify-between rounded-xl px-4 text-left ${form.category === cat.value ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}
                      >
                        <span>{cat.label}</span>
                        {form.category === cat.value && <Check size={18} className="text-primary" />}
                      </button>
                    ))}
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          </div>
          <div><Label>Venue Name *</Label><Input value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)} placeholder="Kyalami Circuit" className="min-h-[48px]" /></div>
          <div>
            <Label>Location</Label>
            <LocationPickerMap
              value={form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
              onChange={(lat, lng) => { set('lat', String(lat)); set('lng', String(lng)); }}
            />
            {form.lat && form.lng ? (
              <p className="mt-1 text-xs text-muted-foreground">{Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Tap the map to set the event location.</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Contact Phone</Label><Input type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} placeholder="+27 82 123 4567" className="min-h-[48px]" /></div>
            <div><Label>Entry Fee (R)</Label><Input type="number" value={form.entry_fee_zar} onChange={(e) => set('entry_fee_zar', e.target.value)} placeholder="150" className="min-h-[48px]" /></div>
          </div>
          <div><Label>Booking Link</Label><Input value={form.booking_link} onChange={(e) => set('booking_link', e.target.value)} placeholder="https://..." className="min-h-[48px]" /></div>
          <div>
            <Label>Event Image</Label>
            {form.photo_urls?.length > 0 && (
              <div className="mb-2 flex gap-2">
                {form.photo_urls.map((url, idx) => (
                  <div key={idx} className="relative h-20 w-20 overflow-hidden rounded-lg">
                    <img src={url} alt="Event" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white">
                      <X size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <label className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm text-muted-foreground hover:bg-secondary">
              {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><ImagePlus size={16} /> Upload Image</>}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>
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