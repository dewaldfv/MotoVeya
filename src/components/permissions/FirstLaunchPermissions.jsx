import { useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { PERMISSION_STEPS, requestPermission, markPermissionSetupComplete } from '@/lib/permissions';
import PermissionStepCard from './PermissionStepCard';

const RESULT_PAUSE_MS = 550;

// First launch only: asks for each device permission in turn, then hands the
// app back. The outcome of every step is recorded so the sequence never repeats.
export default function FirstLaunchPermissions({ onComplete }) {
  const [index, setIndex] = useState(0);
  const [status, setStatus] = useState('idle');
  const [results, setResults] = useState({});
  const step = PERMISSION_STEPS[index];

  const finish = useCallback((all) => {
    markPermissionSetupComplete(all);
    onComplete();
  }, [onComplete]);

  const advance = useCallback((all) => {
    if (index + 1 >= PERMISSION_STEPS.length) {
      finish(all);
      return;
    }
    setTimeout(() => {
      setIndex(index + 1);
      setStatus('idle');
    }, RESULT_PAUSE_MS);
  }, [index, finish]);

  const handleAllow = async () => {
    if (status === 'requesting') return;
    setStatus('requesting');
    const outcome = await requestPermission(step.key);
    const all = { ...results, [step.key]: outcome };
    setResults(all);
    setStatus(outcome);
    advance(all);
  };

  const handleSkip = () => {
    if (status === 'requesting') return;
    const all = { ...results, [step.key]: 'skipped' };
    setResults(all);
    advance(all);
  };

  return (
    <div
      className="fixed inset-0 z-[190] flex flex-col items-center justify-center overflow-hidden bg-[#0c0e12] px-6"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <button
        type="button"
        onClick={() => finish(results)}
        className="absolute right-4 min-h-[44px] px-3 text-sm text-white/35 transition-colors hover:text-white/70"
        style={{ top: 'calc(1rem + env(safe-area-inset-top))' }}
      >
        Skip all
      </button>

      <AnimatePresence mode="wait">
        <motion.div
          key={step.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="flex w-full justify-center"
        >
          <PermissionStepCard step={step} status={status} onAllow={handleAllow} onSkip={handleSkip} />
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center gap-2">
        {PERMISSION_STEPS.map((item, i) => (
          <span
            key={item.key}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === index ? 'w-6 bg-[#ff6600]' : 'w-1.5 bg-white/20'}`}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-white/30">Step {index + 1} of {PERMISSION_STEPS.length}</p>
    </div>
  );
}