import TopBar from './TopBar.jsx';
import { BrandMark } from './Logo.jsx';

export default function SessionLoading({ label = 'Opening your private drop…' }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="container-page flex flex-1 items-center justify-center py-20">
        <div className="flex flex-col items-center text-center">
          <div className="relative">
            <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-500/15" />
            <BrandMark className="relative h-14 w-14 rounded-[18px]" />
          </div>
          <p className="mt-6 text-sm font-semibold text-ink">{label}</p>
          <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.3s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400 [animation-delay:-0.15s]" />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-400" />
          </div>
        </div>
      </main>
    </div>
  );
}
