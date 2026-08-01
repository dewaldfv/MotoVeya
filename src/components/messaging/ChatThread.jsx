import { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Send, Users } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function ChatThread({ user, conversation, onBack }) {
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [convId, setConvId] = useState(conversation.id || null);
  const isGroup = !!conversation.is_group || !!conversation.group_id;
  const recipient = useRef({
    id: conversation.other_participant_id,
    name: conversation.other_participant_name,
  });
  const groupName = useRef(conversation.group_name || 'Group chat');
  const scrollRef = useRef(null);

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', convId],
    queryFn: async () => {
      if (!convId) return [];
      const res = await base44.functions.invoke('messaging-secure', { action: 'messages', conversation_id: convId });
      return res.data?.messages || [];
    },
    enabled: !!convId,
    refetchInterval: 10000,
  });

  useEffect(() => {
    if (convId) {
      base44.functions.invoke('messaging-secure', { action: 'mark_read', conversation_id: convId }).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    }
  }, [convId, queryClient]);

  useEffect(() => {
    if (!convId) return;
    const unsub = base44.entities.Message.subscribe((event) => {
      const m = event.data;
      if (!m || m.conversation_id !== convId) return;
      queryClient.setQueryData(['messages', convId], (old = []) => {
        if (old.some((x) => x.id === m.id)) return old;
        return [...old, m];
      });
      if (m.sender_id !== user.id) {
        base44.functions.invoke('messaging-secure', { action: 'mark_read', conversation_id: convId }).catch(() => {});
      }
    });
    return unsub;
  }, [convId, user.id, queryClient]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content) return;
    setText('');
    try {
      const res = await base44.functions.invoke('messaging-secure', isGroup ? {
        action: 'send_group',
        conversation_id: convId,
        content,
      } : {
        action: 'send',
        recipient_id: recipient.current.id,
        recipient_name: recipient.current.name,
        content,
      });
      const newMessage = res.data?.message;
      const newConvId = res.data?.conversation_id;
      if (newConvId && newConvId !== convId) {
        setConvId(newConvId);
      } else if (newMessage) {
        queryClient.setQueryData(['messages', convId], (old = []) => {
          if (old.some((x) => x.id === newMessage.id)) return old;
          return [...old, newMessage];
        });
      }
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (e) {
      console.error(e);
      setText(content);
    }
  };

  const headerName = isGroup ? groupName.current : (conversation.other_participant_name || recipient.current.name || 'Rider');

  return (
    <div className="flex h-[calc(100vh-13rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0">
          <ArrowLeft size={20} />
        </Button>
        <div className="flex min-w-0 items-center gap-2">
          {isGroup ? (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
              <Users size={18} className="text-primary" />
            </div>
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {headerName?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <span className="block truncate font-bold">{headerName}</span>
            {isGroup && <span className="block text-[11px] text-muted-foreground">Group chat</span>}
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="no-scrollbar flex-1 space-y-2 overflow-y-auto py-3">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-6 w-6 animate-spin rounded-full border-4 border-secondary border-t-primary" />
          </div>
        ) : messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            {isGroup ? 'Send the first message to the group!' : 'Start the conversation — say hi!'}
          </p>
        ) : (
          messages.map((m) => {
            const isMe = m.sender_id === user.id;
            return (
              <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                    isMe ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card text-card-foreground'
                  }`}
                >
                  {isGroup && !isMe && (
                    <p className="mb-0.5 text-[11px] font-semibold text-primary">{m.sender_name || 'Rider'}</p>
                  )}
                  {m.content}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border pt-3">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
          placeholder="Type a message..."
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!text.trim() || (isGroup && !convId)} className="h-11 w-11 shrink-0">
          <Send size={18} />
        </Button>
      </div>
    </div>
  );
}