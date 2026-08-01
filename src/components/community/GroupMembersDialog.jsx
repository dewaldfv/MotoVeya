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
    base44.entities.GroupMember.filter({ group_id: group.id, status: 'active' })
      .then((list) => {
        if (cancelled) return;
        const sorted = (list || []).sort((a, b) => {
          if (a.role === 'leader' && b.role !== 'leader') return -1;
          if (a.role !== 'leader' && b.role === 'leader') return 1;
          return 0;
        });
        setMembers(sorted);
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
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
            </div>
          ) : members.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
          ) : (
            members.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-xl bg-card p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                    {(m.user_name || m.user_nickname || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium">{m.user_name || 'Unknown rider'}</p>
                    {m.user_nickname && m.user_nickname !== m.user_name && (
                      <p className="text-xs text-muted-foreground">{m.user_nickname}</p>
                    )}
                  </div>
                </div>
                {m.role === 'leader' ? (
                  <Badge className="bg-primary/10 text-primary">
                    <Crown size={12} className="mr-1" /> Leader
                  </Badge>
                ) : (
                  <Badge variant="secondary">Member</Badge>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}