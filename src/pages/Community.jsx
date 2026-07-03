import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Ticket, LogOut, Siren } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import LoginPrompt from '@/components/LoginPrompt';
import PullToRefresh from '@/components/PullToRefresh';
import ServicesTab from '@/components/services/ServicesTab';
import { toast } from 'sonner';

function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

export default function Community() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [friendCode, setFriendCode] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['community'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return null;
      const me = await base44.auth.me();
      const [groups, friends, memberships, pending] = await Promise.all([
        base44.entities.Group.filter({ is_active: true }, '-created_date', 50),
        base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 50),
        base44.entities.GroupMember.filter({ user_id: me.id, status: 'active' }, '-created_date', 50),
        base44.entities.Friend.filter({ recipient_id: me.id, status: 'pending' }, '-created_date', 20),
      ]);
      return { user: me, groups: groups || [], friends: friends || [], memberships: memberships || [], pending: pending || [] };
    },
  });

  const user = data?.user ?? null;
  const groups = data?.groups ?? [];
  const friends = data?.friends ?? [];
  const memberships = data?.memberships ?? [];
  const pendingReqs = data?.pending ?? [];

  const joinGroupMutation = useMutation({
    mutationFn: ({ group, user }) => base44.entities.GroupMember.create({
      group_id: group.id, user_id: user.id, user_name: user.full_name,
      user_nickname: user.nickname, role: 'member', status: 'active',
    }),
    onMutate: async ({ group, user }) => {
      await queryClient.cancelQueries({ queryKey: ['community'] });
      const prev = queryClient.getQueryData(['community']);
      queryClient.setQueryData(['community'], (old) => {
        if (!old) return old;
        const tempMembership = {
          id: 'temp-' + Date.now(), group_id: group.id, user_id: user.id,
          user_name: user.full_name, user_nickname: user.nickname,
          role: 'member', status: 'active',
        };
        return { ...old, memberships: [...old.memberships, tempMembership] };
      });
      return { prev };
    },
    onError: (_e, _v, ctx) => { if (ctx?.prev) queryClient.setQueryData(['community'], ctx.prev); },
    onSettled: () => { queryClient.invalidateQueries({ queryKey: ['community'] }); },
  });

  const memberGroupIds = new Set(memberships.map((m) => m.group_id));
  const myGroups = groups.filter((g) => memberGroupIds.has(g.id));
  const isPremium = user?.subscription_tier === 'premium';

  const handleRefresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['community'] }),
      queryClient.invalidateQueries({ queryKey: ['services'] }),
      queryClient.invalidateQueries({ queryKey: ['service-favorites'] }),
    ]);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) return;
    try {
      const code = generateCode();
      const maxM = isPremium ? 32 : 2;
      const grp = await base44.entities.Group.create({ name: newGroupName, invite_code: code, max_members: maxM, created_by_name: user.nickname || user.full_name, is_active: true });
      await base44.entities.GroupMember.create({ group_id: grp.id, user_id: user.id, user_name: user.full_name, user_nickname: user.nickname, role: 'leader', status: 'active' });
      setCreateOpen(false); setNewGroupName('');
      await queryClient.invalidateQueries({ queryKey: ['community'] });
    } catch (e) { console.error(e); }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) return;
    try {
      const found = await base44.entities.Group.filter({ invite_code: joinCode.trim().toUpperCase() });
      if (found.length === 0) { toast.error('Invalid invite code'); return; }
      const grp = found[0];
      const existing = memberships.find((m) => m.group_id === grp.id);
      if (existing) { setJoinOpen(false); setJoinCode(''); return; }
      const members = await base44.entities.GroupMember.filter({ group_id: grp.id, status: 'active' });
      if (members.length >= grp.max_members) { toast.error('Group is full'); return; }
      setJoinOpen(false); setJoinCode('');
      await joinGroupMutation.mutateAsync({ group: grp, user });
    } catch (e) { console.error(e); }
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      const myMembership = memberships.find((m) => m.group_id === groupId);
      if (myMembership) await base44.entities.GroupMember.update(myMembership.id, { status: 'left' });
      await queryClient.invalidateQueries({ queryKey: ['community'] });
    } catch (e) { console.error(e); }
  };

  const handleAddFriend = async () => {
    if (!friendCode.trim()) return;
    try {
      await base44.entities.Friend.create({ requester_id: user.id, requester_name: user.nickname || user.full_name, recipient_id: friendCode.trim(), recipient_name: 'Pending', status: 'pending' });
      setAddFriendOpen(false); setFriendCode('');
    } catch (e) { console.error(e); }
  };

  const handleAcceptFriend = async (req) => {
    try { await base44.entities.Friend.update(req.id, { status: 'accepted' }); await queryClient.invalidateQueries({ queryKey: ['community'] }); } catch (e) { console.error(e); }
  };

  const handleDeclineFriend = async (req) => {
    try { await base44.entities.Friend.update(req.id, { status: 'declined' }); await queryClient.invalidateQueries({ queryKey: ['community'] }); } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt message="Log in to connect with riders" />;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <h1 className="mb-4 text-2xl font-bold">Community</h1>
        <Tabs defaultValue="groups">
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
            <TabsTrigger value="friends" className="flex-1">Friends</TabsTrigger>
            <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0">
            <div className="flex gap-2">
              <Button className="min-h-[48px] flex-1" onClick={() => setCreateOpen(true)}><Users size={18} className="mr-2" /> Create</Button>
              <Button variant="secondary" className="min-h-[48px] flex-1" onClick={() => setJoinOpen(true)}><Ticket size={18} className="mr-2" /> Join</Button>
            </div>
            {!isPremium && <p className="text-xs text-muted-foreground">Free tier: max 2 riders per group. Upgrade to Premium for 32 riders.</p>}
            {myGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Users size={48} className="text-muted-foreground" />
                <p className="text-muted-foreground">No groups yet. Create one or join with an invite code.</p>
              </div>
            ) : (
              myGroups.map((g) => {
                const memberCount = memberships.filter((m) => m.group_id === g.id).length;
                return (
                  <div key={g.id} className="rounded-2xl bg-card p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-bold">{g.name}</h3>
                        <p className="text-sm text-muted-foreground">{memberCount}/{g.max_members} riders</p>
                      </div>
                      <Badge variant="outline">{g.invite_code}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={() => handleLeaveGroup(g.id)}>
                      <LogOut size={14} className="mr-1" /> Leave
                    </Button>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="friends" className="space-y-3">
            {!isPremium && (
              <div className="rounded-2xl bg-card p-4 text-center">
                <Siren size={24} className="mx-auto mb-2 text-primary" />
                <p className="text-sm text-muted-foreground">Friends network is a Premium feature. Upgrade to connect with riders.</p>
              </div>
            )}
            {pendingReqs.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Pending Requests</p>
                {pendingReqs.map((req) => (
                  <div key={req.id} className="flex items-center justify-between rounded-2xl bg-card p-3">
                    <span className="font-medium">{req.requester_name}</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleAcceptFriend(req)}>Accept</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDeclineFriend(req)}>Decline</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {isPremium && (
              <Button className="min-h-[48px] w-full" onClick={() => setAddFriendOpen(true)}><UserPlus size={18} className="mr-2" /> Add Friend</Button>
            )}
            {friends.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Users size={48} className="text-muted-foreground" />
                <p className="text-muted-foreground">{isPremium ? 'No friends yet. Add riders by their MotoGo code.' : 'Upgrade to Premium to add friends.'}</p>
              </div>
            ) : (
              friends.map((f) => {
                const name = f.requester_id === user.id ? f.recipient_name : f.requester_name;
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-2xl bg-card p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">{name?.[0]?.toUpperCase() || '?'}</div>
                    <span className="font-medium">{name || 'Unknown Rider'}</span>
                  </div>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="services">
            <ServicesTab user={user} />
          </TabsContent>
        </Tabs>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Create Group</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Group Name</Label>
              <Input value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} placeholder="Sunday Breakfast Run" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button onClick={handleCreateGroup}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Join Group</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Invite Code</Label>
              <Input value={joinCode} onChange={(e) => setJoinCode(e.target.value)} placeholder="ABC123" className="uppercase" />
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setJoinOpen(false)}>Cancel</Button>
              <Button onClick={handleJoinGroup}>Join</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={addFriendOpen} onOpenChange={setAddFriendOpen}>
          <DialogContent>
            <DialogHeader><DialogTitle>Add Friend</DialogTitle></DialogHeader>
            <div className="space-y-2">
              <Label>Rider Code</Label>
              <Input value={friendCode} onChange={(e) => setFriendCode(e.target.value)} placeholder="Enter rider's MotoGo code" />
              <p className="text-xs text-muted-foreground">Ask your friend for their MotoGo code from their Profile page.</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAddFriendOpen(false)}>Cancel</Button>
              <Button onClick={handleAddFriend}>Send Request</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </PullToRefresh>
  );
}