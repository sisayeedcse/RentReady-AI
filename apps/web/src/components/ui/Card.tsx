import type { ReactNode } from "react";

export function Card({
  className = "",
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`surface-card rounded-xl ${className}`}>
      {children}
    </section>
  );
}

export function CardHeader({
  title,
  subtitle,
  badge,
  action,
  className = ""
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border-subtle)] px-4 py-3.5 sm:px-5 ${className}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-bold tracking-tight text-[var(--ink-primary)]">
            {title}
          </h3>
          {badge}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-[var(--ink-muted)]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardBody({
  className = "",
  children
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={`p-4 sm:p-5 ${className}`}>{children}</div>;
}
