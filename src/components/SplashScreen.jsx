import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import LogoMark from './LogoMark';

const FIRST_LAUNCH_MS = 2600;
const RETURNING_MS = 800;
const FADE_OUT_MS = 400;

export default function SplashScreen({ isFirstLaunch, loading, onComplete }) {
  const [animationDone, setAnimationDone] = useState(false);
  const duration = isFirstLaunch ? FIRST_LAUNCH_MS : RETURNING_MS;

  // Preload map tiles and warm connections during splash
  useEffect(() => {
    const tiles = [
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/14/8748/8424.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/14/8748/8424.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/14/8748/8425.png',
    ];
    tiles.forEach((url) => { const img = new Image(); img.src = url; });
  }, []);

  // Mark animation complete after duration
  useEffect(() => {
    const timer = setTimeout(() => setAnimationDone(true), duration);
    return () => clearTimeout(timer);
  }, [duration]);

  // When animation AND loading are both done, fade out then call onComplete
  useEffect(() => {
    if (animationDone && !loading) {
      const t = setTimeout(onComplete, FADE_OUT_MS);
      return () => clearTimeout(t);
    }
  }, [animationDone, loading, onComplete]);

  const fadingOut = animationDone && !loading;

  return (
    <motion.div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[#0c0e12]"
      animate={{ opacity: fadingOut ? 0 : 1 }}
      transition={{ duration: FADE_OUT_MS / 1000, ease: 'easeInOut' }}
    >
      <div className="relative flex items-center justify-center">
        {/* Glow halo */}
        {isFirstLaunch && (
          <motion.div
            className="pointer-events-none absolute inset-0 scale-150"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: [0, 0.6, 0.3], scale: [0.7, 1.2, 1] }}
            transition={{ delay: 0.3, duration: 1.5, ease: 'easeOut' }}
            style={{ background: 'radial-gradient(circle, hsla(18, 100%, 53%, 0.4), transparent 65%)' }}
          />
        )}

        {/* Logo fade-in + scale-up */}
        <motion.div
          className="relative"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: isFirstLaunch ? 0.7 : 0.3, ease: [0.16, 1, 0.3, 1] }}
        >
          <LogoMark size={isFirstLaunch ? 280 : 220} />

          {/* Light sweep across logo */}
          {isFirstLaunch && (
            <motion.div
              className="pointer-events-none absolute inset-0 overflow-hidden"
              initial={{ x: '-130%' }}
              animate={{ x: '250%' }}
              transition={{ delay: 0.8, duration: 0.8, ease: 'easeInOut' }}
            >
              <div
                className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                style={{ transform: 'skewX(-15deg)' }}
              />
            </motion.div>
          )}
        </motion.div>
      </div>

      {/* Loading spinner if init takes longer than animation */}
      {animationDone && loading && (
        <motion.div
          className="absolute bottom-20"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/15 border-t-[#ff6600]" />
        </motion.div>
      )}
    </motion.div>
  );
}