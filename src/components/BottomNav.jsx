import { Map, Route, Calendar, Users, User } from 'lucide-react';
import { useTabHistory } from '@/lib/TabHistoryContext';
import useKeyboardVisible from '@/hooks/useKeyboardVisible';

const navItems = [
{ key: 'map', icon: Map, label: 'Map' },
{ key: 'rides', icon: Route, label: 'Rides' },
{ key: 'events', icon: Calendar, label: 'Events' },
{ key: 'community', icon: Users, label: 'Community' },
{ key: 'profile', icon: User, label: 'Profile' }];


export default function BottomNav() {
  const { currentTab, switchToTab } = useTabHistory();
  const keyboardVisible = useKeyboardVisible();

  return (
    <nav
      className={`fixed left-4 right-4 z-40 rounded-[20px] border border-border backdrop-blur-lg transition-transform duration-200 opacity-100 ${
      keyboardVisible ? 'translate-y-full' : 'translate-y-0'}`
      }
      style={{
        bottom: 'calc(env(safe-area-inset-bottom) + 8px)',
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.08)'
      }}>
      
      <div className="mx-auto flex max-w-2xl items-center justify-around gap-1 px-2 landscape:py-1 my-1">
        {navItems.map(({ key, icon: Icon, label }) =>
        <button
          key={key}
          onClick={() => switchToTab(key)}
          className={`flex min-h-[50px] min-w-[50px] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors bg-[hsl(var(--card))] opacity-100 ${
          currentTab === key ? 'text-primary' : 'text-muted-foreground'}`
          }>
          
            <Icon size={24} strokeWidth={2.2} />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        )}
      </div>
    </nav>);

}