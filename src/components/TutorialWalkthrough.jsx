import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Map, Layers, Route, Calendar, Users, Shield, X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    icon: Map,
    color: 'text-primary',
    title: 'The Map is your home base',
    body: 'See nearby services, events, fuel stops and your friends — all on one live map. Tap anywhere on the map to reveal the controls again.',
  },
  {
    icon: Layers,
    color: 'text-primary',
    title: 'Categories & Layers',
    body: 'Tap the menu (top-right) to filter by category — workshops, fuel, hospitals, ATMs and more. Use the layers button to toggle what shows on the map.',
  },
  {
    icon: Route,
    color: 'text-primary',
    title: 'Plan & track rides',
    body: 'The Rides tab lets you start a ride, get turn-by-turn navigation, and track distance, speed and fuel. Your history is saved automatically.',
  },
  {
    icon: Calendar,
    color: 'text-primary',
    title: 'Discover events',
    body: 'Find rallies, breakfast runs and scenic rides near you. Favourite an event with the heart icon and get directions straight to the venue.',
  },
  {
    icon: Users,
    color: 'text-primary',
    title: 'Ride together',
    body: 'The Community tab connects you with friends and group rides. Share your live location, chat, and join voice channels while you ride.',
  },
  {
    icon: Shield,
    color: 'text-primary',
    title: 'Stay safe out there',
    body: 'MotoVeya detects crashes and sends a distress alert to your emergency contact and nearby riders. Set up your emergency details any time in Profile.',
  },
];

export default function TutorialWalkthrough({ open, onClose }) {
  const [step, setStep] = useState(0);

  const handleNext = () => {
    if (step < STEPS.length - 1) setStep(step + 1);
    else handleClose();
  };

  const handleClose = () => {
    localStorage.setItem('motogo_tutorial_done', 'true');
    localStorage.removeItem('motogo_show_tutorial');
    setStep(0);
    onClose?.();
  };

  const handleSkip = () => handleClose();

  const current = STEPS[step];
  const Icon = current.icon;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-5"
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.92, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 24, stiffness: 220 }}
            className="relative w-full max-w-sm rounded-3xl bg-card p-6 shadow-2xl"
          >
            <button
              onClick={handleSkip}
              className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-accent"
              aria-label="Skip tutorial"
            >
              <X size={20} />
            </button>

            <div className="flex justify-center">
              <div className={`flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 ${current.color}`}>
                <Icon size={38} strokeWidth={1.8} />
              </div>
            </div>

            <div className="mt-5 flex justify-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? 'w-6 bg-primary' : 'w-1.5 bg-secondary'}`}
                />
              ))}
            </div>

            <h2 className="mt-5 text-center text-xl font-bold">{current.title}</h2>
            <p className="mt-2 text-center text-sm leading-relaxed text-muted-foreground">{current.body}</p>

            <div className="mt-6 flex items-center gap-2">
              {step > 0 && (
                <Button variant="secondary" className="h-12 px-4" onClick={() => setStep(step - 1)}>
                  <ChevronLeft size={20} />
                </Button>
              )}
              <Button className="h-12 flex-1 text-base" onClick={handleNext}>
                {step === STEPS.length - 1 ? (
                  <>
                    <Check size={20} className="mr-1" /> Got it
                  </>
                ) : (
                  <>
                    Next <ChevronRight size={20} />
                  </>
                )}
              </Button>
            </div>

            <button onClick={handleSkip} className="mt-3 w-full text-center text-xs font-medium text-muted-foreground hover:text-foreground">
              Skip tutorial
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}