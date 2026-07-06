import { useState } from 'react';
import { MapPin, Loader2, Link2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

export default function ImportFromGoogleMapsButton({ onImport, className = '' }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleImport = async () => {
    if (!url.trim()) { toast.error('Please paste a Google Maps link'); return; }
    setLoading(true);
    try {
      const res = await base44.functions.invoke('resolve-google-maps-url', { url: url.trim() });
      const data = res.data;
      if (data?.error) { toast.error(data.error); return; }
      if (data?.lat == null || data?.lng == null) { toast.error('Could not extract coordinates from this link.'); return; }
      onImport?.({ lat: data.lat, lng: data.lng, name: data.name, address: data.address });
      toast.success('Location imported from Google Maps');
      setOpen(false);
      setUrl('');
    } catch (e) {
      console.error(e);
      toast.error('Could not import location. Please check the link and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Button type="button" variant="outline" className={`min-h-[48px] w-full ${className}`} onClick={() => setOpen(true)}>
        <MapPin size={16} className="mr-2 text-primary" /> Import from Google Maps
      </Button>
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setUrl(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Import from Google Maps</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Paste a Google Maps share link, dropped pin, or coordinates link. We'll extract the location automatically.
            </p>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/…"
              className="min-h-[48px]"
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) handleImport(); }}
              autoFocus
            />
            <div className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Supported formats:</p>
              <ul className="mt-1 space-y-0.5">
                <li>• Share links (maps.app.goo.gl/…)</li>
                <li>• Dropped pin links</li>
                <li>• Coordinate links (?q=lat,lng)</li>
                <li>• Place links from Android, iPhone &amp; desktop</li>
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleImport} disabled={loading}>
              {loading ? <><Loader2 size={16} className="mr-1 animate-spin" /> Importing…</> : <><Link2 size={16} className="mr-1" /> Import</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}