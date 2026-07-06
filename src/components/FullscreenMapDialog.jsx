import { Check } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import PickerMapCore from '@/components/PickerMapCore';
import LocationInfoCard from '@/components/LocationInfoCard';

export default function FullscreenMapDialog({ open, onOpenChange, value, onChange, layer, onLayerChange, isDark, flyTarget, importInfo }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 rounded-none p-0">
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top))' }}>
          <h2 className="font-bold">Place Pin</h2>
          <Button size="sm" onClick={() => onOpenChange(false)}><Check size={16} className="mr-1" /> Done</Button>
        </div>
        <div className="min-h-0 flex-1 p-2">
          <PickerMapCore
            value={value}
            onChange={onChange}
            height="100%"
            layer={layer}
            onLayerChange={onLayerChange}
            isDark={isDark}
            flyTarget={flyTarget}
            hideFullscreen
          />
        </div>
        <div className="shrink-0 overflow-y-auto border-t border-border p-2" style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}>
          <LocationInfoCard value={value} importInfo={importInfo} />
        </div>
      </DialogContent>
    </Dialog>
  );
}