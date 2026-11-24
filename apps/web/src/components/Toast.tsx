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
      className="animate-fade-up fixed top-16 right-4 left-4 z-50 mx-auto flex max-w-md items-center justify-between gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl ring-1 ring-white/10"
    >
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
        <span>{message}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close notification"
        className="rounded-lg p-1 text-slate-300 hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
