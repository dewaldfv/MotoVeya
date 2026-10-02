import { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TabHistoryContext = createContext(null);

const TAB_ROOTS = {
  map: '/',
  rides: '/rides',
  events: '/events',
  community: '/community',
  'crowd-clips': '/crowd-clips',
  profile: '/profile',
};

export function getTabFromPath(pathname) {
  if (pathname.startsWith('/rides')) return 'rides';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/community')) return 'community';
  if (pathname.startsWith('/crowd-clips')) return 'crowd-clips';
  if (pathname.startsWith('/profile') || pathname.startsWith('/admin')) return 'profile';
  return 'map';
}

export function TabHistoryProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tabPathsRef = useRef({ ...TAB_ROOTS });

  const currentTab = getTabFromPath(location.pathname);

  // Only remember nested routes for non-Map tabs.
  // Home/Map must always resolve directly to '/'.
  if (currentTab !== 'map') {
    tabPathsRef.current[currentTab] = location.pathname;
  }

  const switchToTab = useCallback((tabName) => {
    // Home/Map is always a direct navigation to the Home route.
    // It must never restore a previous page or depend on browser history.
    if (tabName === 'map') {
      if (location.pathname !== '/') {
        navigate('/', { replace: true });
      }
      return;
    }

    const root = TAB_ROOTS[tabName] || '/';

    // Tapping the already-active tab navigates to its root (pop-to-root behaviour).
    if (currentTab === tabName) {
      if (location.pathname !== root) {
        navigate(root);
      }
      return;
    }

    // Other tabs retain their independent last-known route.
    navigate(tabPathsRef.current[tabName] || root);
  }, [currentTab, location.pathname, navigate]);

  const value = useMemo(() => ({ currentTab, switchToTab }), [currentTab, switchToTab]);

  return (
    <TabHistoryContext.Provider value={value}>
      {children}
    </TabHistoryContext.Provider>
  );
}

export function useTabHistory() {
  const ctx = useContext(TabHistoryContext);
  if (!ctx) throw new Error('useTabHistory must be used within TabHistoryProvider');
  return ctx;
}