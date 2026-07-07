import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageCircle, Plus, ArrowLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';

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
  const [showNew, setShowNew] = useState(false);

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
        <h3 className="font-bold">Messages</h3>
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
          <button
            key={c.id}
            onClick={() => onSelect(c)}
            className="flex w-full items-center gap-3 rounded-2xl bg-card p-3 text-left transition-transform active:scale-[0.98]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-base font-bold text-primary">
              {c.other_participant_name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate font-semibold">{c.other_participant_name}</span>
                {c.last_message_at && (
                  <span className="ml-2 shrink-0 text-xs text-muted-foreground">{timeAgo(c.last_message_at)}</span>
                )}
              </div>
              <p className="truncate text-sm text-muted-foreground">
                {c.last_sender_id === user.id ? 'You: ' : ''}
                {c.last_message_preview || 'Say hi!'}
              </p>
            </div>
          </button>
        ))
      )}
    </div>
  );
}