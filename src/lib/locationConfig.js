import { EyeOff, Users, UsersRound, Star, Siren, Clock, Timer, Hourglass, Square } from 'lucide-react';

export const LOCATION_AUDIENCES = [
  { key: 'nobody', label: 'Nobody', desc: 'Your location is never shared', icon: EyeOff },
  { key: 'friends', label: 'Friends', desc: 'All accepted friends can see you', icon: Users },
  { key: 'group_rides', label: 'Group Members During Active Rides', desc: 'Only while riding in the same group ride', icon: UsersRound },
  { key: 'favorite_friends', label: 'Favorite Friends', desc: 'Only friends you mark as favorites', icon: Star },
  { key: 'emergency_contacts', label: 'Emergency Contacts Only', desc: 'Only during an active emergency', icon: Siren },
];

export const POST_RIDE_DURATIONS = [
  { key: 'immediate', label: 'Immediately', desc: 'Stop sharing as soon as the ride ends', ms: 0, icon: Square },
  { key: '15min', label: '15 minutes', desc: 'Keep sharing for 15 minutes after the ride', ms: 15 * 60 * 1000, icon: Timer },
  { key: '1hour', label: '1 hour', desc: 'Keep sharing for 1 hour after the ride', ms: 60 * 60 * 1000, icon: Clock },
  { key: 'until_stopped', label: 'Until manually stopped', desc: 'Keep sharing until you revoke it', ms: -1, icon: Hourglass },
];

export const DEFAULT_GPS_INTERVAL_SEC = 10;
export const FAST_INTERVAL_SEC = 5;
export const SLOW_INTERVAL_SEC = 20;
export const STATIONARY_TIMEOUT_MS = 5 * 60 * 1000;
export const STATIONARY_SPEED_KMH = 2;