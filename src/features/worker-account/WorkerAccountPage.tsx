import { useSession } from '../../app/session-context';
import { useTheme } from '../../app/theme-context';
import { Avatar } from '../../components/ui/Avatar';
import { Switch } from '../../components/ui/Switch';
import '../../styles/account.css';

export function WorkerAccountPage() {
  const { session } = useSession();
  const { theme, toggleTheme } = useTheme();
  if (!session) return null;
  const initials = session.name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2);
  return (
    <div className="worker-screen worker-account-page">
      <div className="worker-screen-heading">
        <div>
          <span className="worker-eyebrow">{session.name}</span>
          <h1 aria-label="Your account">Account</h1>
        </div>
      </div>
      <section className="account-card" aria-labelledby="account-card-heading">
        <div className="account-card-identity">
          <Avatar initials={initials} tone="amber" size="large" />
          <div>
            <span className="worker-eyebrow">Signed in as</span>
            <h2 id="account-card-heading">{session.name}</h2>
            <p>{session.email}</p>
          </div>
        </div>
        <dl className="account-facts">
          <div>
            <dt>Role</dt>
            <dd>Field worker</dd>
          </div>
          <div>
            <dt>Title</dt>
            <dd>{session.title}</dd>
          </div>
          <div>
            <dt>Home warehouse</dt>
            <dd>{session.homeWarehouse}</dd>
          </div>
          <div>
            <dt>Profile ID</dt>
            <dd>{session.profileId}</dd>
          </div>
        </dl>
        <Switch
          label="Light mode"
          description={theme === 'dark' ? 'Use a light field surface.' : 'Use the dark field surface.'}
          checked={theme === 'light'}
          onCheckedChange={toggleTheme}
        />
      </section>
    </div>
  );
}
