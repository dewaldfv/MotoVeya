import { motion, AnimatePresence } from 'framer-motion';
import { getManeuverIcon, formatDistance } from '@/lib/navigation';

// Large directional arrow pinned to the top third of the navigation view.
// Re-animates (fade + rotate) whenever the upcoming maneuver changes so the
// transition between turns reads as a smooth hand-off rather than a hard snap.
export default function NextTurnArrow({ maneuver, distanceToManeuver }) {
  if (!maneuver) return null;
  const Icon = getManeuverIcon(maneuver);
  const signature = `${maneuver.type || 'turn'}-${maneuver.modifier || 'straight'}`;

  return (
    <div
      className="pointer-events-none absolute left-1/2 z-20 -translate-x-1/2 landscape:max-w-md landscape:w-full"
      style={{ top: 'calc(20% + env(safe-area-inset-top))' }}
    >
      <div className="flex flex-col items-center gap-2">
        <AnimatePresence mode="wait">
          <motion.div
            key={signature}
            initial={{ opacity: 0, scale: 0.5, rotate: -25 }}
            animate={{ opacity: 1, scale: 1, rotate: 0 }}
            exit={{ opacity: 0, scale: 0.5, rotate: 25 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl ring-4 ring-primary/25"
          >
            <Icon size={36} strokeWidth={2.5} />
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