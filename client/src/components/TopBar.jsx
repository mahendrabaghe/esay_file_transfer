import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';

export default function TopBar({ right = null, className = '' }) {
  return (
    <header className={`glass-bar relative z-30 border-b border-line/60 ${className}`}>
      <div className="container-page flex h-[72px] items-center justify-between gap-4">
        <Logo />
        <div className="flex items-center gap-2 sm:gap-3">
          {right}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
