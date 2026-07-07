import { ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

export default function MenuCard({ icon: Icon, title, subtitle, details, onClick, delay = 0, accent = false }) {
  return (
    <motion.button
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay, duration: 0.3, ease: 'easeOut' }}
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl bg-card p-4 text-left shadow-sm transition-transform active:scale-[0.98]"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ? 'bg-primary/15' : 'bg-primary/10'}`}>
        <Icon size={22} className="text-primary" />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold">{title}</h3>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        {details && <p className="mt-0.5 truncate text-xs font-medium text-primary">{details}</p>}
      </div>
      <ChevronRight size={20} className="shrink-0 text-muted-foreground" />
    </motion.button>
  );
}