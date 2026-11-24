import { X } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  titleId,
  maxWidth = "max-w-lg",
  closeLabel = "Close dialog",
  footer,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  titleId: string;
  maxWidth?: "max-w-md" | "max-w-lg" | "max-w-xl" | "max-w-2xl";
  closeLabel?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Shift focus inside dialog for WCAG 2.2 keyboard navigation
    const raf = window.requestAnimationFrame(() => {
      const focusable = panelRef.current?.querySelector<HTMLElement>(
        'input:not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (focusable) {
        focusable.focus({ preventScroll: true });
      } else {
        panelRef.current?.focus({ preventScroll: true });
      }
    });

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const nodes = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (nodes.length === 0) return;
        const first = nodes[0];
        const last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
      previousFocusRef.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[#0d1512]/55 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`animate-sheet-up flex max-h-[92vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-2xl border border-[var(--border-default)] bg-white text-[var(--ink-primary)] shadow-2xl focus:outline-none sm:rounded-2xl`}
      >
        {/* Mobile grab handle */}
        <div className="flex justify-center pt-2.5 sm:hidden" aria-hidden="true">
          <div className="h-1 w-9 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] bg-white px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2
              id={titleId}
              className="text-base font-bold tracking-tight text-[var(--ink-primary)]"
            >
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-[var(--ink-muted)] transition-colors hover:border-[var(--border-default)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Scrollable Opaque Body */}
        <div className="flex-1 overflow-y-auto bg-white px-5 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* Optional Footer */}
        {footer && (
          <div className="border-t border-[var(--border-subtle)] bg-[var(--bg-rail)] px-5 py-3.5 sm:px-6">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
