import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { useState, useCallback } from 'react';
import { BrowserRouter as Router, Route, Routes, useNavigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { TabHistoryProvider } from '@/lib/TabHistoryContext';
import SplashScreen from '@/components/SplashScreen';
// Add page imports here
import AppLayout from '@/components/AppLayout';
import Home from '@/pages/Home';
import Rides from '@/pages/Rides';
import RideDetail from '@/pages/RideDetail';
import Events from '@/pages/Events';
import EventDetail from '@/pages/EventDetail';
import Community from '@/pages/Community';
import Profile from '@/pages/Profile';
import Admin from '@/pages/Admin';
import GoPremium from '@/pages/GoPremium';
import Settings from '@/pages/Settings';
import Legal from '@/pages/Legal';
import FuelTracker from '@/pages/FuelTracker';
import { useTheme } from '@/hooks/useTheme';
import ActiveRide from '@/pages/ActiveRide';
import Onboarding from '@/pages/Onboarding';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';
import Welcome from '@/pages/Welcome';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, isAuthenticated, navigateToLogin } = useAuth();
  const navigate = useNavigate();
  const [introDone, setIntroDone] = useState(false);
  const [isFirstLaunch] = useState(() => localStorage.getItem('motogo_has_seen_intro') !== 'true');

  const loading = isLoadingAuth || isLoadingPublicSettings;

  const handleSplashComplete = useCallback(() => {
    localStorage.setItem('motogo_has_seen_intro', 'true');
    setIntroDone(true);
    if (authError) return; // let the auth error handler below deal with it
    const isGuest = localStorage.getItem('motogo_guest_mode') === 'true';
    if (isFirstLaunch && !isAuthenticated && !isGuest) {
      navigate('/welcome', { replace: true });
    } else if (!isAuthenticated && !isGuest) {
      navigate('/login', { replace: true });
    }
  }, [isFirstLaunch, isAuthenticated, navigate, authError]);

  // Show splash screen during intro animation and/or initial loading
  if (!introDone || loading) {
    return <SplashScreen isFirstLaunch={isFirstLaunch} loading={loading} onComplete={handleSplashComplete} />;
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Routes>
      {/* Auth routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/welcome" element={<Welcome />} />
      {/* Add your page Route elements here */}
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/rides" element={<Rides />} />
        <Route path="/rides/:id" element={<RideDetail />} />
        <Route path="/events" element={<Events />} />
        <Route path="/events/:id" element={<EventDetail />} />
        <Route path="/community" element={<Community />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/premium" element={<GoPremium />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/legal/:doc" element={<Legal />} />
        <Route path="/fuel-tracker" element={<FuelTracker />} />
      </Route>
      <Route path="/ride/active" element={<ActiveRide />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {
  useTheme();

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <TabHistoryProvider>
            <AuthenticatedApp />
          </TabHistoryProvider>
        </Router>
        <Toaster />
        <SonnerToaster position="top-center" />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App