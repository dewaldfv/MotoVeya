import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Calendar, MapPin, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { formatEventDateRange } from '@/lib/eventDate';

export default function RidesEventsCard() {
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['rides-approved-events'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return [];
      const all = await base44.entities.Event.filter({ status: 'approved' }, 'event_date', 50);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      return (all || []).filter((e) => new Date(e.event_date) >= startOfToday);
    }
  });

  if (isLoading) {
    return (
      <div className="rounded-3xl border border-border bg-card p-4">
        <p className="text-base font-bold text-foreground">Upcoming Events</p>
        <div className="mt-3 h-20 animate-pulse rounded-2xl bg-secondary" />
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div className="rounded-3xl border border-border bg-card p-4">
      <Link to="/events" className="mb-3 flex items-center justify-between">
        <p className="text-base font-bold text-foreground">Upcoming Events</p>
        <ChevronRight className="text-muted-foreground" size={20} />
      </Link>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-1">
        {events.slice(0, 8).map((ev) => (
          <Link
            key={ev.id}
            to={`/events/${ev.id}`}
            className="w-56 shrink-0 overflow-hidden rounded-2xl bg-secondary/60 active:scale-[0.99] transition-transform"
          >
            {ev.photo_urls?.[0] ? (
              <img src={ev.photo_urls[0]} alt={ev.title} className="h-24 w-full object-cover" />
            ) : (
              <div className="flex h-24 w-full items-center justify-center bg-primary/10">
                <Calendar size={28} className="text-primary" />
              </div>
            )}
            <div className="p-3">
              <Badge variant="secondary" className="mb-1 capitalize">{ev.category?.replace('_', ' ') || 'event'}</Badge>
              <h4 className="line-clamp-1 font-bold text-foreground">{ev.title}</h4>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar size={12} /> <span className="line-clamp-1">{formatEventDateRange(ev)}</span>
              </div>
              {ev.venue_name && (
                <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={12} /> <span className="line-clamp-1">{ev.venue_name}</span>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}