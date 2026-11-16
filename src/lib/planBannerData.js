import { PROVIDER_EXCLUDES, PROVIDER_PERKS } from '@/lib/plans';

/** Rider benefits unlocked by the Premium rider tier. */
export const RIDER_HIGHLIGHTS = [
  'GPS Navigation — Unlimited',
  'Emergency Contact Notification — Enhanced alerts',
  'Group Size — 32 riders',
  'Motorcycle Events — View + Discounts',
  'Friends List',
  'Live Rider Tracking',
  'Premium Route Planning',
  'Ride History & Statistics',
];

/** What the Premium Rider tier deliberately leaves out — publishing. */
const RIDER_EXCLUDES = [
  'Add your own events — Organizer plan',
  'Add service listings — Provider plan',
];

/** Organizer benefits. */
export const ORGANIZER_PERKS = [
  'Submit and organise your own events',
  'Your events shown on the rider map',
  'Motorcycle Events — View + Discounts',
];

/** Feature bullets shown inside each plan banner. */
export const PLAN_BANNER_FEATURES = {
  premium: RIDER_HIGHLIGHTS,
  provider: PROVIDER_PERKS,
  provider_plus: [PROVIDER_PERKS[0], PROVIDER_PERKS[1], PROVIDER_PERKS[3], 'GPS Navigation — Unlimited', 'Live Rider Tracking', 'Ride History & Statistics'],
  organizer: ORGANIZER_PERKS,
  organizer_plus: [...ORGANIZER_PERKS, 'GPS Navigation — Unlimited', 'Group Size — 32 riders', 'Premium Route Planning'],
  gold: [
    'GPS Navigation — Unlimited',
    'Group Size — 32 riders',
    'Live Rider Tracking',
    'Premium Route Planning',
    'Organise and promote your own events',
    PROVIDER_PERKS[0],
    PROVIDER_PERKS[2],
  ],
};

/** What a plan deliberately leaves out, shown muted in its banner. */
export const PLAN_BANNER_EXCLUDES = {
  premium: RIDER_EXCLUDES,
  organizer: ['Add service listings — Provider plan'],
  provider: [...PROVIDER_EXCLUDES, 'Add your own events — Organizer plan'],
};