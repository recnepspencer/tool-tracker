import type { Theme } from '../../api/theme/theme-store';
import { Switch } from '../ui/Switch';

export function ThemeToggle({ theme, onToggleTheme }: { theme: Theme; onToggleTheme(): void }) {
  return (
    <Switch
      label="Light mode"
      description={theme === 'dark' ? 'Use a light field surface.' : 'Use the dark field surface.'}
      checked={theme === 'light'}
      onCheckedChange={onToggleTheme}
    />
  );
}
