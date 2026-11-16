import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

// Unread direct/group message conversations for the signed-in rider.
// Shared by the Community nav badge and the app-icon badge.
export default function useUnreadCount(enabled = true) {
  const { data = 0 } = useQuery({
    queryKey: ['unread-messages'],
    queryFn: async () => {
      const res = await base44.functions.invoke('messaging-secure', { action: 'unread_count' });
      return res.data?.total || 0;
    },
    enabled,
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
  });
  return data;
}