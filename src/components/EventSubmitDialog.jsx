import { useState, useEffect } from 'react';
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
import { EVENT_CATEGORIES, getEventMarkerUrl, getEventPosterMarkerUrl } from '@/lib/eventMarkers';

// Event poster automation: upload poster -> create EventSubmission -> backend AI extraction/review.
export default function EventSubmitDialog({ open, onOpenChange, onSubmitted, editEvent = null, onEditClose }) {
  const [saving, setSaving] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingMarker, setUploadingMarker] = useState(false);
  const [customMarker, setCustomMarker] = useState(null);
  const [processingPoster, setProcessingPoster] = useState(false);
  const [posterConfidence, setPosterConfidence] = useState(null);
  const emptyForm = { title: '', description: '', event_date: '', end_date: '', venue_name: '', lat: '', lng: '', contact_phone: '', contact_email: '', booking_link: '', entry_fee_zar: '', category: 'rally', photo_urls: [] };
  const [form, setForm] = useState(emptyForm);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!open) return;
    if (editEvent) {
      const local = (v) => v ? new Date(v).toISOString().slice(0, 16) : '';
      setForm({ ...emptyForm, ...editEvent, event_date: local(editEvent.event_date), end_date: local(editEvent.end_date), lat: editEvent.lat != null ? String(editEvent.lat) : '', lng: editEvent.lng != null ? String(editEvent.lng) : '', entry_fee_zar: editEvent.entry_fee_zar != null ? String(editEvent.entry_fee_zar) : '', photo_urls: editEvent.photo_urls || [] });
      setCustomMarker(editEvent.markerIcon || null);
    } else {
      setForm(emptyForm);
      setCustomMarker(null);
    }
  }, [open, editEvent]);

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

  const handlePosterUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessingPoster(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const result = await base44.functions.invoke('process-event-poster', { image_url: file_url });
      const data = result?.data || result;
      if (!data?.data) throw new Error(data?.error || 'The poster could not be processed');
      const extracted = data.data;
      const toLocalDateTime = (value) => {
        if (!value) return '';
        const d = new Date(value);
        if (Number.isNaN(d.getTime())) return '';
        const pad = (n) => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
      };
      setForm((f) => ({
        ...f,
        title: extracted.title || f.title,
        description: extracted.description || f.description,
        event_date: toLocalDateTime(extracted.event_date) || f.event_date,
        end_date: toLocalDateTime(extracted.end_date) || f.end_date,
        venue_name: extracted.venue_name || f.venue_name,
        lat: extracted.lat != null ? String(extracted.lat) : f.lat,
        lng: extracted.lng != null ? String(extracted.lng) : f.lng,
        contact_phone: extracted.contact_phone || f.contact_phone,
        contact_email: extracted.contact_email || f.contact_email,
        booking_link: extracted.booking_link || f.booking_link,
        entry_fee_zar: extracted.entry_fee_zar != null ? String(extracted.entry_fee_zar) : f.entry_fee_zar,
        category: extracted.category || f.category,
        photo_urls: [file_url, ...(f.photo_urls || []).filter((u) => u !== file_url)],
      }));
      setPosterConfidence({ overall: extracted.confidence_score, location: extracted.location_confidence, status: data.status, missing: extracted.missing_fields || [] });
      toast.success(data.status === 'ready' ? 'Event details extracted and location found.' : 'Event details extracted. Please review the highlighted information.');
    } catch (err) {
      console.error(err);
      toast.error(err?.message || 'Could not read the event poster');
    } finally {
      setProcessingPoster(false);
      e.target.value = '';
    }
  };

  const handleMarkerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMarker(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setCustomMarker(file_url);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload marker');
    } finally {
      setUploadingMarker(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!form.title || !form.event_date || !form.venue_name) { toast.error('Please fill in all required fields'); return; }
    if (form.category === 'rally' && !form.end_date) { toast.error('Rallies span a weekend — please add an end date'); return; }
    if (form.category === 'rally' && form.end_date && new Date(form.end_date) <= new Date(form.event_date)) { toast.error('End date must be after the start date'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        markerIcon: customMarker || getEventPosterMarkerUrl(form.photo_urls?.[0], form.category) || getEventMarkerUrl(form.category),
        event_date: new Date(form.event_date).toISOString(),
        end_date: form.category === 'rally' && form.end_date ? new Date(form.end_date).toISOString() : undefined,
        lat: form.lat ? Number(form.lat) : undefined,
        lng: form.lng ? Number(form.lng) : undefined,
        entry_fee_zar: form.entry_fee_zar ? Number(form.entry_fee_zar) : 0,
      };
      if (editEvent) {
        const isAdmin = (await base44.auth.me())?.role === 'admin';
        if (isAdmin) {
          await base44.entities.Event.update(editEvent.id, { ...payload, status: 'approved' });
          toast.success('Event updated and published');
        } else {
          const me = await base44.auth.me();
          await base44.entities.EventEditRequest.create({ event_id: editEvent.id, submitted_by_id: me.id, change_payload: JSON.stringify(payload), status: 'pending', submitted_at: new Date().toISOString() });
          toast.success('Changes submitted for admin approval');
        }
      } else {
        await base44.entities.Event.create({ ...payload, status: 'pending' });
        toast.success('Event submitted! Awaiting admin approval.');
      }
      onOpenChange(false);
      onEditClose?.();
      onSubmitted?.();
      setCustomMarker(null);
      setForm({ title: '', description: '', event_date: '', end_date: '', venue_name: '', lat: '', lng: '', contact_phone: '', contact_email: '', booking_link: '', entry_fee_zar: '', category: 'rally', photo_urls: [] });
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit event');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = EVENT_CATEGORIES.find((c) => c.value === form.category)?.label || 'Rally';
  const activeMarkerUrl = customMarker || getEventPosterMarkerUrl(form.photo_urls?.[0], form.category) || getEventMarkerUrl(form.category);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editEvent ? 'Edit Event' : 'Submit Event'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
            <div className="mb-2 flex items-center justify-between gap-3">
              <div>
                <Label className="text-base">Upload Event Poster</Label>
                <p className="mt-1 text-xs text-muted-foreground">MotoVeya will read the poster, fill the event details, identify the category and locate the venue.</p>
              </div>
              <label className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-lg bg-primary px-3 text-sm font-semibold text-primary-foreground">
                {processingPoster ? <><Loader2 size={16} className="animate-spin" /> Reading...</> : <><ImagePlus size={16} /> Upload Ad</>}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={handlePosterUpload} disabled={processingPoster} />
              </label>
            </div>
            {posterConfidence && (
              <div className="mt-2 rounded-lg bg-background/70 p-3 text-xs">
                <div className="flex justify-between"><span>Extraction confidence</span><strong>{Math.round((posterConfidence.overall || 0) * 100)}%</strong></div>
                <div className="flex justify-between"><span>Location confidence</span><strong>{Math.round((posterConfidence.location || 0) * 100)}%</strong></div>
                {posterConfidence.missing?.length > 0 && <p className="mt-1 text-amber-600">Still verify: {posterConfidence.missing.join(', ')}</p>}
              </div>
            )}
          </div>
          <div><Label>Event Title *</Label><Input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Sunday Breakfast Run" className="min-h-[48px]" /></div>
          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Tell riders about your event" rows={3} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{form.category === 'rally' ? 'From Date & Time *' : 'Date & Time *'}</Label><Input type="datetime-local" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className="min-h-[48px]" /></div>
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
                    {EVENT_CATEGORIES.map((cat) => (
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
          {form.category === 'rally' && (
            <div><Label>To Date & Time * (rally weekend end)</Label><Input type="datetime-local" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="min-h-[48px]" /></div>
          )}
          <div><Label>Venue Name *</Label><Input value={form.venue_name} onChange={(e) => set('venue_name', e.target.value)} placeholder="Kyalami Circuit" className="min-h-[48px]" /></div>
          <div>
            <Label>Location</Label>
            <LocationPickerMap
              value={form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
              onChange={(lat, lng) => { set('lat', String(lat)); set('lng', String(lng)); }}
              onImportInfo={(info) => { if (!form.venue_name && (info.name || info.address)) set('venue_name', info.name || info.address); }}
            />
            {form.lat && form.lng ? (
              <p className="mt-1 text-xs text-muted-foreground">{Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</p>
            ) : (
              <p className="mt-1 text-xs text-muted-foreground">Import from Google Maps or tap the map to set the location.</p>
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
          <div>
            <Label>Map Marker</Label>
            <div className="mt-2 flex items-center gap-3 rounded-md border border-input p-3">
              <img src={activeMarkerUrl} alt="Marker" className="h-12 w-12 object-contain" />
              <div className="flex-1 text-xs text-muted-foreground">
                {customMarker ? 'Custom marker uploaded' : `Default ${categoryLabel} marker`}
              </div>
              {customMarker && (
                <button type="button" onClick={() => setCustomMarker(null)} className="rounded-full bg-black/70 p-1 text-white">
                  <X size={12} />
                </button>
              )}
            </div>
            <label className="mt-2 flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm text-muted-foreground hover:bg-secondary">
              {uploadingMarker ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><ImagePlus size={16} /> Upload Custom Marker (optional)</>}
              <input type="file" accept="image/*" className="hidden" onChange={handleMarkerUpload} disabled={uploadingMarker} />
            </label>
          </div>
          <p className="text-xs text-muted-foreground">{editEvent ? 'Changes to published events are submitted for admin approval. The currently approved version remains live until approved.' : 'Your event will be reviewed by an admin before appearing on the map.'}</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleSubmit}>{saving ? 'Saving...' : editEvent ? 'Save & Submit Changes' : 'Submit Event'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}