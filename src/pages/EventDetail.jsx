import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Calendar, MapPin, Phone, Mail, ExternalLink, Navigation, Tag, Bookmark } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import CalendarExportButton from '@/components/CalendarExportButton';

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setEvent(await base44.entities.Event.get(id)); }
      catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [id]);

  if (loading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!event) return <div className="flex h-screen flex-col items-center justify-center gap-4"><p className="text-muted-foreground">Event not found</p><button onClick={() => navigate('/events')} className="text-primary">Back to events</button></div>;

  const date = new Date(event.event_date).toLocaleString('en-ZA', { dateStyle: 'full', timeStyle: 'short' });

  return (
    <div className="min-h-screen bg-background pb-24">
      {event.photo_urls?.[0] ? (
        <div className="relative h-56 w-full">
          <img src={event.photo_urls[0]} alt={event.title} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
          <div className="absolute left-4 z-10" style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}>
            <button onClick={() => navigate('/events')} className="glove-target flex items-center justify-center rounded-full bg-card/95 backdrop-blur-lg">
              <ChevronLeft size={24} />
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
          <button onClick={() => navigate('/events')} className="glove-target flex items-center gap-2 text-muted-foreground">
            <ChevronLeft size={24} /> Back
          </button>
        </div>
      )}

      <div className="p-4">
        <div className="mb-2 flex items-center gap-2">
          <Badge variant="secondary" className="capitalize">{event.category?.replace('_', ' ')}</Badge>
          {event.entry_fee_zar === 0 && <Badge className="bg-green-600">Free Entry</Badge>}
        </div>
        <h1 className="text-2xl font-bold">{event.title}</h1>
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><Calendar size={16} /> {date}</div>
        <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground"><MapPin size={16} /> {event.venue_name}</div>

        {event.description && <p className="mt-4 text-sm text-muted-foreground">{event.description}</p>}

        <div className="mt-4 space-y-2">
          {event.contact_phone && <div className="flex items-center gap-2 text-sm"><Phone size={16} className="text-primary" /> {event.contact_phone}</div>}
          {event.contact_email && <div className="flex items-center gap-2 text-sm"><Mail size={16} className="text-primary" /> {event.contact_email}</div>}
          {event.entry_fee_zar > 0 && <div className="flex items-center gap-2 text-sm"><Tag size={16} className="text-primary" /> R{event.entry_fee_zar} entry fee</div>}
        </div>

        <div className="mt-6 flex gap-2">
          <Button size="lg" variant="secondary" className="min-h-[56px] px-5" onClick={() => toast.success('Event saved to favourites')}>
            <Bookmark size={18} className="mr-2" /> Save
          </Button>
          <Button size="lg" className="min-h-[56px] flex-1 text-base" onClick={() => navigate('/ride/active', { state: { destination: { lat: event.lat, lng: event.lng, name: event.venue_name } } })}>
            <Navigation size={18} className="mr-2" /> Navigate
          </Button>
          {event.booking_link && (
            <Button size="lg" variant="secondary" className="min-h-[56px] px-5" onClick={() => window.open(event.booking_link, '_blank')}>
              <ExternalLink size={18} />
            </Button>
          )}
        </div>
        <div className="mt-2">
          <CalendarExportButton event={event} className="w-full" />
        </div>
      </div>
    </div>
  );
}