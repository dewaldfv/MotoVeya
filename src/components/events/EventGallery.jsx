import { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { ImagePlus, Download, X, ChevronLeft, ChevronRight, Trash2, Images } from 'lucide-react';
import { toast } from 'sonner';

const RETENTION_DAYS = 30;

export default function EventGallery({ event, user }) {
  const [photos, setPhotos] = useState([]);
  const [signedUrls, setSignedUrls] = useState({});
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  const eventId = event?.id;
  const eventDate = event?.event_date ? new Date(event.event_date) : null;
  const windowEnd = eventDate ? new Date(eventDate.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000) : null;
  const pastWindow = windowEnd ? windowEnd < new Date() : false;

  const loadPhotos = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const list = await base44.entities.EventPhoto.filter(
        { event_id: eventId, archived: false },
        '-created_date',
        200
      );
      setPhotos(list || []);
      const entries = await Promise.all(
        (list || []).map(async (p) => {
          try {
            const res = await base44.integrations.Core.CreateFileSignedUrl({
              file_uri: p.file_uri,
              expires_in: 3600,
            });
            return [p.id, res.signed_url];
          } catch (e) {
            return [p.id, null];
          }
        })
      );
      setSignedUrls(Object.fromEntries(entries));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadPhotos();
  }, [loadPhotos]);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;
    setUploading(true);
    try {
      for (const file of files) {
        const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
        await base44.entities.EventPhoto.create({
          event_id: eventId,
          file_uri,
          uploader_id: user.id,
          uploader_name: user.full_name || user.nickname || '',
        });
      }
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} added`);
      await loadPhotos();
    } catch (err) {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleDelete = async (photoId) => {
    try {
      await base44.entities.EventPhoto.delete(photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success('Photo removed');
    } catch (e) {
      toast.error('Could not delete photo');
    }
  };

  const downloadPhoto = async (photo) => {
    try {
      const res = await base44.integrations.Core.CreateFileSignedUrl({
        file_uri: photo.file_uri,
        expires_in: 300,
      });
      const a = document.createElement('a');
      a.href = res.signed_url;
      a.download = `motoveya-event-${eventId}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      toast.error('Download failed');
    }
  };

  const closeLightbox = () => setLightbox(null);
  const prevPhoto = () => setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
  const nextPhoto = () => setLightbox((i) => (i === null ? null : (i + 1) % photos.length));

  const canDelete = (p) => user && (user.role === 'admin' || p.uploader_id === user.id);

  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Images size={20} className="text-primary" />
          <h2 className="text-lg font-bold">Photo Gallery</h2>
          {photos.length > 0 && (
            <span className="text-sm text-muted-foreground">· {photos.length}</span>
          )}
        </div>
        {user && !pastWindow && (
          <Button size="sm" disabled={uploading} onClick={() => document.getElementById(`gallery-upload-${eventId}`)?.click()}>
            <ImagePlus size={16} className="mr-1" /> {uploading ? 'Uploading…' : 'Add photos'}
          </Button>
        )}
        <input
          id={`gallery-upload-${eventId}`}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </div>

      {pastWindow && photos.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          Photos from this event have been archived.
        </div>
      ) : loading ? (
        <div className="flex justify-center py-10">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl bg-card p-6 text-center text-sm text-muted-foreground">
          {user ? 'Be the first to share a photo from this event.' : 'No photos yet. Log in to share one.'}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-1.5 md:grid-cols-4 lg:grid-cols-6">
          {photos.map((p, i) => (
            <div key={p.id} className="group relative aspect-square overflow-hidden rounded-xl bg-secondary">
              {signedUrls[p.id] ? (
                <img
                  src={signedUrls[p.id]}
                  alt={p.caption || 'Event photo'}
                  className="h-full w-full cursor-pointer object-cover transition-transform active:scale-95"
                  onClick={() => setLightbox(i)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-secondary border-t-primary" />
                </div>
              )}
              {canDelete(p) && (
                <button
                  onClick={() => handleDelete(p.id)}
                  className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                  aria-label="Delete photo"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {lightbox !== null && photos[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
          onClick={closeLightbox}
        >
          <button
            className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white"
            onClick={closeLightbox}
            aria-label="Close"
          >
            <X size={24} />
          </button>
          {photos.length > 1 && (
            <>
              <button
                className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white"
                onClick={(e) => { e.stopPropagation(); prevPhoto(); }}
                aria-label="Previous"
              >
                <ChevronLeft size={28} />
              </button>
              <button
                className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white"
                onClick={(e) => { e.stopPropagation(); nextPhoto(); }}
                aria-label="Next"
              >
                <ChevronRight size={28} />
              </button>
            </>
          )}
          <div className="relative max-h-[85vh] max-w-[92vw]" onClick={(e) => e.stopPropagation()}>
            {signedUrls[photos[lightbox].id] && (
              <img
                src={signedUrls[photos[lightbox].id]}
                alt={photos[lightbox].caption || 'Event photo'}
                className="max-h-[80vh] max-w-[92vw] rounded-lg object-contain"
              />
            )}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-xs text-white/70">
                {photos[lightbox].uploader_name ? `By ${photos[lightbox].uploader_name}` : ''} · {lightbox + 1}/{photos.length}
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