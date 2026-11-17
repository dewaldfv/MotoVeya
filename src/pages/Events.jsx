import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Calendar, MapPin, Plus, Pencil, Wrench, ChevronRight } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import EventSubmitDialog from '@/components/EventSubmitDialog';
import CalendarExportButton from '@/components/CalendarExportButton';
import PullToRefresh from '@/components/PullToRefresh';
import EventFilters, { matchesDatePreset, matchesEventSearch } from '@/components/events/EventFilters';
import DeletePastEventDialog from '@/components/events/DeletePastEventDialog';
import PremiumUpgradePrompt from '@/components/premium/PremiumUpgradePrompt';
import { canCreateEvents } from '@/lib/plans';
import { formatEventDateRange } from '@/lib/eventDate';

const CATS = ['all', 'rally', 'breakfast_run', 'pub_ride', 'birthday_bash', 'camping', 'track_day', 'charity_ride', 'bike_night', 'scenic_ride', 'day_jol', 'other'];

export default function Events() {
  const queryClient = useQueryClient();
  const [activeCat, setActiveCat] = useState('all');
  const [tab, setTab] = useState('upcoming');
  const [search, setSearch] = useState('');
  const [datePreset, setDatePreset] = useState('all');
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [editEvent, setEditEvent] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      let me = null;
      if (authed) me = await base44.auth.me();
      const events = await base44.entities.Event.filter({ status: 'approved' }, 'event_date', 100);
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const all = events || [];
      const upcoming = all.filter((e) => new Date(e.event_date) >= startOfToday);
      const past = all
        .filter((e) => new Date(e.event_date) < startOfToday)
        .sort((a, b) => new Date(b.event_date) - new Date(a.event_date));
      return { user: me, upcoming, past };
    },
  });

  const user = data?.user ?? null;
  const tabEvents = tab === 'upcoming' ? (data?.upcoming ?? []) : (data?.past ?? []);
  const canEdit = (ev) => !!user && (user.role === 'admin' || (canCreateEvents(user) && ev.created_by_id === user.id));
  const isAdmin = user?.role === 'admin';
  const canSubmitEvents = canCreateEvents(user);
  const canSubmit = !!user;
  const handleSubmitPress = () => {
    if (canSubmitEvents) setSubmitOpen(true);
    else setUpgradeOpen(true);
  };
  const searched = tabEvents.filter(
    (e) => matchesEventSearch(e, search) && matchesDatePreset(e.event_date, datePreset, tab)
  );
  const filtered = activeCat === 'all' ? searched : searched.filter((e) => e.category === activeCat);
  const isNarrowed = search.trim() !== '' || datePreset !== 'all';
  const fmtDate = (ev) => formatEventDateRange(ev);

  const handleRefresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['events'] });
  };

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Events</h1>
          <div className="flex items-center gap-2">
            {filtered.length > 0 && (
              <CalendarExportButton events={filtered} label="Export" variant="secondary" size="default" />
            )}
            {canSubmit && (
              <Button onClick={handleSubmitPress} className="min-h-[48px]">
                <Plus size={18} className="mr-1" /> Submit
              </Button>
            )}
          </div>
        </div>

        <Link
          to="/services"
          className="mb-4 flex items-center gap-3 rounded-2xl bg-primary p-4 text-primary-foreground shadow-lg transition-transform active:scale-[0.99]"
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15">
            <Wrench size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] opacity-70">Services</p>
            <h2 className="text-base font-extrabold leading-tight">Workshops, gear, food &amp; roadside help</h2>
          </div>
          <ChevronRight size={20} className="shrink-0" />
        </Link>

        <div className="mb-3 flex rounded-2xl bg-card p-1">
          <button
            onClick={() => setTab('upcoming')}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${tab === 'upcoming' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Upcoming
          </button>
          <button
            onClick={() => setTab('past')}
            className={`flex-1 rounded-xl py-2 text-sm font-bold transition-colors ${tab === 'past' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
          >
            Past
          </button>
        </div>

        <EventFilters
          search={search}
          onSearchChange={setSearch}
          datePreset={datePreset}
          onDatePresetChange={setDatePreset}
        />

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

        {isLoading ? (
          <div className="flex justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-center">
            <Calendar size={48} className="text-muted-foreground" />
            <p className="text-muted-foreground">
              {isNarrowed ? 'No events match your search and filters.' : `No ${tab} events in this category yet.`}
            </p>
            {isNarrowed && (
              <Button
                variant="secondary"
                onClick={() => { setSearch(''); setDatePreset('all'); setActiveCat('all'); }}
              >
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0">
            {filtered.map((ev) => (
              <div key={ev.id} className="relative overflow-hidden rounded-2xl bg-card">
                <Link to={`/events/${ev.id}`} className="block active:bg-secondary">
                {ev.photo_urls?.[0] && <img src={ev.photo_urls[0]} alt={ev.title} className="h-36 w-full object-cover" />}
                <div className="p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <Badge variant="secondary" className="capitalize">{ev.category?.replace('_', ' ')}</Badge>
                    {ev.entry_fee_zar === 0 && <Badge className="bg-green-600">Free</Badge>}
                  </div>
                  <h3 className="font-bold">{ev.title}</h3>
                  <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><Calendar size={14} /> {fmtDate(ev)}</span>
                    <span className="flex items-center gap-1"><MapPin size={14} /> {ev.venue_name}</span>
                  </div>
                </div>
                </Link>
                {(canEdit(ev) || (isAdmin && tab === 'past')) && (
                  <div className="absolute right-3 top-3 flex flex-col items-end gap-2">
                    {canEdit(ev) && <Button size="sm" variant="secondary" className="shadow-lg" onClick={() => setEditEvent(ev)}><Pencil size={14} className="mr-1" /> Edit</Button>}
                    {isAdmin && tab === 'past' && <DeletePastEventDialog event={ev} onDeleted={handleRefresh} />}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <PremiumUpgradePrompt
          open={upgradeOpen}
          onOpenChange={setUpgradeOpen}
          title="Organizer plan required"
          description="Submitting events is an Organizer feature. The Organizer plan opens event submission, and Organizer+ or Gold add the full Premium Rider features too."
          benefits={['Submit unlimited events', 'Reach every rider on the map', 'Manage the events you own']}
        />

        <EventSubmitDialog open={submitOpen} onOpenChange={setSubmitOpen} onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['events'] })} editEvent={editEvent} onEditClose={() => setEditEvent(null)} />
      </div>
    </PullToRefresh>
  );
}