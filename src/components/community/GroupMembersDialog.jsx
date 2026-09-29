import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, Crown, MessageCircle, LogOut } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import MemberProfileDialog from '@/components/community/MemberProfileDialog';

export default function GroupMembersDialog({ group, open, onOpenChange, onLeaveGroup }) {
  const navigate = useNavigate();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [starting, setStarting] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const handleMessageGroup = async () => {
    if (!group) return;
    setStarting(true);
    try {
      const res = await base44.functions.invoke('messaging-secure', { action: 'start_group', group_id: group.id });
      const data = res?.data;
      if (data?.error) { toast.error(data.error); return; }
      onOpenChange(false);
      navigate('/community', {
        state: {
          tab: 'messages',
          initialConversation: { id: data.conversation_id, is_group: true, group_name: data.group_name || group.name },
        },
      });
    } catch (e) {
      toast.error('Could not open group chat');
    } finally {
      setStarting(false);
    }
  };

  const handleConfirmLeave = async () => {
    if (!group) return;
    setLeaving(true);
    try {
      await onLeaveGroup?.(group.id);
      setLeaveOpen(false);
      onOpenChange(false);
      toast.success(`Left ${group.name}`);
    } catch (e) {
      toast.error('Could not leave group');
    } finally {
      setLeaving(false);
    }
  };

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

  const membersList = (
    <div className="mt-2 space-y-3">
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      ) : members.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
      ) : (
        members.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setSelected(m)}
            className="relative block w-full overflow-hidden rounded-2xl border border-border text-left transition active:scale-[0.99]"
          >
            {m.cover_url ? (
              <div className="h-14 w-full bg-cover bg-center" style={{ backgroundImage: `url(${m.cover_url})` }} />
            ) : (
              <div className="h-14 w-full bg-gradient-to-br from-primary/40 to-primary/10" />
            )}
            <div className="absolute inset-0 bg-black/55" />
            <div className="relative flex items-center justify-between gap-2 px-3 pb-3 -mt-6">
              <div className="flex items-center gap-3">
                {m.avatar_url ? (
                  <img src={m.avatar_url} alt={m.name} className="h-11 w-11 shrink-0 rounded-full border-2 border-white object-cover shadow-md" />
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
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${m.online ? 'bg-emerald-500' : 'bg-white/30'}`} />
                </span>
                <span className="text-xs font-medium text-white/90">{m.online ? 'Online' : 'Offline'}</span>
                {m.role === 'leader' ? (
                  <Badge className="shrink-0 bg-primary/90 text-white">
                    <Crown size={12} className="mr-1" /> Leader
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="shrink-0">Member</Badge>
                )}
              </div>
            </div>
          </button>
        ))
      )}
    </div>
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users size={20} className="text-primary" />
              {group?.name}
            </DialogTitle>
          </DialogHeader>
          <Tabs defaultValue="members">
            <TabsList className="w-full">
              <TabsTrigger value="members" className="flex-1">Members</TabsTrigger>
              <TabsTrigger value="options" className="flex-1">Group Options</TabsTrigger>
            </TabsList>
            <TabsContent value="members">
              <div className="mt-3 flex items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {members.length}/{group?.max_members} riders · tap a rider to view their profile
                </p>
                <Button size="sm" onClick={handleMessageGroup} disabled={starting || members.length === 0}>
                  <MessageCircle size={14} className="mr-1" /> Message Group
                </Button>
              </div>
              {membersList}
            </TabsContent>
            <TabsContent value="options" className="mt-4 space-y-4">
              <div className="rounded-2xl border border-border p-4">
                <h3 className="text-sm font-semibold">Leave Group</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  You will no longer receive updates or messages from this group. You can rejoin later using the invite code.
                </p>
                <Button variant="destructive" className="mt-3 w-full" onClick={() => setLeaveOpen(true)} disabled={leaving}>
                  <LogOut size={16} className="mr-2" /> Leave Group
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {group?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to leave this group? You will stop receiving group messages and ride updates.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmLeave}
              disabled={leaving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {leaving ? 'Leaving…' : 'Leave Group'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <MemberProfileDialog member={selected} open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }} onMessage={() => onOpenChange(false)} />
    </>
  );
}