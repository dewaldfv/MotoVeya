import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isServiceProvider } from '@/lib/plans';

/**
 * Keeps the areas excluded from the Service Provider package out of reach.
 * Providers are sent back to the map; everyone else passes through untouched.
 */
export default function ProviderRouteGuard({ children }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return null;
  if (isServiceProvider(user)) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  return children;
}