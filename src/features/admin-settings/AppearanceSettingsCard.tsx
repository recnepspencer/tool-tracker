import { Button } from '../../components/ui/Button';
import { SurfaceCard } from '../../components/ui/SurfaceCard';

export function AppearanceSettingsCard({ theme, onToggle }: { theme: 'dark' | 'light'; onToggle(): void }) {
  return (
    <SurfaceCard>
      <div className="settings-card-heading">
        <span className="eyebrow">Appearance</span>
      </div>
      <p className="settings-muted">Theme is stored in this browser and remains available if settings fail.</p>
      <Button variant="secondary" onClick={onToggle}>
        Use {theme === 'dark' ? 'light' : 'dark'} mode
      </Button>
    </SurfaceCard>
  );
}
