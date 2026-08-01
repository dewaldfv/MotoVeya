import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, UserPlus, Ticket, LogOut, Siren, QrCode as QrIcon, Share2 } from 'lucide-react';
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
import QrScanner from '@/components/QrScanner';
import ShareCodeSheet from '@/components/ShareCodeSheet';
import GroupMembersDialog from '@/components/community/GroupMembersDialog';
import FriendsDashboard from '@/components/community/FriendsDashboard';
import GroupRidesList from '@/components/grouprides/GroupRidesList';
import MessagesTab from '@/components/messaging/MessagesTab';
import { toast } from 'sonner';

function generateCode() { return Math.random().toString(36).substring(2, 8).toUpperCase(); }

export default function Community() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => location.state?.tab || 'groups');
  const [messageConversationId, setMessageConversationId] = useState(() => location.state?.conversationId || null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [addFriendOpen, setAddFriendOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [friendCode, setFriendCode] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState('auto');
  const [share, setShare] = useState(null);
  const [membersGroup, setMembersGroup] = useState(null);

  useEffect(() => {
    if (location.state?.tab) setActiveTab(location.state.tab);
    if (location.state?.conversationId) setMessageConversationId(location.state.conversationId);
  }, [location.state]);

  useEffect(() => {
    const unsubscribe = base44.entities.GroupMember.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ['community'] });
    });
    return unsubscribe;
  }, [queryClient]);

  const { data, isLoading } = useQuery({
    queryKey: ['community'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return null;
      const me = await base44.auth.me();
      const [groups, friends, memberships, pending, invites] = await Promise.all([
        base44.entities.Group.filter({ is_active: true }, '-created_date', 50),
        base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 50),
        base44.entities.GroupMember.filter({ user_id: me.id, status: 'active' }, '-created_date', 50),
        base44.entities.Friend.filter({ recipient_id: me.id, status: 'pending' }, '-created_date', 20),
        base44.entities.Notification.filter({ recipient_id: me.id, type: 'ride_invite', is_read: false }, '-created_date', 20),
      ]);
      const groupIds = (memberships || []).map((m) => m.group_id);
      let groupMembers = [];
      if (groupIds.length > 0) {
        const results = await Promise.all(
          groupIds.map((id) => base44.entities.GroupMember.filter({ group_id: id, status: 'active' }, '-created_date', 50))
        );
        groupMembers = results.flat();
      }
      return { user: me, groups: groups || [], friends: friends || [], memberships: memberships || [], groupMembers: groupMembers || [], pending: pending || [], invites: invites || [] };
    },
  });

  const user = data?.user ?? null;
  const groups = data?.groups ?? [];
  const friends = data?.friends ?? [];
  const memberships = data?.memberships ?? [];
  const groupMembers = data?.groupMembers ?? [];
  const pendingReqs = data?.pending ?? [];
  const rideInvites = data?.invites ?? [];

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

  const joinGroupByCode = async (rawCode) => {
    const code = rawCode.trim().toUpperCase();
    if (!code) return false;
    try {
      const found = await base44.entities.Group.filter({ invite_code: code });
      if (found.length === 0) { toast.error('Invalid invite code'); return false; }
      const grp = found[0];
      const existing = memberships.find((m) => m.group_id === grp.id);
      if (existing) { toast.info('Already a member'); return true; }
      const members = await base44.entities.GroupMember.filter({ group_id: grp.id, status: 'active' });
      if (members.length >= grp.max_members) { toast.error('Group is full'); return false; }
      await joinGroupMutation.mutateAsync({ group: grp, user });
      toast.success(`Joined ${grp.name}`);
      return true;
    } catch (e) { console.error(e); toast.error('Could not join group'); return false; }
  };

  const handleJoinGroup = async () => {
    if (!joinCode.trim()) return;
    await joinGroupByCode(joinCode);
    setJoinOpen(false); setJoinCode('');
  };

  const handleLeaveGroup = async (groupId) => {
    try {
      const myMembership = memberships.find((m) => m.group_id === groupId);
      if (myMembership) await base44.entities.GroupMember.update(myMembership.id, { status: 'left' });
      await queryClient.invalidateQueries({ queryKey: ['community'] });
    } catch (e) { console.error(e); }
  };

  const addFriendByCode = async (rawCode) => {
    const code = rawCode.trim();
    if (!code) return false;
    if (code === user.id) { toast.error("You can't add yourself"); return false; }
    try {
      await base44.entities.Friend.create({ requester_id: user.id, requester_name: user.nickname || user.full_name, recipient_id: code, recipient_name: 'Pending', status: 'pending' });
      toast.success('Friend request sent');
      return true;
    } catch (e) { console.error(e); toast.error('Could not send request'); return false; }
  };

  const handleAddFriend = async () => {
    if (!friendCode.trim()) return;
    const ok = await addFriendByCode(friendCode);
    if (ok) { setAddFriendOpen(false); setFriendCode(''); }
  };

  const handleScan = async (text, scanMode) => {
    const t = (text || '').trim();
    const m = t.match(/^motogo:\/\/(friend|group)\?code=(.+)$/);
    if (m) {
      const code = decodeURIComponent(m[2]);
      return m[1] === 'group' ? await joinGroupByCode(code) : await addFriendByCode(code);
    }
    if (scanMode === 'group' && t) return await joinGroupByCode(t);
    if (scanMode === 'friend' && t) return await addFriendByCode(t);
    toast.error('Not a MotoGo QR code');
    return false;
  };

  const handleAcceptFriend = async (req) => {
    try { await base44.entities.Friend.update(req.id, { status: 'accepted' }); await queryClient.invalidateQueries({ queryKey: ['community'] }); } catch (e) { console.error(e); }
  };

  const handleDeclineFriend = async (req) => {
    try { await base44.entities.Friend.update(req.id, { status: 'declined' }); await queryClient.invalidateQueries({ queryKey: ['community'] }); } catch (e) { console.error(e); }
  };

  const handleJoinInvite = async (inv) => {
    let info = {};
    try { info = JSON.parse(inv.data) || {}; } catch (e) { console.error(e); }
    try { await base44.entities.Notification.update(inv.id, { is_read: true }); } catch (e) { console.error(e); }
    if (info.group_ride_id) {
      navigate(`/ride/group/${info.group_ride_id}`);
    } else if (info.lat != null && info.lng != null) {
      navigate('/ride/active', { state: { destination: { lat: info.lat, lng: info.lng, name: info.name || 'Group ride' } } });
    } else {
      toast.error('Destination unavailable');
    }
  };

  const handleDismissInvite = async (inv) => {
    try { await base44.entities.Notification.update(inv.id, { is_read: true }); await queryClient.invalidateQueries({ queryKey: ['community'] }); } catch (e) { console.error(e); }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-4 border-secondary border-t-primary" /></div>;
  if (!user) return <LoginPrompt message="Log in to connect with riders" />;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <h1 className="mb-4 text-2xl font-bold">Community</h1>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4 w-full">
            <TabsTrigger value="groups" className="flex-1">Groups</TabsTrigger>
            <TabsTrigger value="friends" className="flex-1">Friends</TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">Messages</TabsTrigger>
            <TabsTrigger value="services" className="flex-1">Services</TabsTrigger>
          </TabsList>

          <TabsContent value="groups" className="space-y-4">
            <GroupRidesList user={user} groups={groups} memberships={memberships} />
            <div className="space-y-3 landscape:grid landscape:grid-cols-2 landscape:gap-3 landscape:space-y-0">
              <div className="flex gap-2">
                <Button className="min-h-[48px] flex-1" onClick={() => setCreateOpen(true)}><Users size={18} className="mr-2" /> Create</Button>
                <Button variant="secondary" className="min-h-[48px] flex-1" onClick={() => setJoinOpen(true)}><Ticket size={18} className="mr-2" /> Join</Button>
                <Button variant="secondary" className="min-h-[48px] flex-1" onClick={() => { setScannerMode('group'); setScannerOpen(true); }}><QrIcon size={18} className="mr-2" /> Scan</Button>
              </div>
            {!isPremium && <p className="text-xs text-muted-foreground">Free tier: max 2 riders per group. Upgrade to Premium for 32 riders.</p>}
            {myGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Users size={48} className="text-muted-foreground" />
                <p className="text-muted-foreground">No groups yet. Create one or join with an invite code.</p>
              </div>
            ) : (
              myGroups.map((g) => {
                const memberCount = groupMembers.filter((m) => m.group_id === g.id).length;
                return (
                  <div key={g.id} className="rounded-2xl bg-card p-4">
                    <button
                      type="button"
                      onClick={() => setMembersGroup(g)}
                      className="flex w-full items-start justify-between gap-2 text-left transition-opacity active:opacity-70"
                    >
                      <div className="min-w-0">
                        <h3 className="font-bold">{g.name}</h3>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Users size={14} className="shrink-0 text-primary" />
                          <span className="text-sm font-semibold text-primary">{memberCount}</span>
                          <span className="text-sm text-muted-foreground">/ {g.max_members} riders</span>
                        </div>
                      </div>
                      <Badge variant="outline" className="shrink-0">{g.invite_code}</Badge>
                    </button>
                    <div className="mt-2 flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setShare({ title: g.name, code: g.invite_code, qrData: `motogo://group?code=${g.invite_code}`, description: 'Group invite code' })}>
                        <Share2 size={14} className="mr-1" /> Share
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleLeaveGroup(g.id)}>
                        <LogOut size={14} className="mr-1" /> Leave
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
            </div>
          </TabsContent>

          <TabsContent value="friends" className="space-y-3">
            {rideInvites.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-muted-foreground">Ride Invites</p>
                {rideInvites.map((inv) => (
                  <div key={inv.id} className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
                    <p className="text-sm font-bold">{inv.title}</p>
                    {inv.body && <p className="mt-0.5 text-xs text-muted-foreground">{inv.body}</p>}
                    <div className="mt-2 flex gap-2">
                      <Button size="sm" onClick={() => handleJoinInvite(inv)}>Join Ride</Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDismissInvite(inv)}>Dismiss</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              <div className="flex gap-2">
                <Button className="min-h-[48px] flex-1" onClick={() => setAddFriendOpen(true)}><UserPlus size={18} className="mr-2" /> Add</Button>
                <Button variant="secondary" className="min-h-[48px] flex-1" onClick={() => { setScannerMode('friend'); setScannerOpen(true); }}><QrIcon size={18} className="mr-2" /> Scan</Button>
                <Button variant="secondary" className="min-h-[48px] flex-1" onClick={() => setShare({ title: 'My MotoGo Code', code: user.id, qrData: `motogo://friend?code=${user.id}`, description: 'Share to add as friend' })}><Share2 size={18} className="mr-2" /> My Code</Button>
              </div>
            )}
            {isPremium && <FriendsDashboard user={user} friends={friends} />}
          </TabsContent>

          <TabsContent value="messages">
            <MessagesTab user={user} initialConversationId={messageConversationId} />
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

        <QrScanner open={scannerOpen} mode={scannerMode} onClose={() => setScannerOpen(false)} onScan={handleScan} />
        <ShareCodeSheet open={!!share} onClose={() => setShare(null)} title={share?.title} code={share?.code} qrData={share?.qrData} description={share?.description} />
        <GroupMembersDialog group={membersGroup} open={!!membersGroup} onOpenChange={(v) => !v && setMembersGroup(null)} />
      </div>
    </PullToRefresh>
  );
}