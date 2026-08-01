import { useState } from 'react';
import ConversationList from '@/components/messaging/ConversationList';
import ChatThread from '@/components/messaging/ChatThread';

export default function MessagesTab({ user, initialConversation }) {
  const [activeConversation, setActiveConversation] = useState(initialConversation || null);

  if (activeConversation) {
    return (
      <ChatThread
        user={user}
        conversation={activeConversation}
        onBack={() => setActiveConversation(null)}
      />
    );
  }

  return <ConversationList user={user} onSelect={setActiveConversation} />;
}