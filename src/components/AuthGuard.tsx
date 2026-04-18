import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/stores/authStore';

interface AuthGuardProps {
  children: React.ReactNode;
  requiredRole: UserRole | UserRole[];
  redirectTo?: string;
}

export function AuthGuard({ children, requiredRole, redirectTo = '/admin/login' }: AuthGuardProps) {
  const user = useAuthStore(s => s.user);
  const loading = useAuthStore(s => s.loading);
  const location = useLocation();

  const allowedRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

  // Don't redirect while the auth store is still hydrating from Supabase
  // session — otherwise a logged-in user landing directly on /admin/...
  // gets bounced to /admin/login for ~50ms before the session resolves.
  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-[#0052CC] border-t-transparent rounded-full animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to={redirectTo} state={{ from: location.pathname }} replace />;
  }

  // President has access to everything — bypass role check.
  if (user.role !== 'president' && !allowedRoles.includes(user.role)) {
    // Wrong role — send to their natural home.
    const home = user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor' : '/';
    return <Navigate to={home} replace />;
  }

  return <>{children}</>;
}
