import { motion, AnimatePresence } from 'framer-motion';
import { getManeuverIcon, formatDistance } from '@/lib/navigation';

// Large directional arrow pinned to the top third of the navigation view.
// Re-animates (fade + rotate) whenever the upcoming maneuver changes so the
// transition between turns reads as a smooth hand-off rather than a hard snap.
export default function NextTurnArrow({ maneuver, distanceToManeuver }) {
  if (!maneuver) return null;
  const Icon = getManeuverIcon(maneuver);
  const signature = `${maneuver.type || 'turn'}-${maneuver.modifier || 'straight'}`;
  const urgent = distanceToManeuver != null && distanceToManeuver <= 100;
  const near = distanceToManeuver != null && distanceToManeuver <= 250;
  const size = urgent ? 84 : near ? 74 : 64;

  return (
    <div
      className={`pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 landscape:max-w-md landscape:w-full ${urgent ? 'motoveya-turn--urgent' : ''}`}
      style={{ top: urgent ? 'calc(22% + env(safe-area-inset-top))' : 'calc(19% + env(safe-area-inset-top))' }}
    >
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={signature}
            initial={{ opacity: 0, scale: 0.5, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 25 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="motoveya-turn-beacon flex items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl ring-4 ring-primary/25"
            style={{ width: size, height: size }}
          >
            <Icon size={urgent ? 42 : near ? 38 : 34} strokeWidth={2.5} />
          </motion.div>
        </AnimatePresence>
        {distanceToManeuver != null && (
          <div className="rounded-full bg-card/90 px-3 py-1 text-xs font-bold text-card-foreground shadow-lg backdrop-blur">
            {formatDistance(distanceToManeuver)}
          </div>
        )}
      </div>
    </div>
  );
}