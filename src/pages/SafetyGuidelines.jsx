import { ChevronLeft, Siren, ShieldCheck, AlertTriangle, Bike, Phone, MapPin, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SECTIONS = [
  {
    icon: Siren,
    title: 'Rider Down Response Procedures',
    color: 'text-red-500',
    items: [
      'If MotoVeya triggers a crash alert, a 30-second countdown begins. Tap "I\'m OK" to cancel a false alarm before it escalates.',
      'If the countdown is not cancelled, MotoVeya automatically notifies your emergency contacts with your live GPS location.',
      'Rider Down alerts are visible to all MotoVeya users within 20 km of the incident, regardless of subscription.',
      'Use the Rider Down button on the Home screen to manually alert nearby MotoVeya riders at any time, even without a detected crash.',
      'Keep your phone mounted and charged — crash detection relies on sensor data and will not fire if the device is asleep or dead.',
      'Always confirm your emergency contact is set up under Settings → Emergency & Safety before you ride.',
    ],
  },
  {
    icon: AlertTriangle,
    title: 'Crash Detection Tips',
    color: 'text-orange-500',
    items: [
      'Crash detection uses sudden deceleration and impact sensors. Hard braking on a track or dirt road may trigger a false alert — be ready to cancel.',
      'Mount your phone firmly on the handlebars or tank. A loose mount increases false positives from vibration and drops.',
      'Keep the MotoVeya app in the foreground during a ride for the most reliable sensor readings.',
      'Do not disable crash detection to save battery — the safety net is worth the small power cost.',
      'If you ride off-road frequently, consider raising your sensitivity threshold in Settings to reduce false alarms.',
    ],
  },
  {
    icon: Users,
    title: 'Group Riding Safety',
    color: 'text-primary',
    items: [
      'Hold a pre-ride briefing: confirm the route, fuel stops, rest stops, and the rendezvous point if the group splits.',
      'Ride in staggered formation on open roads — it gives each rider more reaction time and space.',
      'Appoint a lead rider and a sweep (tail-end) rider. MotoVeya group rides let you assign both roles.',
      'Use hand signals or the group voice channel to communicate hazards, stops, and turns.',
      'Keep the rider behind you in your mirrors. If you lose them, slow down and wait — never abandon a rider.',
      'Agree on a regroup policy: large groups should stop at every major turnoff to collect stragglers.',
      'Respect the sweep — the last rider sets the group pace and watches for breakdowns.',
    ],
  },
  {
    icon: Bike,
    title: 'Basic Riding Safety',
    color: 'text-blue-500',
    items: [
      'Wear full protective gear every ride — helmet, jacket, gloves, and boots. ATGATT: All The Gear, All The Time.',
      'Check tyre pressure, chain, oil, and fuel before every ride. A 2-minute check prevents most breakdowns.',
      'Ride within your limits and the conditions. Wet roads, gravel, and night reduce grip and visibility.',
      'Keep a safe following distance — at least two seconds behind the vehicle ahead in dry conditions, more in the wet.',
      'Be visible: ride with headlights on and wear bright or reflective gear, especially at dawn and dusk.',
      'Plan fuel stops before you run dry. MotoVeya Fuel Tracker estimates your range from your bike\'s consumption.',
    ],
  },
  {
    icon: Phone,
    title: 'If You Come Across An Accident',
    color: 'text-purple-500',
    items: [
      'Stop safely and park clear of traffic. Switch on your hazard lights or indicators.',
      'Call 10177 (ambulance) or 112 (mobile emergency) and give your exact location — MotoVeya shows your GPS coordinates on the Home screen.',
      'Do not move an injured rider unless they are in immediate danger from traffic or fire.',
      'Keep the rider warm and calm. Do not remove their helmet unless they are unconscious and not breathing.',
      'Use MotoVeya\'s "Share My Location" to send your live position to emergency contacts and nearby riders.',
    ],
  },
];

export default function SafetyGuidelines() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 p-4 backdrop-blur-lg" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <button onClick={() => navigate(-1)} className="glove-target flex items-center justify-center rounded-full bg-card" aria-label="Back">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-lg font-bold">Safety Guidelines</h1>
      </div>

      <div className="mx-auto max-w-2xl p-4">
        <div className="mb-5 flex items-start gap-3 rounded-3xl bg-gradient-to-br from-primary/15 to-transparent p-4">
          <ShieldCheck size={28} className="shrink-0 text-primary" />
          <div>
            <h2 className="text-base font-bold">Ride safe. Ride together.</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              MotoVeya is built to keep South African riders safer on every journey. Review these guidelines before your next ride so you and your group know exactly what to do in an emergency.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            return (
              <div key={section.title} className="overflow-hidden rounded-3xl border border-border bg-card">
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <Icon size={22} className={section.color} />
                  <h3 className="font-bold">{section.title}</h3>
                </div>
                <ul className="divide-y divide-border">
                  {section.items.map((item, i) => (
                    <li key={i} className="flex gap-3 px-4 py-3 text-sm">
                      <MapPin size={14} className="mt-0.5 shrink-0 text-primary" />
                      <span className="text-foreground/90">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          These guidelines complement, but never replace, the rules of the road and your own judgement. When in doubt, ride defensively.
        </p>
      </div>
    </div>
  );
}