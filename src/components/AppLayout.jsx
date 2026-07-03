import { useState, useEffect } from 'react';
import { useOutlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from './BottomNav';
import { useAutoRideStart } from '@/hooks/useAutoRideStart';
import RideResumeBanner from './RideResumeBanner';
import { getActiveRide } from '@/lib/rideCache';

const pageVariants = {
  initial: { opacity: 0, x: '100%' },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: '-30%' },
};

export default function AppLayout() {
  const location = useLocation();
  const outlet = useOutlet();
  const navigate = useNavigate();

  useAutoRideStart({
    enabled: localStorage.getItem('motogo_auto_ride_detection') !== 'false',
    onAutoStart: () => navigate('/ride/active', { state: { autoStart: true } }),
  });

  const [hasActiveRide, setHasActiveRide] = useState(false);
  useEffect(() => {
    const check = () => {
      const ride = getActiveRide();
      setHasActiveRide(!!ride && Date.now() - ride.savedAt < 4 * 3600 * 1000);
    };
    check();
    const interval = setInterval(check, 15000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen bg-background">
      {hasActiveRide && <RideResumeBanner />}
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
      <BottomNav />
    </div>
  );
}