import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import ServicesTab from '@/components/services/ServicesTab';
import PullToRefresh from '@/components/PullToRefresh';

export default function Services() {
  const { data } = useQuery({
    queryKey: ['services-page-user'],
    queryFn: async () => {
      const authed = await base44.auth.isAuthenticated();
      if (!authed) return { user: null };
      return { user: await base44.auth.me() };
    },
  });

  return (
    <PullToRefresh>
      <div className="min-h-screen bg-background p-4 pb-24" style={{ paddingTop: 'calc(1rem + env(safe-area-inset-top))' }}>
        <div className="mb-4 flex items-center gap-3">
          <Link
            to="/events"
            className="glove-target flex items-center justify-center rounded-xl bg-card px-2 shadow-sm"
            aria-label="Back to events"
          >
            <ChevronLeft size={22} />
          </Link>
          <h1 className="text-2xl font-bold">Services</h1>
        </div>
        <ServicesTab user={data?.user ?? null} />
      </div>
    </PullToRefresh>
  );
}