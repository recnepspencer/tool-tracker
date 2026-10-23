import { Link } from 'react-router-dom';
import { SurfaceCard } from '../../components/ui/SurfaceCard';
import type { AuthSession } from '../../domain/auth';

export function AccountSettingsCard({ session }: { session: AuthSession | null }) {
  return (
    <SurfaceCard>
      <div className="settings-card-heading">
        <span className="eyebrow">Account</span>
      </div>
      <p>
        <strong>{session?.name}</strong>
        <br />
        {session?.email}
        <br />
        {session?.title}
      </p>
      <Link className="text-link" to="/admin/people">
        Open people administration
      </Link>
    </SurfaceCard>
  );
}
