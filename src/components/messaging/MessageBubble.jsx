import { Check, CheckCheck } from 'lucide-react';
import moment from 'moment';

const formatStamp = (value) => {
  const m = moment(value);
  if (!m.isValid()) return '';
  if (m.isSame(moment(), 'day')) return `Today ${m.format('HH:mm')}`;
  if (m.isSame(moment().subtract(1, 'day'), 'day')) return `Yesterday ${m.format('HH:mm')}`;
  return m.format('D MMM YYYY, HH:mm');
};

export default function MessageBubble({ message, isMe, isGroup }) {
  const stamp = formatStamp(message.created_date);
  const receipt = isMe ? (message.read_at ? 'Read' : message.delivered_at ? 'Delivered' : 'Sent') : null;

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex max-w-[75%] flex-col gap-1 ${isMe ? 'items-end' : 'items-start'}`}>
        <div
          className={`rounded-2xl px-3.5 py-2 text-sm ${
            isMe ? 'rounded-br-md bg-primary text-primary-foreground' : 'rounded-bl-md bg-card text-card-foreground'
          }`}
        >
          {isGroup && !isMe && (
            <p className="mb-0.5 text-[11px] font-semibold text-primary">{message.sender_name || 'Rider'}</p>
          )}
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        </div>
        <div className="flex items-center gap-1.5 px-1 text-[10px] text-muted-foreground">
          <span>{stamp}</span>
          {receipt && (
            <span className={`flex items-center gap-0.5 font-semibold ${receipt === 'Read' ? 'text-primary' : ''}`}>
              {receipt === 'Read' ? <CheckCheck size={11} /> : <Check size={11} />}
              {receipt}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}