import { useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, Plus, ArrowLeft, Users, Archive, Trash2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import BottomSheet from '@/components/BottomSheet';
import useUnreadCount from '@/hooks/useUnreadCount';
import { toast } from 'sonner';

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

export default function ConversationList({ user, onSelect }) {
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [actionConv, setActionConv] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  const unreadCount = useUnreadCount(!!user);

  // Clear the dot the moment a conversation is opened; the server confirms it
  // when the thread marks the conversation as read.
  const openConversation = (conv) => {
    if (conv.unread) {
      queryClient.setQueryData(['conversations'], (old = []) =>
        (old || []).map((c) => (c.id === conv.id ? { ...c, unread: false } : c))
      );
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] });
    }
    onSelect(conv);
  };

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => {
      const res = await base44.functions.invoke('messaging-secure', { action: 'conversations' });
      return res.data?.conversations || [];
    },
    refetchInterval: 15000,
  });

  const { data: friends = [] } = useQuery({
    queryKey: ['msg-friends'],
    queryFn: async () => {
      const all = await base44.entities.Friend.filter({ status: 'accepted' }, '-created_date', 100);
      return (all || [])
        .map((f) => {
          const isRequester = f.requester_id === user.id;
          return {
            id: isRequester ? f.recipient_id : f.requester_id,
            name: isRequester ? f.recipient_name : f.requester_name,
          };
        })
        .filter((f) => f.id && f.name);
    },
    enabled: !!showNew,
  });

  const startNew = (friend) => {
    setShowNew(false);
    onSelect({ other_participant_id: friend.id, other_participant_name: friend.name });
  };

  const startPress = (conv) => {
    longPressed.current = false;
    pressTimer.current = setTimeout(() => {
      longPressed.current = true;
      setActionConv(conv);
    }, 500);
  };
  const cancelPress = () => {
    if (pressTimer.current) { clearTimeout(pressTimer.current); pressTimer.current = null; }
  };

  const handleArchive = async () => {
    const conv = actionConv;
    setActionConv(null);
    if (!conv) return;
    try {
      await base44.functions.invoke('messaging-secure', { action: 'archive_conversation', conversation_id: conv.id });
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      toast.success('Chat archived');
    } catch (e) { console.error(e); toast.error('Could not archive chat'); }
  };

  const handleDelete = async () => {
    const conv = confirmDelete;
    setConfirmDelete(null);
    if (!conv) return;
    try {
      await base44.functions.invoke('messaging-secure', { action: 'delete_conversation', conversation_id: conv.id });
      // Drop it from the list immediately, then confirm against the server.
      queryClient.setQueryData(['conversations'], (old = []) => (old || []).filter((c) => c.id !== conv.id));
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      queryClient.invalidateQueries({ queryKey: ['unread-messages'] });
      toast.success('Chat deleted');
    } catch (e) {
      console.error(e);
      const msg = e?.response?.data?.error || e?.data?.error || e?.message;
      toast.error(msg || 'Could not delete chat');
    }
  };

  if (showNew) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setShowNew(false)}>
            <ArrowLeft size={20} />
          </Button>
          <h3 className="font-bold">New Message</h3>
        </div>
        {friends.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No friends to message yet.</p>
        ) : (
          friends.map((f) => (
            <button
              key={f.id}
              onClick={() => startNew(f)}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left transition-transform active:scale-[0.98]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                {f.name?.charAt(0)?.toUpperCase()}
              </div>
              <span className="font-medium">{f.name}</span>
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-bold">Messages</h3>
          {unreadCount > 0 && (
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        <Button size="sm" onClick={() => setShowNew(true)}>
          <Plus size={16} className="mr-1" /> New
        </Button>
      </div>
      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="h-6 w-6 animate-spin rounded-full border-4 border-secondary border-t-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <MessageCircle size={40} className="text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No conversations yet. Tap "New" to message a friend.</p>
        </div>
      ) : (
        conversations.map((c) => (
          <div key={c.id} className="relative">
            <button
              onClick={() => { if (!longPressed.current) openConversation(c); }}
              onTouchStart={() => startPress(c)}
              onTouchEnd={cancelPress}
              onTouchMove={cancelPress}
              onMouseDown={() => startPress(c)}
              onMouseUp={cancelPress}
              onMouseLeave={cancelPress}
              className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 pr-14 text-left transition-transform active:scale-[0.98] select-none"
            >
              {c.is_group ? (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Users size={20} className="text-primary" />
                </div>
              ) : (
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
                  {c.other_participant_name?.charAt(0)?.toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="flex min-w-0 items-center gap-2 truncate font-semibold">
                    <span className="truncate">{c.is_group ? c.group_name : c.other_participant_name}</span>
                    {c.unread && (
                      <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="Unread messages" />
                    )}
                  </span>
                  {c.last_message_at && (
                    <span className={`ml-2 shrink-0 text-xs ${c.unread ? 'font-semibold text-primary' : 'text-muted-foreground'}`}>
                      {timeAgo(c.last_message_at)}
                    </span>
                  )}
                </div>
                <p className={`truncate text-sm ${c.unread ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                  {c.last_sender_id === user.id ? 'You: ' : ''}
                  {c.last_message_preview || (c.is_group ? 'Start the group chat' : 'Say hi!')}
                </p>
              </div>
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); setConfirmDelete(c); }}
              onTouchStart={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              aria-label="Delete chat"
              title="Delete chat"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive active:scale-95"
            >
              <Trash2 size={17} />
            </button>
          </div>
        ))
      )}

      <BottomSheet open={!!actionConv} onClose={() => setActionConv(null)} title={actionConv ? (actionConv.is_group ? actionConv.group_name : actionConv.other_participant_name) : ''}>
        <div className="space-y-2">
          <button
            onClick={handleArchive}
            className="flex w-full items-center gap-3 rounded-2xl bg-secondary p-4 text-left font-medium active:scale-[0.98]"
          >
            <Archive size={20} className="text-primary" /> Archive Chat
          </button>
          <button
            onClick={() => { setActionConv(null); setConfirmDelete(actionConv); }}
            className="flex w-full items-center gap-3 rounded-2xl bg-destructive/10 p-4 text-left font-medium text-destructive active:scale-[0.98]"
          >
            <Trash2 size={20} /> Delete Chat
          </button>
        </div>
      </BottomSheet>

      <BottomSheet open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Delete this chat?">
        <p className="text-sm text-muted-foreground">This will permanently remove the conversation and all its messages.</p>
        <div className="mt-4 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={() => setConfirmDelete(null)}>Cancel</Button>
          <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
        </div>
      </BottomSheet>
    </div>
  );
}