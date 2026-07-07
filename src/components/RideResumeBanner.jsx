import { Bike, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function RideResumeBanner() {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate('/', { state: { resume: true } })}
      className="fixed left-3 right-3 z-50 flex items-center gap-3 rounded-2xl bg-primary px-4 py-3 text-primary-foreground shadow-lg transition-transform active:scale-[0.98]"
      style={{ top: 'calc(env(safe-area-inset-top) + 4px)' }}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-foreground/20">
        <Bike size={20} />
      </div>
      <div className="flex-1 text-left">
        <p className="text-sm font-bold">Ride in Progress</p>
        <p className="text-xs text-primary-foreground/80">Tap to resume tracking</p>
      </div>
      <ChevronRight size={20} />
    </button>
  );
}