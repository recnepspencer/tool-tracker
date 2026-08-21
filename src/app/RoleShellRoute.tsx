import { RoleShell } from '../components/layout/RoleShell';
import { useSession } from './session-context';
import { useTheme } from './theme-context';
import type { Role } from '../domain/auth';

export function RoleShellRoute({ role }: { role: Role }) {
  const { session, signOut } = useSession();
  const { theme, toggleTheme } = useTheme();
  if (!session) return null;
  return <RoleShell role={role} session={session} onSignOut={signOut} theme={theme} onToggleTheme={toggleTheme} />;
}
