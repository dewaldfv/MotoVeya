import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Download, Images, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

export default function ArchivedEventPhotos() {
  const [photos, setPhotos] = useState([]);
  const [events, setEvents] = useState({});
  const [signedUrls, setSignedUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [lightbox, setLightbox] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const list = await base44.entities.EventPhoto.filter({ archived: true }, '-created_date', 200);
      setPhotos(list || []);
      const eventIds = [...new Set((list || []).map((p) => p.event_id))];
      const evMap = {};
      for (const eid of eventIds) {
        try {
          const ev = await base44.entities.Event.get(eid);
          if (ev) evMap[eid] = ev;
        } catch (e) { /* ignore */ }
      }
      setEvents(evMap);
      const entries = await Promise.all(
        (list || []).map(async (p) => {
          try {
            const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: p.file_uri, expires_in: 3600 });
            return [p.id, res.signed_url];
          } catch (e) { return [p.id, null]; }
        })
      );
      setSignedUrls(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const downloadPhoto = async (photo) => {
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: photo.file_uri, expires_in: 300 });
      const a = document.createElement('a');
      a.href = res.signed_url;
      a.download = `archived-${photo.event_id}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error('Download failed');
    }
  };

  if (loading) return <div className="flex justify-center py-10"><div className="h-6 w-6 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (photos.length === 0) return <p className="py-8 text-center text-muted-foreground">No archived photos.</p>;

  const closeLightbox = () => setLightbox(null);
  const prevPhoto = () => setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  const nextPhoto = () => setLightbox((i) => (i === null ? null : (i + 1) % photos.length));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Images size={18} className="text-primary" />
        <h2 className="font-bold">Archived Event Photos</h2>
        <span className="text-sm text-muted-foreground">· {photos.length}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 lg:grid-cols-6">
        {photos.map((p, i) => {
          const ev = events[p.event_id];
          return (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              {signedUrls[p.id] ? (
                <img src={signedUrls[p.id]} alt="archived" className="h-full w-full cursor-pointer object-cover" onClick={() => setLightbox(i)} />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-muted-foreground">…</div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5">
                <p className="truncate text-[10px] text-white">{ev?.title || 'Event'}</p>
              </div>
            </div>
          );
        })}
      </div>

      {lightbox !== null && photos[lightbox] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90" onClick={closeLightbox}>
          <button className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white" onClick={closeLightbox} aria-label="Close"><X size={24} /></button>
          {photos.length > 1 && (
            <>
              <button className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white" onClick={(e) => { e.stopPropagation(); prevPhoto(); }} aria-label="Previous"><ChevronLeft size={28} /></button>
              <button className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white" onClick={(e) => { e.stopPropagation(); nextPhoto(); }} aria-label="Next"><ChevronRight size={28} /></button>
            </>
          )}
          <div className="relative max-h-[85vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            {signedUrls[photos[lightbox].id] && (
              <img src={signedUrls[photos[lightbox].id]} alt="archived" className="max-h-[80vh] max-w-[92vw] rounded-lg object-contain" />
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-white/70">
                {events[photos[lightbox].event_id]?.title || 'Event'} · {photos[lightbox].uploader_name || 'Unknown'}
              </span>
              <Button size="sm" variant="secondary" onClick={() => downloadPhoto(photos[lightbox])}>
                <Download size={16} className="mr-1" /> Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}