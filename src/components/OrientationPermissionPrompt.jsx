import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Smartphone, RotateCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOrientationPermission } from '@/hooks/useOrientationPermission';

/**
 * Shows a one-time permission dialog on iOS (orientation sensors require an
 * explicit user-gesture grant). On other platforms orientation is allowed by
 * default and nothing is shown. If the user denies, a small floating button
 * lets them re-request permission later.
 */
export default function OrientationPermissionPrompt() {
  const { state, request, dismiss } = useOrientationPermission();
  const [busy, setBusy] = useState(false);

  const handleAllow = async () => {
    setBusy(true);
    await request();
    setBusy(false);
  };

  return (
    <>
      <AnimatePresence>
        {state === 'pending' && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/60 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 260 }}
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/15">
                <Smartphone className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-lg font-bold">Enable rotation</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Mo&rsquo;toGo needs access to your device orientation so the map,
                ride HUD and navigation views adapt when you rotate your phone.
                This is required for the app to function fully.
              </p>
              <div className="mt-5 space-y-2">
                <Button
                  size="lg"
                  className="min-h-[52px] w-full text-base"
                  onClick={handleAllow}
                  disabled={busy}
                >
                  <RotateCw className="mr-2 h-5 w-5" />
                  {busy ? 'Requesting…' : 'Allow rotation'}
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="w-full text-muted-foreground"
                  onClick={dismiss}
                  disabled={busy}
                >
                  Not now
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Persistent re-enable button when permission was denied. */}
      <AnimatePresence>
        {state === 'denied' && (
          <motion.button
            type="button"
            onClick={handleAllow}
            disabled={busy}
            className="fixed z-[90] flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-lg"
            style={{ bottom: 'calc(6.5rem + env(safe-area-inset-bottom))', right: 'calc(1rem + env(safe-area-inset-right))' }}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            aria-label="Enable rotation"
          >
            {busy ? <RotateCw className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
            Enable rotation
          </motion.button>
        )}
      </AnimatePresence>
    </>
  );
}