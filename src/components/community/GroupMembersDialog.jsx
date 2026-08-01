import { useState, useEffect } from 'react';
import { Users, Crown } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

export default function GroupMembersDialog({ group, open, onOpenChange }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !group) return;
    let cancelled = false;
    setLoading(true);
    base44.functions
      .invoke('get-group-members-secure', { group_id: group.id })
      .then((res) => {
        if (cancelled) return;
        setMembers(res?.data?.members || []);
      })
      .catch(() => { if (!cancelled) setMembers([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, group]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users size={20} className="text-primary" />
            {group?.name}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {members.length}/{group?.max_members} riders
        </p>
        <div className="mt-2 space-y-3">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="relative overflow-hidden rounded-2xl border border-border">
                {m.cover_url ? (
                  <div
                    className="h-14 w-full bg-cover bg-center"
                    style={{ backgroundImage: `url(${m.cover_url})` }}
                  />
                ) : (
                  <div className="h-14 w-full bg-gradient-to-br from-primary/40 to-primary/10" />
                )}
                <div className="absolute inset-0 bg-black/55" />
                <div className="relative flex items-center justify-between gap-2 px-3 pb-3 -mt-6">
                  <div className="flex items-center gap-3">
                    {m.avatar_url ? (
                      <img
                        src={m.avatar_url}
                        alt={m.name}
                        className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover shadow-md"
                      />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-white bg-primary text-white font-bold shadow-md">
                        {(m.name || '?').charAt(0).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-white drop-shadow">{m.name || 'Unknown rider'}</p>
                      {m.nickname && m.nickname !== m.name && (
                        <p className="truncate text-xs text-white/75">{m.nickname}</p>
                      )}
                    </div>
                  </div>
                  {m.role === 'leader' ? (
                    <Badge className="shrink-0 bg-primary/90 text-white">
                      <Crown size={12} className="mr-1" /> Leader
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="shrink-0">Member</Badge>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}