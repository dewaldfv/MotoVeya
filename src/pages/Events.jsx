import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, MapPin, Plus, Filter } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EventSubmitDialog from '@/components/EventSubmitDialog';

const CATS = ['all', 'race', 'rally', 'meet', 'charity', 'track_day', 'other'];

export default function Events() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [user, setUser] = useState(null);
  const [submitOpen, setSubmitOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (authed) { const me = await base44.auth.me(); setUser(me); }
        const data = await base44.entities.Event.filter({ status: 'approved' }, 'event_date', 50);
        setEvents(data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const canSubmit = user && (user.role === 'organizer' || user.role === 'admin');
  const filtered = activeCat === 'all' ? events : events.filter((e) => e.category === activeCat);

  const fmtDate = (d) => new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });

  return (
    <div className="min-h-screen bg-background p-4 pb-24">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Events</h1>
        {canSubmit && (
          <Button onClick={() => setSubmitOpen(true)} className="min-h-[48px]">
            <Plus size={18} className="mr-1" /> Submit
          </Button>
        )}
      </div>

      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {CATS.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCat(cat)}
            className={`min-h-[44px] whitespace-nowrap rounded-full px-4 text-sm font-semibold capitalize transition-colors ${
              activeCat === cat ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground'
            }`}
          >
            {cat.replace('_', ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-20 text-center">
          <Calendar size={48} className="text-muted-foreground" />
          <p className="text-muted-foreground">No events in this category yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => (
            <Link key={ev.id} to={`/events/${ev.id}`} className="block overflow-hidden rounded-2xl bg-card active:bg-secondary">
              {ev.photo_urls?.[0] && <img src={ev.photo_urls[0]} alt={ev.title} className="h-36 w-full object-cover" />}
              <div className="p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="secondary" className="capitalize">{ev.category?.replace('_', ' ')}</Badge>
                  {ev.entry_fee_zar === 0 && <Badge className="bg-green-600">Free</Badge>}
                </div>
                <h3 className="font-bold">{ev.title}</h3>
                <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar size={14} /> {fmtDate(ev.event_date)}</span>
                  <span className="flex items-center gap-1"><MapPin size={14} /> {ev.venue_name}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <EventSubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} onSubmitted={() => {}} />
    </div>
  );
}