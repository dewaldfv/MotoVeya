import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { UserPlus, Check, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/components/AuthLayout';

const WEB_FALLBACK = 'https://web-motoveya.base44.app';

function isInstalledApp() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
}

export default function FriendRequest() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState({ status: 'loading', name: '', message: '' });
  const cleanCode = useMemo(() => decodeURIComponent(code || '').trim(), [code]);

  useEffect(() => {
    if (!cleanCode) {
      setState({ status: 'error', name: '', message: 'This friend link is invalid.' });
      return;
    }

    // Smart-link behaviour: a normal browser is the web fallback; an
    // installed MotoVeya PWA stays inside the app and processes the invite.
    if (!isInstalledApp()) {
      window.location.replace(`${WEB_FALLBACK}/friend/${encodeURIComponent(cleanCode)}`);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const authed = await base44.auth.isAuthenticated();
        if (!authed) {
          const returnTo = `/friend/${encodeURIComponent(cleanCode)}`;
          navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`, { replace: true });
          return;
        }

        const me = await base44.auth.me();
        if (me.id === cleanCode) {
          setState({ status: 'error', name: '', message: "You can't add yourself as a friend." });
          return;
        }
        if (me.subscription_tier !== 'premium') {
          setState({ status: 'error', name: '', message: 'Friend requests are a Premium feature. Upgrade in MotoVeya to connect with riders.' });
          return;
        }

        const existing = await Promise.all([
          base44.entities.Friend.filter({ requester_id: me.id, recipient_id: cleanCode }),
          base44.entities.Friend.filter({ requester_id: cleanCode, recipient_id: me.id }),
        ]);
        const relation = [...(existing[0] || []), ...(existing[1] || [])][0];
        if (relation?.status === 'accepted') {
          setState({ status: 'accepted', name: 'MotoVeya rider', message: 'You are already friends.' });
          return;
        }
        if (relation?.status === 'pending') {
          setState({ status: 'pending', name: 'MotoVeya rider', message: 'A friend request is already pending.' });
          return;
        }

        await base44.entities.Friend.create({
          requester_id: me.id,
          requester_name: me.nickname || me.full_name || me.email,
          recipient_id: cleanCode,
          recipient_name: 'MotoVeya rider',
          status: 'pending',
        });
        try {
          await base44.functions.invoke('messaging-secure', { action: 'notify_friend_request', recipient_id: cleanCode });
        } catch (e) {
          console.error('friend request notification', e);
        }
        if (!cancelled) setState({ status: 'sent', name: 'MotoVeya rider', message: 'Friend request sent successfully.' });
      } catch (e) {
        console.error('friend link', e);
        if (!cancelled) setState({ status: 'error', name: '', message: 'We could not process this friend request. Please try again.' });
      }
    })();

    return () => { cancelled = true; };
  }, [cleanCode, navigate]);

  const loading = state.status === 'loading';
  const success = ['sent', 'pending', 'accepted'].includes(state.status);

  return (
    <AuthLayout
      icon={success ? Check : UserPlus}
      title={loading ? 'Connecting…' : success ? 'Friend Request' : 'Friend Link'}
      subtitle={loading ? 'Checking the MotoVeya rider link' : state.message}
      footer={success ? <Link to="/community" className="text-primary font-medium hover:underline">Open MotoVeya Community</Link> : null}
    >
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {state.name && <div className="rounded-2xl bg-secondary p-4 text-center font-bold">{state.name}</div>}
          {state.status === 'error' && <p className="text-center text-sm text-destructive">{state.message}</p>}
          {success && <Button className="h-12 w-full" onClick={() => navigate('/')}>Open MotoVeya</Button>}
          {state.status === 'error' && <Button variant="outline" className="h-12 w-full" onClick={() => navigate('/login')}>Log In</Button>}
        </div>
      )}
    </AuthLayout>
  );
}
