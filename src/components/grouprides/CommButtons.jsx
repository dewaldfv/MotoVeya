import { COMM_SIGNALS } from '@/lib/groupRide';

export default function CommButtons({ onSignal }) {
  return (
    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
      {COMM_SIGNALS.map((s) => (
        <button
          key={s.type}
          onClick={() => onSignal(s)}
          className="flex shrink-0 flex-col items-center gap-1 rounded-2xl bg-card p-2 shadow-sm transition-transform active:scale-95"
        >
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${s.color} text-xl text-white`}>{s.emoji}</span>
          <span className="text-[10px] font-medium">{s.label}</span>
        </button>
      ))}
    </div>
  );
}