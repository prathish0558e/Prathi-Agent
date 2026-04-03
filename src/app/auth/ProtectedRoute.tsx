import { Navigate } from 'react-router';
import { useLocation } from 'react-router';
import { useAuth } from './AuthContext';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthLoading, isAuthenticated, profile } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!profile?.onboardingCompleted && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }

  return <>{children}</>;
}
