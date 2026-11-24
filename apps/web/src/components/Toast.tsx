import { CheckCircle2, X } from "lucide-react";

export function Toast({
  message,
  onClose
}: {
  message: string | null;
  onClose: () => void;
}) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="animate-fade-up fixed top-16 right-4 left-4 z-50 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl border border-emerald-900/20 bg-[#111816] px-4 py-3 text-xs font-semibold text-white shadow-xl md:top-auto md:right-6 md:bottom-6 md:left-auto md:mx-0"
    >
      <div className="flex items-center gap-2.5">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
        <span className="leading-snug">{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
