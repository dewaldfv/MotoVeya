import { MapPin, Navigation, UserPlus, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';

export default function RiderQuickActions({ rider, onShowLocation, onNavigate, onInvite, compact = false }) {
  const phone = rider?.phone;
  const btn = 'flex flex-col items-center justify-center gap-1 rounded-2xl bg-card p-2 text-[10px] font-medium shadow-sm transition-transform active:scale-95';
  const ic = 'h-4 w-4 text-primary';

  const handleCall = () => { if (phone) window.location.href = `tel:${phone}`; else toast.error('No phone number available'); };
  const handleMsg = () => { if (phone) window.location.href = `sms:${phone}`; else toast.error('No phone number available'); };

  if (compact) {
    return (
      <div className="flex gap-1.5">
        <button className={`${btn} flex-1`} onClick={onNavigate}><Navigation className={ic} />Navigate</button>
        <button className={`${btn} flex-1`} onClick={onInvite}><UserPlus className={ic} />Invite</button>
        <button className={`${btn} flex-1`} onClick={handleMsg}><MessageCircle className={ic} />Message</button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-5 gap-2">
      <button className={btn} onClick={onShowLocation}><MapPin className={ic} />Location</button>
      <button className={btn} onClick={onNavigate}><Navigation className={ic} />Navigate</button>
      <button className={btn} onClick={onInvite}><UserPlus className={ic} />Invite</button>
      <button className={btn} onClick={handleMsg}><MessageCircle className={ic} />Message</button>
      <button className={btn} onClick={handleCall}><Phone className={ic} />Call</button>
    </div>
  );
}