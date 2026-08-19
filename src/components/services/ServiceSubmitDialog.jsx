import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Drawer, DrawerTrigger, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { ChevronDown, Check, ImagePlus, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import LocationPickerMap from '@/components/LocationPickerMap';
import { SERVICE_CATEGORIES, getServiceCategory } from '@/lib/serviceCategories';

const PRICE_OPTIONS = [
{ value: 'R', label: 'R — Budget' },
{ value: 'RR', label: 'RR — Mid-range' },
{ value: 'RRR', label: 'RRR — Premium' }];


const EMPTY = {
  name: '', category: 'maintenance_repair', description: '',
  address: '', town: '', province: '',
  lat: '', lng: '',
  phone: '', email: '', website: '',
  opening_hours: '', is_open_24h: false,
  price_range: '', service_menu: '', social_links: '',
  submitter_notes: '',
  logo_url: '', photo_urls: []
};

const FOOD_CATEGORIES = [
  { key: 'food_restaurant', label: 'Restaurants', emoji: '🍽️' },
  { key: 'food_pub_bar', label: 'Pubs & Bars', emoji: '🍺' },
  { key: 'food_cafe', label: 'Cafés', emoji: '☕' },
  { key: 'food_fast_food', label: 'Fast Food', emoji: '🍔' },
  { key: 'food_breakfast', label: 'Breakfast Spots', emoji: '🥓' },
  { key: 'food_bakery', label: 'Bakeries', emoji: '🥐' },
  { key: 'food_market', label: 'Food Markets', emoji: '🌮' },
];

export default function ServiceSubmitDialog({ open, onOpenChange, onSubmitted, foodOnly = false }) {
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [categoryDrawerOpen, setCategoryDrawerOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const categoryOptions = foodOnly ? FOOD_CATEGORIES : SERVICE_CATEGORIES;

  useEffect(() => {
    if (open && foodOnly && !form.category.startsWith('food_')) {
      setForm((f) => ({ ...f, category: FOOD_CATEGORIES[0].key }));
    }
  }, [open, foodOnly, form.category]);

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

  const handleLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('logo_url', file_url);
    } catch (err) {
      console.error(err);
      toast.error('Failed to upload logo');
    } finally {
      setUploadingLogo(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async () => {
    if (!form.name) {toast.error('Please enter a business name');return;}
    if (!form.lat || !form.lng) {toast.error('Please set the location on the map');return;}
    setSaving(true);
    try {
      await base44.entities.Service.create({
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || undefined,
        address: form.address.trim() || undefined,
        town: form.town.trim() || undefined,
        province: form.province.trim() || undefined,
        lat: Number(form.lat),
        lng: Number(form.lng),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        website: form.website.trim() || undefined,
        opening_hours: form.opening_hours.trim() || undefined,
        is_open_24h: form.is_open_24h,
        price_range: form.price_range || undefined,
        service_menu: form.service_menu.trim() || undefined,
        social_links: form.social_links.trim() || undefined,
        submitter_notes: form.submitter_notes.trim() || undefined,
        logo_url: form.logo_url || undefined,
        photo_urls: form.photo_urls || [],
        status: 'pending'
      });
      toast.success(`${foodOnly ? 'Food & Drink venue' : 'Service'} submitted! Awaiting admin approval.`);
      onOpenChange(false);
      onSubmitted?.();
      setForm(EMPTY);
    } catch (e) {
      console.error(e);
      toast.error('Failed to submit service');
    } finally {
      setSaving(false);
    }
  };

  const categoryLabel = getServiceCategory(form.category).label;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{foodOnly ? 'Submit a Food & Drink Venue' : 'Submit a Service'}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Business Name *</Label><Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Joe's Bike Workshop" className="min-h-[48px]" /></div>

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
                  {categoryOptions.map((cat) =>
                  <button
                    key={cat.key}
                    onClick={() => {set('category', cat.key);setCategoryDrawerOpen(false);}}
                    className={`flex min-h-[48px] w-full items-center justify-between rounded-xl px-4 text-left ${form.category === cat.key ? 'bg-primary/10 text-primary' : 'hover:bg-secondary'}`}>
                    
                      <span>{cat.emoji} {cat.label}</span>
                      {form.category === cat.key && <Check size={18} className="text-primary" />}
                    </button>
                  )}
                </div>
              </DrawerContent>
            </Drawer>
          </div>

          <div><Label>Description</Label><Textarea value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What do they offer?" rows={3} /></div>

          <div>
            <Label>Location *</Label>
            <LocationPickerMap
              value={form.lat && form.lng ? { lat: Number(form.lat), lng: Number(form.lng) } : null}
              onChange={(lat, lng) => {set('lat', String(lat));set('lng', String(lng));}}
              onImportInfo={(info) => {
                if (info.name && !form.address) set('address', info.address || info.name);
                if (info.town && !form.town) set('town', info.town || '');
              }} />
            
            {form.lat && form.lng ?
            <p className="mt-1 text-xs text-muted-foreground">{Number(form.lat).toFixed(4)}, {Number(form.lng).toFixed(4)}</p> :

            <p className="mt-1 text-xs text-muted-foreground">Import from Google Maps or tap the map to set the location.</p>
            }
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="hidden"><Label className="hidden">Address</Label><Input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main Rd" className="min-h-[48px] hidden" /></div>
            <div className="hidden"><Label>Town</Label><Input value={form.town} onChange={(e) => set('town', e.target.value)} placeholder="Centurion" className="min-h-[48px]" /></div>
          </div>
          <div className="hidden"><Label>Province</Label><Input value={form.province} onChange={(e) => set('province', e.target.value)} placeholder="Gauteng" className="min-h-[48px]" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Phone</Label><Input type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+27 82 123 4567" className="min-h-[48px]" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="info@..." className="min-h-[48px]" /></div>
          </div>
          <div><Label>Website</Label><Input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="https://..." className="min-h-[48px]" /></div>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>Opening Hours</Label><Input value={form.opening_hours} onChange={(e) => set('opening_hours', e.target.value)} placeholder="08:00-17:00" className="min-h-[48px]" /></div>
            <div className="flex items-end gap-2 pb-1">
              <Switch checked={form.is_open_24h} onCheckedChange={(v) => set('is_open_24h', v)} id="open24" />
              <Label htmlFor="open24" className="text-sm">Open 24h</Label>
            </div>
          </div>

          <div>
            <Label>Price Range</Label>
            <Input
              value={form.price_range}
              onChange={(e) => set('price_range', e.target.value)}
              placeholder="e.g. R1500 - R10 000"
              className="min-h-[48px]"
            />
            <p className="mt-1 text-xs text-muted-foreground">Enter a price range (e.g. R1500 - R10 000).</p>
          </div>

          <div><Label>Services Offered</Label><Textarea value={form.service_menu} onChange={(e) => set('service_menu', e.target.value)} placeholder="Oil changes, tyre fitting, chain replacement..." rows={3} /></div>

          <div><Label>Social Media Links</Label><Textarea value={form.social_links} onChange={(e) => set('social_links', e.target.value)} placeholder="Facebook / Instagram / TikTok — one per line" rows={2} /></div>

          <div>
            <Label>Logo (optional)</Label>
            {form.logo_url &&
            <div className="relative mb-2 h-20 w-20 overflow-hidden rounded-lg">
                <img src={form.logo_url} alt="Logo" className="h-full w-full object-cover" />
                <button type="button" onClick={() => set('logo_url', '')} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X size={12} /></button>
              </div>
            }
            <label className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm text-muted-foreground hover:bg-secondary">
              {uploadingLogo ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><ImagePlus size={16} /> Upload Logo</>}
              <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={uploadingLogo} />
            </label>
          </div>

          <div>
            <Label>Photos</Label>
            {form.photo_urls?.length > 0 &&
            <div className="mb-2 flex gap-2 overflow-x-auto no-scrollbar">
                {form.photo_urls.map((url, idx) =>
              <div key={idx} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg">
                    <img src={url} alt="Service" className="h-full w-full object-cover" />
                    <button type="button" onClick={() => handleRemoveImage(idx)} className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white"><X size={12} /></button>
                  </div>
              )}
              </div>
            }
            <label className="flex min-h-[48px] w-full cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-input text-sm text-muted-foreground hover:bg-secondary">
              {uploading ? <><Loader2 size={16} className="animate-spin" /> Uploading...</> : <><ImagePlus size={16} /> Add Photos</>}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
            </label>
          </div>

          <div><Label>Notes for Admin (optional)</Label><Textarea value={form.submitter_notes} onChange={(e) => set('submitter_notes', e.target.value)} placeholder="Anything the admin should know" rows={2} /></div>

          <p className="text-xs text-muted-foreground">Your listing will be reviewed by an admin before appearing in {foodOnly ? 'Food & Drink' : 'Services'}.</p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button disabled={saving} onClick={handleSubmit}>{saving ? 'Submitting...' : foodOnly ? 'Submit Venue' : 'Submit Service'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}