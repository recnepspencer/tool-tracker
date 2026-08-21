import { BrandMark } from '../../../components/layout/BrandMark';
import '../../../components/ui/Typography.css';

export function AuthHero() {
  return (
    <section className="auth-hero">
      <div className="auth-brand">
        <BrandMark />
        <span>
          Nelson <em>Electric</em>
        </span>
      </div>
      <span className="eyebrow">Tool custody system</span>
      <h1>Know where every tool went.</h1>
      <p>One shared record for the people, yards, and handoffs that keep the job moving.</p>
      <div className="auth-proof">
        <span>
          <strong>Shared</strong> custody record
        </span>
        <span>
          <strong>Role-based</strong> views
        </span>
        <span>
          <strong>0</strong> network required
        </span>
      </div>
    </section>
  );
}
