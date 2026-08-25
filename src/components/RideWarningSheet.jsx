import { useState } from 'react';
import { AlertTriangle, Car, Construction, CloudRain, Bike, OctagonAlert, Wrench, X } from 'lucide-react';

const OPTIONS = [
  { type: 'traffic', title: 'Traffic / Congestion', icon: Car, color: 'bg-amber-500' },
  { type: 'obstruction', title: 'Road Obstruction', icon: Construction, color: 'bg-orange-500' },
  { type: 'accident', title: 'Accident Ahead', icon: OctagonAlert, color: 'bg-red-500' },
  { type: 'weather', title: 'Severe Weather', icon: CloudRain, color: 'bg-blue-500' },
  { type: 'mechanical', title: 'Mechanical Problem', icon: Wrench, color: 'bg-purple-500' },
  { type: 'unexpected_stop', title: 'Unexpected Stop', icon: Bike, color: 'bg-slate-600' },
];

export default function RideWarningSheet({ open, onClose, onReport, reporting = false }) {
  const [selected, setSelected] = useState(null);
  if (!open) return null;

  const submit = () => {
    if (!selected) return;
    onReport(selected);
    setSelected(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md rounded-3xl bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-500"><AlertTriangle size={22} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-black">Warn Riders Ahead</p>
            <p className="text-xs text-muted-foreground">Report an unexpected delay or hazard on your route.</p>
          </div>
          <button onClick={onClose} className="glove-target flex h-10 w-10 items-center justify-center rounded-full bg-secondary"><X size={18} /></button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {OPTIONS.map((item) => {
            const Icon = item.icon;
            const active = selected?.type === item.type;
            return (
              <button key={item.type} onClick={() => setSelected(item)} className={`flex min-h-[62px] items-center gap-2 rounded-2xl p-3 text-left transition ${active ? 'ring-2 ring-primary bg-primary/10' : 'bg-secondary/60'}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.color} text-white`}><Icon size={17} /></span>
                <span className="text-xs font-bold leading-tight">{item.title}</span>
              </button>
            );
          })}
        </div>
        <button disabled={!selected || reporting} onClick={submit} className="mt-3 flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl bg-primary font-black text-primary-foreground disabled:opacity-40">
          {reporting ? 'Sending Warning…' : 'WARN RIDERS'}
        </button>
        <p className="mt-2 text-center text-[10px] text-muted-foreground">Warnings are visible to riders travelling the affected route and expire automatically.</p>
      </div>
    </div>
  );
}
