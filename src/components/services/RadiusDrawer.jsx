import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { RADIUS_OPTIONS } from '@/lib/serviceCategories';
import { Check } from 'lucide-react';

export default function RadiusDrawer({ open, onClose, radius, onSelect }) {
  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Search Radius</DrawerTitle>
        </DrawerHeader>
        <div className="space-y-1 px-4 pb-6">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => { onSelect(r); onClose(); }}
              className="flex w-full items-center justify-between rounded-xl p-3 transition hover:bg-accent"
            >
              <span className="font-medium">{r} km</span>
              {radius === r && <Check size={18} className="text-primary" />}
            </button>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}