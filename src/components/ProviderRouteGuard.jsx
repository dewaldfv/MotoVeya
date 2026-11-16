import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isProviderOnlyAccount, isOrganizerOnlyAccount } from '@/lib/plans';

/**
 * Keeps the areas excluded from the standalone Service Provider package out of reach.
 * Providers are sent back to the map; everyone else (including Provider+ and Gold) passes through.
 * With `blockOrganizers`, Organizer-plan accounts are kept out too and land on Events,
 * which stays available to them.
 */
export default function ProviderRouteGuard({ children, blockOrganizers = false }) {
  const { user, isLoadingAuth } = useAuth();
  const location = useLocation();

  if (isLoadingAuth) return null;
  if (isProviderOnlyAccount(user)) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }
  if (blockOrganizers && isOrganizerOnlyAccount(user)) {
    return <Navigate to="/events" replace state={{ from: location.pathname }} />;
  }
  return children;
}