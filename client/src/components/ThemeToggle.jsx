import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../lib/theme.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`icon-btn relative overflow-hidden border border-line/70 bg-surface/60 ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <span className="relative block h-[18px] w-[18px]">
        <Sun
          size={18}
          strokeWidth={2}
          className={`absolute inset-0 transition-all duration-300 ${
            isDark ? 'rotate-90 scale-50 opacity-0' : 'rotate-0 scale-100 opacity-100'
          }`}
        />
        <Moon
          size={18}
          strokeWidth={2}
          className={`absolute inset-0 transition-all duration-300 ${
            isDark ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-50 opacity-0'
          }`}
        />
      </span>
    </button>
  );
}
