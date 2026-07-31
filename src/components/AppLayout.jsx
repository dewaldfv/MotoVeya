import { useState, useEffect } from 'react';
import { useOutlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from './BottomNav';
import { useLocationBroadcast } from '@/hooks/useLocationBroadcast';
import RideResumeBanner from './RideResumeBanner';
import VoiceChannelProvider from './voice/VoiceChannelProvider';
import NotificationPopUp from './NotificationPopUp';
import { getActiveRide } from '@/lib/rideCache';
import { subscribeRideActive } from '@/lib/rideStatus';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';

const pageVariants = {
  initial: { opacity: 0, x: '100%' },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: '-30%' },
};

export default function AppLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const [rideActive, setRideActive] = useState(false);
  const [hasActiveRide, setHasActiveRide] = useState(false);

  useEffect(() => {
    return subscribeRideActive(setRideActive);
  }, []);

  useEffect(() => {
    const check = () => {
      const ride = getActiveRide();
      setHasActiveRide(!!ride && Date.now() - ride.savedAt < 4 * 3600 * 1000);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  useLocationBroadcast();
  const { isLandscape } = useScreenOrientation();

  return (
    <VoiceChannelProvider>
    <div
      className="relative min-h-screen bg-background overflow-x-hidden orientation-transition"
      data-orientation={isLandscape ? 'landscape' : 'portrait'}
    >
      <NotificationPopUp />
      {hasActiveRide && !rideActive && <RideResumeBanner />}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={location.pathname}
          variants={pageVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {outlet}
        </motion.div>
      </AnimatePresence>
      {!rideActive && <BottomNav />}
    </div>
    </VoiceChannelProvider>
  );
}