import { useState, useEffect } from 'react';
import { Bike, Trophy, X } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { computeAchievements } from '@/lib/riderStats';

export default function MemberProfileDialog({ member, open, onOpenChange }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !member?.user_id) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setProfile(null);
    base44.functions
      .invoke('get-member-profile-secure', { user_id: member.user_id })
      .then((res) => {
        if (cancelled) return;
        if (res?.data?.error) { setError(res.data.error); return; }
        setProfile(res?.data || null);
      })
      .catch(() => { if (!cancelled) setError('Unable to load profile'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, member]);

  const achievements = profile ? computeAchievements(profile.stats || {}) : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center gap-2 py-12 px-6 text-center">
            <X size={28} className="text-muted-foreground" />
            <p className="font-semibold">Profile unavailable</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        ) : profile ? (
          <>
            <div className="relative h-24 w-full">
              {profile.cover_url ? (
                <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${profile.cover_url})` }} />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/40 to-primary/10" />
              )}
              <div className="absolute inset-0 bg-black/40" />
            </div>
            <div className="px-5 pb-5">
              <div className="-mt-10 flex items-end gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.nickname} className="h-16 w-16 rounded-full border-4 border-background object-cover shadow-md" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-primary text-xl font-bold text-primary-foreground shadow-md">
                    {(profile.nickname || '?').charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="pb-1">
                  <h2 className="text-lg font-black leading-tight">{profile.nickname || 'Rider'}</h2>
                  {member?.role === 'leader' && (
                    <span className="text-xs font-medium text-primary">Group Leader</span>
                  )}
                </div>
              </div>

              {profile.bike ? (
                <div className="mt-4 rounded-2xl bg-card p-4">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <Bike size={14} /> Primary Motorcycle
                  </p>
                  <p className="font-bold">{profile.bike.make} {profile.bike.model}</p>
                  {profile.bike.nickname && (
                    <p className="text-sm text-muted-foreground">"{profile.bike.nickname}"</p>
                  )}
                </div>
              ) : (
                <div className="mt-4 rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground">
                  No motorcycle added yet
                </div>
              )}

              <div className="mt-4">
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Trophy size={14} /> Achievements
                </p>
                {achievements.length === 0 ? (
                  <div className="rounded-2xl bg-card p-4 text-center text-sm text-muted-foreground">
                    No achievements earned yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {achievements.map((a) => (
                      <div key={a.id} className="flex items-center gap-2 rounded-2xl bg-card p-3">
                        <span className="text-xl">{a.emoji}</span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{a.label}</p>
                          <p className="truncate text-[11px] text-muted-foreground">{a.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}