import { useState } from 'react';
import { ChevronLeft, ChevronDown, HelpCircle, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const FAQS = [
  {
    category: 'Navigation',
    icon: '🧭',
    questions: [
      {
        q: 'How do I start navigation to a destination?',
        a: 'Open the Rides tab, search for a destination or pick a saved place, then tap "Go". MotoVeya launches turn-by-turn navigation on the Home map with your route highlighted.',
      },
      {
        q: 'Can I import a destination from a Google Maps link?',
        a: 'Yes. In the Rides tab, tap "Import from Google Maps" and paste a shared Google Maps URL. MotoVeya resolves the coordinates and place name automatically.',
      },
      {
        q: 'Why does the map rotate while I ride?',
        a: 'During navigation the map switches to "heading-up" mode so the direction you are travelling always points up. You can lock portrait orientation in Settings to keep the UI stable while the map rotates.',
      },
      {
        q: 'Does navigation work offline?',
        a: 'MotoVeya requires an internet connection to load map tiles and calculate routes. Cached areas may still display, but turn-by-turn guidance needs connectivity.',
      },
    ],
  },
  {
    category: 'Safety & Emergency',
    icon: '🛡️',
    questions: [
      {
        q: 'How does crash detection work?',
        a: 'MotoVeya uses your phone\'s motion sensors to detect sudden impact and deceleration. When a crash is detected, a 30-second countdown starts. If you do not cancel it, your emergency contacts are notified with your live location.',
      },
      {
        q: 'How do I add an emergency contact?',
        a: 'Go to Profile → Emergency & Safety (or Settings) and add a contact name and phone number. Premium riders also get automatic escalation to emergency services.',
      },
      {
        q: 'What is the SOS button?',
        a: 'The SOS / Distress button on the Home screen lets you manually declare an emergency. It broadcasts your live location to your emergency contacts and, on Premium, to nearby riders.',
      },
    ],
  },
  {
    category: 'Group Rides',
    icon: '👥',
    questions: [
      {
        q: 'How many riders can join a group ride?',
        a: 'Free riders can join group rides. Creating and leading a group ride of up to 32 riders with live voice channels is a Premium feature.',
      },
      {
        q: 'How do voice channels work?',
        a: 'Inside an active group ride, tap the voice panel to join a live voice channel with other riders. Your mic can be muted, and the leader can manage participants.',
      },
      {
        q: 'Can friends see my live location during a group ride?',
        a: 'Only if your privacy settings allow it. You control who sees your location under Profile → Privacy Settings. You can limit sharing to group rides only.',
      },
    ],
  },
  {
    category: 'Subscription & Billing',
    icon: '💳',
    questions: [
      {
        q: 'What is the difference between Free and Premium?',
        a: 'Free includes core navigation, crash detection, fuel calculation, and event access. Premium adds rider-in-distress alerts, automatic emergency services, friends network with live tracking, 32-rider group rides with voice channels, and full ride history statistics.',
      },
      {
        q: 'How much does Premium cost?',
        a: 'Premium is R69.00 per month or R690.00 per year (two months free). A 7-day free trial is available to try every feature before paying.',
      },
      {
        q: 'How do I pay for Premium?',
        a: 'Payments are processed securely through Paystack. Go to Go Premium, choose monthly or annual, and you will be redirected to Paystack checkout. You can pay by card or EFT.',
      },
      {
        q: 'How do I cancel my subscription?',
        a: 'You can cancel anytime from your Paystack dashboard or by contacting support. Your Premium stays active until the end of your current billing period.',
      },
      {
        q: 'Can I restore a previous purchase?',
        a: 'Yes. On the Go Premium screen, tap "Restore Purchases" and MotoVeya will re-activate any valid subscription linked to your account.',
      },
    ],
  },
  {
    category: 'Account & Data',
    icon: '🔐',
    questions: [
      {
        q: 'How do I delete my account?',
        a: 'Go to Profile → Settings → Account and tap "Delete Account". You will be asked to confirm. This permanently removes your data and cannot be undone.',
      },
      {
        q: 'Who can see my riding stats and location?',
        a: 'Only the people you choose. Privacy Settings let you hide your motorcycle, weekly stats, live location, completed rides, and more — from everyone, friends only, or nobody.',
      },
      {
        q: 'How do I add a friend?',
        a: 'Open the Community tab, share your MotoVeya code, or scan a friend\'s QR code. Once they accept your request, you can see each other on the map (subject to privacy settings).',
      },
    ],
  },
];

export default function SupportCenter() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);

  const normalised = query.trim().toLowerCase();
  const filtered = FAQS.map((cat) => ({
    ...cat,
    questions: cat.questions.filter(
      (q) => !normalised || q.q.toLowerCase().includes(normalised) || q.a.toLowerCase().includes(normalised)
    ),
  })).filter((cat) => cat.questions.length > 0);

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Support Center</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-5 flex items-start gap-3 rounded-3xl bg-gradient-to-br from-primary/15 to-transparent p-4">
          <HelpCircle size={28} className="shrink-0 text-primary" />
          <div>
            <h2 className="text-base font-bold">How can we help?</h2>
            <p className="mt-1 text-sm text-muted-foreground">Search frequently asked questions about MotoVeya features, navigation, and subscriptions.</p>
          </div>
        </div>

        <div className="mb-5 flex items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3">
          <Search size={18} className="shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search support articles..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        {filtered.length === 0 ? (
          <div className="rounded-3xl border border-border bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No results for "{query}". Try a different search or contact us.</p>
            <button onClick={() => navigate('/contact')} className="mt-3 text-sm font-bold text-primary">Contact Support →</button>
          </div>
        ) : (
          <div className="space-y-6">
            {filtered.map((cat) => (
              <div key={cat.category}>
                <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  <span>{cat.icon}</span>{cat.category}
                </h3>
                <div className="overflow-hidden rounded-3xl border border-border bg-card">
                  {cat.questions.map((item, i) => {
                    const id = `${cat.category}-${i}`;
                    const open = openId === id;
                    return (
                      <div key={id} className="border-b border-border last:border-b-0">
                        <button
                          onClick={() => setOpenId(open ? null : id)}
                          className="flex w-full items-center gap-3 px-4 py-4 text-left active:bg-secondary"
                        >
                          <span className="flex-1 text-sm font-semibold">{item.q}</span>
                          <ChevronDown size={18} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                        {open && (
                          <p className="px-4 pb-4 text-sm text-muted-foreground">{item.a}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 rounded-3xl bg-secondary p-4 text-center">
          <p className="text-sm font-semibold">Still need help?</p>
          <p className="mt-1 text-xs text-muted-foreground">Our team is here for you.</p>
          <button onClick={() => navigate('/contact')} className="mt-3 min-h-[48px] w-full rounded-2xl bg-primary font-bold text-primary-foreground">Contact Support</button>
        </div>
      </div>
    </div>
  );
}