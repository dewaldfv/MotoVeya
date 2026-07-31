import { useRef, useState } from 'react';
import { Crown, Copy, Check, Share2, QrCode, Settings, Camera, Image as ImageIcon, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export default function ProfileHeader({ user, isPremium, copied, onCopy, onShare, onSettings, onAvatarUpload, onCoverUpload }) {
  const initial = user.nickname?.[0]?.toUpperCase() || user.full_name?.[0]?.toUpperCase() || 'R';
  const avatarInput = useRef(null);
  const coverInput = useRef(null);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [coverBusy, setCoverBusy] = useState(false);

  const pickAvatar = () => avatarInput.current?.click();
  const pickCover = () => coverInput.current?.click();

  const handleAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onAvatarUpload) return;
    setAvatarBusy(true);
    try {await onAvatarUpload(file);} catch (e) {} finally {setAvatarBusy(false);}
  };
  const handleCover = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !onCoverUpload) return;
    setCoverBusy(true);
    try {await onCoverUpload(file);} catch (e) {} finally {setCoverBusy(false);}
  };

  const hasCover = !!user.cover_url;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: 'easeOut' }}
      className="relative overflow-hidden rounded-3xl bg-card shadow-sm">
      
      {/* Cover background */}
      <div className="relative h-28 w-full">
        {hasCover ?
        <img src={user.cover_url} alt="" className="h-full w-full object-cover" /> :

        <div className="h-full w-full bg-gradient-to-br from-primary/25 via-primary/10 to-card" />
        }
        <div className="absolute inset-0 bg-gradient-to-t from-card via-card/10 to-transparent py-1" />
        {!hasCover && <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-primary/15 blur-2xl" />}
        <button
          onClick={pickCover}
          disabled={coverBusy || !onCoverUpload}
          className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-background/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition-transform active:scale-95 disabled:opacity-60">
          
          {coverBusy ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
          {coverBusy ? 'Uploading…' : hasCover ? 'Change Cover' : 'Add Cover'}
        </button>
      </div>

      <div className="relative -mt-12 flex flex-col items-center px-6 pb-6 text-center">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary/25 to-primary/5 text-3xl font-black text-primary ring-4 ring-background">
            {user.avatar_url ?
            <img src={user.avatar_url} alt={user.nickname || user.full_name || 'avatar'} className="h-full w-full object-cover" /> :

            <span>{initial}</span>
            }
          </div>
          {isPremium &&
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-amber-500 ring-2 ring-background">
              <Crown size={16} className="text-primary-foreground" />
            </div>
          }
          <button
            onClick={pickAvatar}
            disabled={avatarBusy || !onAvatarUpload}
            className="absolute -bottom-1 left-0 flex h-8 w-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow ring-1 ring-border backdrop-blur transition-transform active:scale-95 disabled:opacity-60"
            aria-label="Change profile picture">
            
            {avatarBusy ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
          </button>
        </div>

        <h1 className="mt-3 text-xl font-bold">{user.nickname || user.full_name}</h1>
        {user.motorcycle_club &&
        <p className="text-sm text-muted-foreground">{user.motorcycle_club}</p>
        }

        <div className="mt-2">
          {isPremium ?
          <Badge className="bg-gradient-to-r from-primary to-amber-500 text-primary-foreground">
              <Crown size={12} className="mr-1" /> Premium Member
            </Badge> :

          <Badge variant="secondary">Free Rider</Badge>
          }
        </div>

        <button
          onClick={onCopy}
          className="mt-3 flex items-center gap-1.5 rounded-full bg-secondary/80 px-3 py-1.5 text-xs font-medium backdrop-blur transition-transform active:scale-95">
          
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

      <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={handleAvatar} />
      <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={handleCover} />
    </motion.div>);

}