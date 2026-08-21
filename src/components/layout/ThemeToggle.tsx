import type { Theme } from '../../api/theme/theme-store';
import { Switch } from '../ui/Switch';
import './ThemeToggle.css';

export function ThemeToggle({ theme, onToggleTheme }: { theme: Theme; onToggleTheme(): void }) {
  return (
    <div className="theme-toggle theme-toggle--navigation">
      <Switch
        label="Appearance"
        description={theme === 'light' ? 'Light' : 'Dark'}
        checked={theme === 'light'}
        onCheckedChange={onToggleTheme}
      />
    </div>
  );
}
