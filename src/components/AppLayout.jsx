import { useState, useEffect } from 'react';
import { useOutlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '@/lib/AuthContext';
import BottomNav from './BottomNav';
import { useLocationBroadcast } from '@/hooks/useLocationBroadcast';
import { useMessageNotifications } from '@/hooks/useMessageNotifications';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import RideResumeBanner from './RideResumeBanner';
import VoiceChannelProvider from './voice/VoiceChannelProvider';
import NotificationPopUp from './NotificationPopUp';
import OrientationPermissionPrompt from './OrientationPermissionPrompt';
import { getActiveRide } from '@/lib/rideCache';
import { subscribeRideActive } from '@/lib/rideStatus';
import { useScreenOrientation } from '@/hooks/useScreenOrientation';
import { useIdleMapUi } from '@/hooks/useIdleMapUi';
import { usePresence } from '@/hooks/usePresence';
import { useOverlayBackHandler } from '@/hooks/useOverlayBackHandler';

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
  useMessageNotifications();
  usePushNotifications();
  useOverlayBackHandler();
  const navigate = useNavigate();
  const { user, isLoadingAuth } = useAuth();
  usePresence(!!user && !isLoadingAuth);

  useEffect(() => {
    if (!isLoadingAuth && user && user.onboarding_completed !== true) {
      navigate('/onboarding', { replace: true });
    }
  }, [user, isLoadingAuth, navigate]);

  const { isLandscape } = useScreenOrientation();
  const { visible: mapUiVisible } = useIdleMapUi();
  const isHome = location.pathname === '/';
  const navHidden = isHome && !mapUiVisible;

  useEffect(() => {
    const handler = (e) => {
      const conversationId = e?.detail?.conversationId;
      navigate('/community', { state: { tab: 'messages', conversationId } });
    };
    window.addEventListener('motogo:open-conversation', handler);
    return () => window.removeEventListener('motogo:open-conversation', handler);
  }, [navigate]);

  if (!isLoadingAuth && user && user.onboarding_completed !== true) {
    return null;
  }

  return (
    <VoiceChannelProvider>
      <div
        className="relative min-h-screen bg-background overflow-x-hidden orientation-transition"
      data-orientation={isLandscape ? 'landscape' : 'portrait'}
    >
      <NotificationPopUp />
      <OrientationPermissionPrompt />
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
      {!rideActive && <BottomNav hidden={navHidden} />}
    </div>
    </VoiceChannelProvider>
  );
}