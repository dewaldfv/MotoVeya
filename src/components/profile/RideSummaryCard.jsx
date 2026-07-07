import { TrendingUp, Gauge, Fuel, Clock, Calendar, Cloud } from 'lucide-react';
import { motion } from 'framer-motion';

function SummaryRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5">
      <Icon size={16} className="shrink-0 text-primary" />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-semibold">{value}</span>
    </div>
  );
}

export default function RideSummaryCard({ data, delay = 0.4 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      className="overflow-hidden rounded-2xl bg-card shadow-sm"
    >
      <div className="bg-gradient-to-r from-primary/10 to-transparent px-4 py-2.5">
        <h3 className="text-sm font-bold">Ride Summary</h3>
      </div>
      <div className="divide-y divide-border px-4">
        <SummaryRow icon={TrendingUp} label="This Month" value={`${data.monthDistance} km`} />
        <SummaryRow icon={Gauge} label="Avg Ride Length" value={`${data.avgRideLength} km`} />
        <SummaryRow icon={Fuel} label="Fuel Economy" value={`${data.fuelEconomy} L/100km`} />
        <SummaryRow icon={Clock} label="Ride Time" value={data.rideTime} />
        <SummaryRow icon={Calendar} label="Favourite Day" value={data.favDay} />
        <SummaryRow icon={Cloud} label="Weather Pref" value={data.weatherPref} />
      </div>
    </motion.div>
  );
}