import { Route, TrendingUp, Fuel, Trophy } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAnimatedCounter } from '@/hooks/useAnimatedCounter';

function StatCard({ icon: Icon, value, suffix, label, delay }) {
  const animated = useAnimatedCounter(value);
  const display = suffix === 'km' || suffix === 'L'
    ? Math.round(animated).toLocaleString()
    : Math.round(animated);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.7 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.35, ease: 'easeOut' }}
      className="rounded-2xl bg-card p-3 text-center shadow-sm"
    >
      <Icon size={18} className="mx-auto mb-1 text-primary" />
      <div className="text-lg font-black leading-tight">{display}{suffix}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </motion.div>
  );
}

export default function StatGrid({ totalRides, totalDistance, fuelUsed, achievements }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <StatCard icon={Route} value={totalRides} label="Total Rides" delay={0.1} />
      <StatCard icon={TrendingUp} value={totalDistance} suffix="km" label="Distance" delay={0.18} />
      <StatCard icon={Fuel} value={fuelUsed} suffix="L" label="Fuel Used" delay={0.26} />
      <StatCard icon={Trophy} value={achievements} label="Awards" delay={0.34} />
    </div>
  );
}