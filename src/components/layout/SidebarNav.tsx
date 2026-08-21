import type { Role } from '../../domain/auth';
import { NavItems } from './NavItems';
import '../ui/Typography.css';

export function SidebarNav({ role }: { role: Role }) {
  const isWorker = role === 'worker';

  return (
    <aside className="side-nav" aria-label={role + ' navigation'}>
      <div className="side-nav-heading">{isWorker ? 'Field view' : 'Control room'}</div>
      <NavItems role={role} />
      <div className="side-nav-footer">
        <span className="eyebrow">Demo environment</span>
        <span>Local data · no API calls</span>
      </div>
    </aside>
  );
}
