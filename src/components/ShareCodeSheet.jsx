import { useState } from 'react';
import { Copy, Check, Share2 } from 'lucide-react';
import BottomSheet from '@/components/BottomSheet';
import QrCode from '@/components/QrCode';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function ShareCodeSheet({ open, onClose, title, code, qrData, description }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    const shareUrl = qrData || code;
    if (navigator.share) {
      try { await navigator.share({ title, text: description || title, url: shareUrl }); } catch (e) { /* cancelled */ }
    } else {
      handleCopy();
      toast.success('Code copied to clipboard');
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="flex flex-col items-center gap-4">
        <QrCode data={qrData || code} />
        <div className="w-full rounded-2xl bg-secondary p-4 text-center">
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          <p className="mt-1 break-all text-lg font-black tracking-wider">{code}</p>
        </div>
        <div className="flex w-full gap-2">
          <Button className="min-h-[48px] flex-1" onClick={handleCopy}>
            {copied ? <Check size={16} className="mr-2" /> : <Copy size={16} className="mr-2" />} {copied ? 'Copied' : 'Copy'}
          </Button>
          <Button variant="secondary" className="min-h-[48px] flex-1" onClick={handleShare}>
            <Share2 size={16} className="mr-2" /> Share
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}