import { Map, Route, Calendar, Users, User } from 'lucide-react';
import { useTabHistory } from '@/lib/TabHistoryContext';
import useKeyboardVisible from '@/hooks/useKeyboardVisible';

const navItems = [
  { key: 'map', icon: Map, label: 'Map' },
  { key: 'rides', icon: Route, label: 'Rides' },
  { key: 'events', icon: Calendar, label: 'Events' },
  { key: 'community', icon: Users, label: 'Community' },
  { key: 'profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const { currentTab, switchToTab } = useTabHistory();
  const keyboardVisible = useKeyboardVisible();

  return (
    <nav
      className={`fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg transition-transform duration-200 ${
        keyboardVisible ? 'translate-y-full' : 'translate-y-0'
      }`}
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2 landscape:py-1">
        {navItems.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => switchToTab(key)}
            className={`flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
              currentTab === key ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <Icon size={26} strokeWidth={2.2} />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}