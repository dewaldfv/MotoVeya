import { CalendarPlus } from 'lucide-react';
import { downloadIcs } from '@/lib/calendarExport';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function CalendarExportButton({ event, events, label = 'Add to Calendar', variant = 'secondary', size = 'lg', className = '' }) {
  const handleClick = () => {
    const list = events || (event ? [event] : []);
    if (!list.length) {
      toast.error('No events to export');
      return;
    }
    try {
      const name = list.length === 1 ? `motogo-${list[0].id}` : 'motogo-events';
      downloadIcs(list, name);
      toast.success(list.length === 1 ? 'Event added to your calendar' : `${list.length} events exported to your calendar`);
    } catch (e) {
      console.error(e);
      toast.error('Could not export to calendar');
    }
  };

  return (
    <Button variant={variant} size={size} className={className} onClick={handleClick}>
      <CalendarPlus size={18} className="mr-2" /> {label}
    </Button>
  );
}