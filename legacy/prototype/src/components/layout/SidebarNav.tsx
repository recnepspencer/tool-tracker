import type { Role } from '../../domain/auth';
import { NavItems } from './NavItems';
import { ThemeToggle } from './ThemeToggle';
import '../ui/Typography.css';

export function SidebarNav({
  role,
  theme,
  onToggleTheme,
}: {
  role: Role;
  theme: 'dark' | 'light';
  onToggleTheme(): void;
}) {
  const isWorker = role === 'worker';

  return (
    <aside className="side-nav" aria-label={role + ' navigation'}>
      <div className="side-nav-heading">{isWorker ? 'Field view' : 'Control room'}</div>
      <nav className="side-nav-links" aria-label={`${role} destinations`}>
        <NavItems role={role} />
      </nav>
      <div className="side-nav-theme">
        <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
      </div>
      <div className="side-nav-footer">
        <span className="eyebrow">Nelson Electric</span>
        <span>Tools · custody · activity</span>
      </div>
    </aside>
  );
}
