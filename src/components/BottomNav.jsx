import { Map, Route, Calendar, Users, User, Clapperboard, Store } from 'lucide-react';
import { useTabHistory } from '@/lib/TabHistoryContext';
import useKeyboardVisible from '@/hooks/useKeyboardVisible';
import { useAuth } from '@/lib/AuthContext';
import { isProviderOnlyAccount, isOrganizerOnlyAccount, canManageServices } from '@/lib/plans';

const navItems = [
{ key: 'map', icon: Map, label: 'Map' },
{ key: 'rides', icon: Route, label: 'Rides' },
{ key: 'events', icon: Calendar, label: 'Events' },
{ key: 'community', icon: Users, label: 'Community' },
{ key: 'crowd-clips', icon: Clapperboard, label: 'Clips' },
{ key: 'profile', icon: User, label: 'Profile' }];

const providerItem = { key: 'provider', icon: Store, label: 'Dashboard' };


export default function BottomNav({ hidden = false }) {
  const { currentTab, switchToTab } = useTabHistory();
  const keyboardVisible = useKeyboardVisible();
  const { user } = useAuth();
  const isProvider = isProviderOnlyAccount(user);
  const isOrganizer = isOrganizerOnlyAccount(user);
  // The Service Provider and Organizer packages both lose the Rides tab; both keep
  // Community for chats only.
  const baseItems = isProvider || isOrganizer
    ? navItems.filter((item) => item.key !== 'rides')
    : navItems;
  // Providers and staff reach their dashboard right after Events.
  const visible = canManageServices(user)
    ? baseItems.reduce((acc, item) => item.key === 'events' ? [...acc, item, providerItem] : [...acc, item], [])
    : baseItems;

  return (
    <nav
      className={`fixed left-4 right-4 z-40 rounded-[20px] border border-border backdrop-blur-lg transition-all duration-300 ${
      (keyboardVisible || hidden) ? 'translate-y-full opacity-0 pointer-events-none' : 'translate-y-0 opacity-100'}`
      }
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.08)'
      }}>
      
      <div className="mx-auto flex max-w-2xl items-center justify-around gap-0.5 px-1.5 landscape:py-1 my-1">
        {visible.map(({ key, icon: Icon, label }) =>
        <button
          key={key}
          onClick={() => switchToTab(key)}
          className={`flex min-h-[46px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-xl transition-colors bg-[hsl(var(--card))] opacity-100 ${
          currentTab === key ? 'text-primary' : 'text-muted-foreground'}`
          }>
          
            <Icon size={21} strokeWidth={2.2} />
            <span className="text-[10px] font-semibold leading-tight">{label}</span>
          </button>
        )}
      </div>
    </nav>);

}