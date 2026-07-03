import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';

export default function AppLayout() {
  return (
    <div className="relative min-h-screen bg-background">
      <Outlet />
      <BottomNav />
    </div>
  );
}