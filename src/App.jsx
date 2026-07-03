import { Toaster } from "@/components/ui/toaster"
import { Toaster as SonnerToaster } from "@/components/ui/sonner"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
import { TabHistoryProvider } from '@/lib/TabHistoryContext';
import { AppSettingsProvider } from '@/hooks/useAppSettings';
import OrientationLockOverlay from '@/components/OrientationLockOverlay';
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
import ActiveRide from '@/pages/ActiveRide';
import Onboarding from '@/pages/Onboarding';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import ForgotPassword from '@/pages/ForgotPassword';
import ResetPassword from '@/pages/ResetPassword';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
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
      </Route>
      <Route path="/ride/active" element={<ActiveRide />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};


function App() {

  return (
    <AuthProvider>
      <AppSettingsProvider>
        <QueryClientProvider client={queryClientInstance}>
          <Router>
            <ScrollToTop />
            <TabHistoryProvider>
              <OrientationLockOverlay />
              <AuthenticatedApp />
            </TabHistoryProvider>
          </Router>
        <Toaster />
        <SonnerToaster position="top-center" />
        </QueryClientProvider>
      </AppSettingsProvider>
    </AuthProvider>
  )
}

export default App