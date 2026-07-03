import { createContext, useContext, useRef, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const TabHistoryContext = createContext(null);

const TAB_ROOTS = {
  map: '/',
  rides: '/rides',
  events: '/events',
  community: '/community',
  profile: '/profile',
};

export function getTabFromPath(pathname) {
  if (pathname.startsWith('/rides')) return 'rides';
  if (pathname.startsWith('/events')) return 'events';
  if (pathname.startsWith('/community')) return 'community';
  if (pathname.startsWith('/profile') || pathname.startsWith('/admin')) return 'profile';
  return 'map';
}

export function TabHistoryProvider({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const tabPathsRef = useRef({ ...TAB_ROOTS });

  const currentTab = getTabFromPath(location.pathname);
  // Track the latest path for the active tab (ref mutation in render is safe — doesn't affect output)
  tabPathsRef.current[currentTab] = location.pathname;

  const switchToTab = useCallback((tabName) => {
    const root = TAB_ROOTS[tabName] || '/';
    // Tapping the already-active tab navigates to its root (pop-to-root behaviour)
    if (currentTab === tabName) {
      navigate(root);
      return;
    }
    // Switching to a different tab restores its last known route (independent stack)
    navigate(tabPathsRef.current[tabName] || root);
  }, [currentTab, navigate]);

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