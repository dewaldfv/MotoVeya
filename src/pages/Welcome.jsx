import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LogIn, UserPlus, Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';
import LogoMark from '@/components/LogoMark';

export default function Welcome() {
  const navigate = useNavigate();

  const handleGuest = () => {
    localStorage.setItem('motogo_guest_mode', 'true');
    navigate('/', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#0c0e12] px-6" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <div className="flex flex-1 flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <LogoMark size={220} />
        </motion.div>

        <motion.h1
          className="mt-8 text-2xl font-bold tracking-tight text-white"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          Welcome to Mo&rsquo;toGo
        </motion.h1>

        <motion.p
          className="mt-3 max-w-xs text-center text-sm leading-relaxed text-white/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          South Africa's social navigation app for motorcyclists. Track rides, discover events, and stay safe on every journey.
        </motion.p>
      </div>

      <motion.div
        className="w-full max-w-sm space-y-3 pb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
      >
        <Button size="lg" className="min-h-[56px] w-full text-base" onClick={() => navigate('/login')}>
          <LogIn className="mr-2 h-5 w-5" /> Login
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="min-h-[56px] w-full border-white/20 bg-transparent text-base text-white hover:bg-white/10 hover:text-white"
          onClick={() => navigate('/register')}
        >
          <UserPlus className="mr-2 h-5 w-5" /> Create Account
        </Button>
        <Button
          size="lg"
          variant="ghost"
          className="min-h-[48px] w-full text-base text-white/50 hover:bg-white/5 hover:text-white/70"
          onClick={handleGuest}
        >
          <Compass className="mr-2 h-5 w-5" /> Continue as Guest
        </Button>
      </motion.div>

      <motion.p
        className="pb-4 text-center text-xs text-white/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.6, duration: 0.4 }}
      >
        By continuing, you agree to our{' '}
        <span className="cursor-pointer underline hover:text-white/50" onClick={() => navigate('/legal/terms')}>Terms of Service</span>
        {' '}and{' '}
        <span className="cursor-pointer underline hover:text-white/50" onClick={() => navigate('/legal/privacy')}>Privacy Policy</span>
      </motion.p>
    </div>
  );
}