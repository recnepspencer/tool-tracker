import { Navigate, Outlet } from 'react-router-dom';
import type { Role } from '../domain/auth';
import { useSession } from './session-context';
import { homePathForRole } from './role-home-path';
import './RouteLoading.css';

function LoadingRoute() {
  return (
    <main className="route-loading" aria-label="Loading Nelson Electric">
      <span className="pulse-dot" /> Restoring demo session…
    </main>
  );
}

export function RequireSession() {
  const { session, status } = useSession();
  if (status === 'loading') return <LoadingRoute />;
  return session ? <Outlet /> : <Navigate to="/login" replace />;
}

export function RequireAnonymous() {
  const { session, status } = useSession();
  if (status === 'loading') return <LoadingRoute />;
  return session ? <Navigate to={homePathForRole(session.role)} replace /> : <Outlet />;
}

export function RequireRole({ role }: { role: Role }) {
  const { session, status } = useSession();
  if (status === 'loading') return <LoadingRoute />;
  if (!session) return <Navigate to="/login" replace />;
  if (session.role !== role) {
    return <Navigate to={homePathForRole(session.role)} replace />;
  }
  return <Outlet />;
}
