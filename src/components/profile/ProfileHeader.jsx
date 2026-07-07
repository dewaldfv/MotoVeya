import { Crown, Copy, Check, Share2, QrCode, Settings } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ProfileHeader({ user, isPremium, copied, onCopy, onShare, onSettings }) {
  const initial = user.nickname?.[0]?.toUpperCase() || user.full_name?.[0]?.toUpperCase() || 'R';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card to-card p-6 shadow-sm backdrop-blur-lg"
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />
      <div className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-primary/5 blur-2xl" />

      <div className="relative flex flex-col items-center text-center">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-3xl font-black text-primary ring-4 ring-background">
            {initial}
          </div>
          {isPremium && (
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 ring-2 ring-background">
              <Crown size={16} className="text-primary-foreground" />
            </div>
          )}
        </div>

        <h1 className="mt-3 text-xl font-bold">{user.nickname || user.full_name}</h1>
        {user.motorcycle_club && (
          <p className="text-sm text-muted-foreground">{user.motorcycle_club}</p>
        )}

        <div className="mt-2">
          {isPremium ? (
            <Badge className="bg-gradient-to-r from-primary to-amber-500 text-primary-foreground">
              <Crown size={12} className="mr-1" /> Premium Member
            </Badge>
          ) : (
            <Badge variant="secondary">Free Rider</Badge>
          )}
        </div>

        <button
          onClick={onCopy}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition-transform active:scale-95"
        >
          {copied ? <Check size={12} className="text-primary" /> : <Copy size={12} />}
          <span className="font-mono">{user.id.substring(0, 8)}</span>
        </button>

        <div className="mt-4 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={onShare} className="gap-1.5">
            <Share2 size={14} /> Share
          </Button>
          <Button variant="secondary" size="sm" onClick={onShare} className="gap-1.5">
            <QrCode size={14} /> QR
          </Button>
          <Button variant="secondary" size="icon" onClick={onSettings} className="h-8 w-8" aria-label="Settings">
            <Settings size={16} />
          </Button>
        </div>
      </div>
    </motion.div>
  );
}