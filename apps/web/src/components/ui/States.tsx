import { AlertCircle, CheckCircle2, Info, RefreshCw, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./Button";

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-semibold text-[#046c4e]">{eyebrow}</p>
        )}
        <h2 className="text-xl font-bold tracking-tight text-[var(--ink-primary)] sm:text-[22px]">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--ink-muted)] sm:text-[13px]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

export function AlertBanner({
  tone = "error",
  message,
  onRetry,
  retryLabel,
  onDismiss
}: {
  tone?: "error" | "warning" | "info" | "success";
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  onDismiss?: () => void;
}) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-900",
    warning: "border-amber-200 bg-amber-50 text-amber-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900"
  }[tone];

  const Icon =
    tone === "success" ? CheckCircle2 : tone === "info" ? Info : AlertCircle;

  return (
    <div
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      className={`animate-scale-in flex items-start justify-between gap-3 rounded-xl border px-3.5 py-3 text-xs font-medium ${styles}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <p className="leading-relaxed">{message}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            <RefreshCw className="h-3 w-3" aria-hidden="true" />
            {retryLabel ?? "Retry"}
          </Button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss message"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-black/5"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--border-strong)] bg-white px-5 py-10 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--bg-subtle)] text-[var(--ink-muted)]">
        {icon}
      </div>
      <p className="mt-3 text-sm font-bold text-[var(--ink-primary)]">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-xs leading-relaxed text-[var(--ink-muted)]">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  clearLabel = "Clear search",
  className = ""
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  ariaLabel: string;
  clearLabel?: string;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center ${className}`}>
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--ink-muted)]"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-h-9 w-full rounded-lg border border-[var(--border-default)] bg-white py-2 pr-9 pl-9 text-xs sm:text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]/75 transition-colors hover:border-[var(--border-strong)] focus:border-[#046c4e] focus:ring-2 focus:ring-[#046c4e]/15 focus:outline-none"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={clearLabel}
          className="absolute right-1.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-[var(--ink-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading"
      className="surface-card divide-y divide-[var(--border-subtle)] rounded-xl"
    >
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="flex animate-pulse items-center justify-between gap-4 px-4 py-3.5 sm:px-5"
        >
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-3.5 w-40 rounded bg-slate-200/80" />
            <div className="h-3 w-28 rounded bg-slate-100" />
          </div>
          <div className="h-6 w-20 rounded-md bg-slate-200/70" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonCards({
  count = 6,
  cols = "sm:grid-cols-2 lg:grid-cols-3"
}: {
  count?: number;
  cols?: string;
}) {
  return (
    <div role="status" aria-label="Loading" className={`grid gap-3 ${cols}`}>
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="surface-card animate-pulse rounded-xl p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-24 rounded bg-slate-200/80" />
            <div className="h-5 w-14 rounded-full bg-slate-100" />
          </div>
          <div className="h-6 w-32 rounded bg-slate-200/70" />
          <div className="h-2.5 w-full rounded bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
