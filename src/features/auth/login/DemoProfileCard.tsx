import { Avatar } from '../../../components/ui/Avatar';
import { Button } from '../../../components/ui/Button';
import type { DemoProfileView } from '../../../domain/read-models/auth';

export function DemoProfileCard({
  profile,
  onSelect,
  busy,
}: {
  profile: DemoProfileView;
  onSelect: (profileId: string) => void;
  busy: boolean;
}) {
  const initials = profile.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  const tone = profile.role === 'worker' ? 'amber' : 'blue';

  return (
    <article className="profile-card">
      <div className="profile-card-topline">
        <Avatar initials={initials} tone={tone} size="large" />
        <span className="role-label">{profile.role === 'worker' ? 'Worker' : 'Admin'}</span>
      </div>
      <h2>{profile.name}</h2>
      <p>{profile.title}</p>
      <div className="profile-meta">
        <span>{profile.email}</span>
        <span>{profile.homeWarehouse}</span>
      </div>
      <Button fullWidth onClick={() => onSelect(profile.id)} disabled={busy} aria-busy={busy}>
        {busy ? 'Opening…' : `Enter as ${profile.name.split(' ')[0]}`}
      </Button>
    </article>
  );
}
