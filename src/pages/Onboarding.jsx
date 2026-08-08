import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { toast } from 'sonner';
import {
  WelcomeStep, LocationStep, NotificationsStep, EmergencyStep,
  MotorcycleStep, InterestsStep, SubscriptionStep, FinishStep,
} from '@/components/onboarding/OnboardingSteps';

const TOTAL_STEPS = 7;
const STEP_KEY = 'motogo_onboarding_step';

const EMPTY_FORM = {
  nickname: '', motorcycle_club: '', bio: '', medical_notes: '',
  make: '', model: '', year: '', engine_size_cc: '', tank_capacity_l: '', fuel_consumption_l_per_100km: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
  interests: [],
  subscription: 'free',
};

export default function Onboarding() {
  const navigate = useNavigate();
  const { checkUserAuth } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [dir, setDir] = useState(1);

  // Pre-load saved data + resume step; bounce completed users to Home
  useEffect(() => {
    (async () => {
      try {
        const me = await base44.auth.me();
        if (me.onboarding_completed) {
          navigate('/', { replace: true });
          return;
        }
        setForm((f) => ({
          ...f,
          nickname: me.nickname || f.nickname,
          motorcycle_club: me.motorcycle_club || f.motorcycle_club,
          bio: me.bio || f.bio,
          medical_notes: me.medical_notes || f.medical_notes,
          emergency_contact_name: me.emergency_contact_name || f.emergency_contact_name,
          emergency_contact_phone: me.emergency_contact_phone || f.emergency_contact_phone,
          emergency_contact_relationship: me.emergency_contact_relationship || f.emergency_contact_relationship,
          interests: me.interests?.length ? me.interests : f.interests,
          subscription: me.subscription_tier === 'premium' ? 'premium' : f.subscription,
        }));
        const bikes = await base44.entities.Bike.filter({ created_by_id: me.id }, '-created_date', 20);
        const primary = bikes.find((b) => b.is_primary) || bikes[0];
        if (primary) {
          setForm((f) => ({
            ...f,
            make: primary.make || f.make,
            model: primary.model || f.model,
            year: primary.year ? String(primary.year) : f.year,
            engine_size_cc: primary.engine_size_cc ? String(primary.engine_size_cc) : f.engine_size_cc,
            tank_capacity_l: primary.tank_capacity_l ? String(primary.tank_capacity_l) : f.tank_capacity_l,
            fuel_consumption_l_per_100km: primary.fuel_consumption_l_per_100km ? String(primary.fuel_consumption_l_per_100km) : f.fuel_consumption_l_per_100km,
          }));
        }
        const savedStep = Number(localStorage.getItem(STEP_KEY) || '0');
        if (savedStep > 0 && savedStep <= TOTAL_STEPS) setStep(savedStep);
      } catch (e) {
        console.error('Failed to preload onboarding data', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  useEffect(() => {
    if (!loading) localStorage.setItem(STEP_KEY, String(step));
  }, [step, loading]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  // Auto-save the current step's collected data before advancing
  const persistStep = async (currentStep) => {
    if (currentStep === 3) {
      await base44.auth.updateMe({
        emergency_contact_name: form.emergency_contact_name,
        emergency_contact_phone: form.emergency_contact_phone,
        emergency_contact_relationship: form.emergency_contact_relationship,
        medical_notes: form.medical_notes,
      });
    } else if (currentStep === 4) {
      const me = await base44.auth.me();
      const bikes = await base44.entities.Bike.filter({ created_by_id: me.id }, '-created_date', 20);
      const primary = bikes.find((b) => b.is_primary) || bikes[0];
      const bikeData = {
        make: form.make, model: form.model, year: Number(form.year) || undefined,
        engine_size_cc: Number(form.engine_size_cc) || undefined, tank_capacity_l: Number(form.tank_capacity_l) || undefined,
        fuel_consumption_l_per_100km: Number(form.fuel_consumption_l_per_100km) || undefined, is_primary: true,
      };
      if (primary) await base44.entities.Bike.update(primary.id, bikeData);
      else await base44.entities.Bike.create(bikeData);
    } else if (currentStep === 5) {
      await base44.auth.updateMe({ interests: form.interests });
    }
  };

  const next = async () => {
    setSaving(true);
    try {
      await persistStep(step);
      setDir(1);
      setStep((s) => s + 1);
    } catch (e) {
      console.error(e);
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const back = () => { setDir(-1); setStep((s) => Math.max(0, s - 1)); };

  const finish = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({
        subscription_tier: form.subscription,
        subscription_status: form.subscription === 'premium' ? 'active' : 'none',
        onboarding_completed: true,
        profile_completed: true,
      });
      const me = await base44.auth.me();
      const existing = await base44.entities.Subscription.filter({ user_id: me.id }, '-created_date', 5);
      if (existing.length === 0) {
        await base44.entities.Subscription.create({
          plan: form.subscription, status: 'active',
          amount_zar: form.subscription === 'premium' ? 89.99 : 0,
          start_date: new Date().toISOString(), auto_renew: true,
        });
      }
      localStorage.removeItem(STEP_KEY);
      // Refresh the cached auth user so the route guard sees onboarding_completed=true
      await checkUserAuth();
      toast.success('Welcome to MotoGo!');
      localStorage.setItem('motogo_show_tutorial', 'true');
      localStorage.removeItem('motogo_tutorial_done');
      navigate('/');
    } catch (e) {
      console.error(e);
      toast.error('Failed to complete setup. Please try again.');
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
      </div>
    );
  }

  const isFinish = step >= TOTAL_STEPS;
  const progressLabel = isFinish ? 'All set!' : `Step ${step + 1} of ${TOTAL_STEPS}`;
  const stepProps = { form, set, onNext: next, saving };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <div className="mx-auto w-full max-w-md flex-1 px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="mb-6 flex items-center gap-3">
          {step > 0 && !isFinish && (
            <button onClick={back} className="-ml-2 flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground hover:text-foreground" aria-label="Back">
              <ChevronLeft size={24} />
            </button>
          )}
          <div className="flex flex-1 gap-1.5">
            {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i < (isFinish ? TOTAL_STEPS : step) ? 'bg-primary' : 'bg-secondary'}`} />
            ))}
          </div>
          <span className="w-16 text-right text-xs font-medium text-muted-foreground">{progressLabel}</span>
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          <motion.div
            key={step}
            custom={dir}
            initial={{ opacity: 0, x: dir > 0 ? 60 : -60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir > 0 ? -60 : 60 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            {isFinish ? (
              <FinishStep form={form} saving={saving} onFinish={finish} />
            ) : step === 0 ? (
              <WelcomeStep {...stepProps} />
            ) : step === 1 ? (
              <LocationStep {...stepProps} />
            ) : step === 2 ? (
              <NotificationsStep {...stepProps} />
            ) : step === 3 ? (
              <EmergencyStep {...stepProps} />
            ) : step === 4 ? (
              <MotorcycleStep {...stepProps} />
            ) : step === 5 ? (
              <InterestsStep {...stepProps} />
            ) : (
              <SubscriptionStep {...stepProps} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}