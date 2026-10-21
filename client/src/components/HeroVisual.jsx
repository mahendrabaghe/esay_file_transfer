import {
  Check,
  FileText,
  Image as ImageIcon,
  Laptop,
  LockKeyhole,
  Send,
  Smartphone,
} from 'lucide-react';
import { BrandMark } from './Logo.jsx';

function MiniFileRow({ icon: Icon, name, meta, tone }) {
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line/70 bg-white/70 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.035]">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] ${tone}`}>
        <Icon size={14} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[10px] font-bold leading-none text-ink">{name}</span>
        <span className="mt-1 block text-[8.5px] font-medium leading-none text-ink-muted">{meta}</span>
      </span>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
        <Check size={9} strokeWidth={3} />
      </span>
    </div>
  );
}

export default function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-[570px] animate-fade-up pb-14 pt-2 [animation-delay:120ms] lg:pb-10">
      <div
        className="absolute left-1/2 top-7 h-[86%] w-[88%] -translate-x-1/2 -rotate-[4deg] rounded-[38px] border border-white/60 bg-white/35 shadow-float dark:border-white/[0.06] dark:bg-white/[0.025]"
        aria-hidden="true"
      />
      <div className="relative rounded-[32px] border border-white/80 bg-gradient-to-br from-white/90 via-[#f7f6ff]/90 to-[#eaf3ff]/80 p-4 shadow-float backdrop-blur-2xl sm:p-5 dark:border-white/[0.09] dark:from-white/[0.075] dark:via-[#141528]/80 dark:to-[#101b2d]/70">
        <div className="flex items-center justify-between px-1 pb-3.5">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.12)]" />
            <span className="text-[9px] font-extrabold uppercase tracking-[0.18em] text-ink-muted">
              Live drop
            </span>
          </div>
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-ink/10 dark:bg-white/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink/10 dark:bg-white/15" />
            <span className="h-1.5 w-1.5 rounded-full bg-ink/10 dark:bg-white/15" />
          </div>
        </div>

        <div className="rounded-[24px] border border-white/90 bg-white/85 p-4 shadow-[0_12px_34px_-24px_rgba(40,32,90,0.35)] backdrop-blur sm:p-5 dark:border-white/[0.07] dark:bg-[#111221]/85">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-[13px] bg-subtle text-ink-soft">
                <Laptop size={18} strokeWidth={1.9} />
              </span>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.13em] text-ink-muted">
                  Drop to
                </p>
                <p className="mt-1 text-[13px] font-bold leading-none text-ink">My laptop</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[9px] font-bold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Connected
            </span>
          </div>

          <div className="mt-4 flex gap-3">
            <div className="relative h-[92px] w-[82px] shrink-0 overflow-hidden rounded-[18px] bg-gradient-to-br from-[#ffb95f] via-[#f57d8d] to-[#6d62d9] shadow-sm">
              <span className="absolute -left-2 top-3 h-12 w-12 rounded-full bg-white/25 blur-[1px]" />
              <span className="absolute right-2 top-2 h-5 w-5 rounded-full bg-[#fff5d9]/85 shadow-[0_0_18px_rgba(255,245,217,0.7)]" />
              <span className="absolute bottom-0 left-0 h-10 w-full bg-gradient-to-t from-[#42349a]/80 to-transparent" />
              <span className="absolute bottom-2 left-2.5 flex items-center gap-1 rounded-md bg-black/15 px-1.5 py-1 text-[7px] font-bold text-white/90 backdrop-blur-sm">
                <ImageIcon size={8} />
                IMG_2481
              </span>
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <MiniFileRow
                icon={FileText}
                name="Launch-plan.pdf"
                meta="2.4 MB · Document"
                tone="bg-rose-50 text-rose-500 dark:bg-rose-400/10 dark:text-rose-300"
              />
              <MiniFileRow
                icon={ImageIcon}
                name="IMG_2482.HEIC"
                meta="6.1 MB · Photo"
                tone="bg-sky-50 text-sky-500 dark:bg-sky-400/10 dark:text-sky-300"
              />
            </div>
          </div>

          <div className="mt-4 rounded-[15px] border border-line/60 bg-canvas/70 p-3 dark:border-white/[0.05] dark:bg-white/[0.025]">
            <div className="flex items-center justify-between text-[9px] font-semibold">
              <span className="text-ink-soft">Transferring 3 files</span>
              <span className="tabular-nums text-brand-600 dark:text-brand-300">24.6 MB</span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/70">
              <div className="relative h-full w-[76%] overflow-hidden rounded-full bg-gradient-to-r from-brand-500 to-indigo-400">
                <span className="absolute inset-0 w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-white/50 to-transparent" />
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -right-2 bottom-[-14px] w-[166px] rotate-[4deg] transition-transform duration-500 sm:-right-5 sm:w-[186px]">
          <div className="rounded-[32px] border-[5px] border-[#171827] bg-[#171827] p-[2px] shadow-float dark:border-[#2a2c42] dark:bg-[#2a2c42]">
            <div className="overflow-hidden rounded-[25px] bg-[#fafaff] p-3.5 dark:bg-[#111220]">
              <div className="mx-auto h-1.5 w-11 rounded-full bg-ink/15 dark:bg-white/15" />
              <div className="mt-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <BrandMark className="h-7 w-7 rounded-[9px]" />
                  <div>
                    <p className="text-[10px] font-extrabold leading-none text-ink">QuickDrop</p>
                    <p className="mt-1 flex items-center gap-1 text-[7.5px] font-semibold text-emerald-600 dark:text-emerald-300">
                      <LockKeyhole size={7} />
                      Secure session
                    </p>
                  </div>
                </div>
                <Smartphone size={14} className="text-ink-muted" />
              </div>

              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-xl border border-line/60 bg-white p-2 dark:border-white/[0.06] dark:bg-white/[0.04]">
                  <span className="h-8 w-8 overflow-hidden rounded-[9px] bg-gradient-to-br from-[#ffb95f] via-[#f57d8d] to-[#6d62d9]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[8.5px] font-bold text-ink">Fall colors.jpg</span>
                    <span className="mt-1 block text-[7px] text-ink-muted">4.2 MB</span>
                  </span>
                  <Check size={11} className="text-emerald-500" strokeWidth={3} />
                </div>
                <div className="flex items-center gap-2 rounded-xl border border-line/60 bg-white p-2 dark:border-white/[0.06] dark:bg-white/[0.04]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-rose-50 text-rose-500 dark:bg-rose-400/10 dark:text-rose-300">
                    <FileText size={13} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[8.5px] font-bold text-ink">Launch-plan.pdf</span>
                    <span className="mt-1 block text-[7px] text-ink-muted">2.4 MB</span>
                  </span>
                  <Check size={11} className="text-emerald-500" strokeWidth={3} />
                </div>
              </div>

              <div className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-brand-600 py-2.5 text-[9px] font-bold text-white shadow-button">
                <Send size={10} />
                Send to laptop
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -left-3 top-[35%] hidden animate-float items-center gap-2 rounded-2xl border border-white/90 bg-white/95 px-3 py-2.5 shadow-float backdrop-blur sm:flex dark:border-white/10 dark:bg-[#171828]/95">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-400/10 dark:text-emerald-300">
            <LockKeyhole size={13} strokeWidth={2.2} />
          </span>
          <span>
            <span className="block text-[9px] font-extrabold leading-none text-ink">Private session</span>
            <span className="mt-1 block text-[8px] font-medium leading-none text-ink-muted">
              Deleted automatically
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}
