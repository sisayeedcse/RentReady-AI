import type { ReactNode } from "react";

export interface TabOption<T extends string> {
  id: T;
  label: string;
  count?: number;
  icon?: ReactNode;
}

export function SegmentedTabs<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  fullWidth = false,
  className = ""
}: {
  options: ReadonlyArray<TabOption<T>>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
  fullWidth?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`${fullWidth ? "flex w-full" : "inline-flex w-full sm:w-auto"} rounded-xl border border-[var(--border-default)] bg-[var(--bg-subtle)] p-1 ${className}`}
    >
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.id)}
            className={`inline-flex min-h-9 ${fullWidth ? "flex-1" : "flex-1 sm:flex-initial"} cursor-pointer items-center justify-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
              active
                ? "bg-white text-[var(--ink-primary)] shadow-[0_1px_2px_rgba(17,24,22,0.08)] ring-1 ring-black/5"
                : "text-[var(--ink-secondary)] hover:text-[var(--ink-primary)]"
            }`}
          >
            {opt.icon}
            <span className="truncate">{opt.label}</span>
            {typeof opt.count === "number" && (
              <span
                className={`tabular-nums rounded-full px-1.5 py-0.25 text-[10px] font-bold ${
                  active
                    ? "bg-[#ecfdf5] text-[#046c4e]"
                    : "bg-black/6 text-[var(--ink-muted)]"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function FilterPills<T extends string>({
  options,
  value,
  onChange,
  ariaLabel
}: {
  options: ReadonlyArray<{ id: T; label: string; count?: number }>;
  value: T;
  onChange: (next: T) => void;
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.id)}
            className={`inline-flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors duration-150 ${
              active
                ? "bg-[var(--ink-primary)] text-white"
                : "border border-[var(--border-default)] bg-white text-[var(--ink-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--ink-primary)]"
            }`}
          >
            <span>{opt.label}</span>
            {typeof opt.count === "number" && (
              <span
                className={`tabular-nums text-[10px] font-bold ${
                  active ? "text-white/80" : "text-[var(--ink-muted)]"
                }`}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
