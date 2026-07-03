import { NavLink } from 'react-router-dom';
import { Map, Route, Calendar, Users, User } from 'lucide-react';

const navItems = [
  { to: '/', icon: Map, label: 'Map' },
  { to: '/rides', icon: Route, label: 'Rides' },
  { to: '/events', icon: Calendar, label: 'Events' },
  { to: '/community', icon: Users, label: 'Community' },
  { to: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
        {navItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `flex min-h-[56px] min-w-[56px] flex-col items-center justify-center gap-1 rounded-xl transition-colors ${
                isActive ? 'text-primary' : 'text-muted-foreground'
              }`
            }
          >
            <Icon size={26} strokeWidth={2.2} />
            <span className="text-[11px] font-semibold">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}