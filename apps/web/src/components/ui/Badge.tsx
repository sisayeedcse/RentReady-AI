import type { ReactNode } from "react";

export type BadgeTone = "emerald" | "amber" | "rose" | "blue" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  emerald: "bg-emerald-50 text-emerald-800 ring-1 ring-inset ring-emerald-200/90",
  amber: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200/90",
  rose: "bg-rose-50 text-rose-800 ring-1 ring-inset ring-rose-200/90",
  blue: "bg-blue-50 text-blue-800 ring-1 ring-inset ring-blue-200/90",
  neutral: "bg-[var(--bg-subtle)] text-[var(--ink-secondary)] ring-1 ring-inset ring-[var(--border-default)]"
};

const DOT_CLASSES: Record<BadgeTone, string> = {
  emerald: "bg-emerald-600",
  amber: "bg-amber-600",
  rose: "bg-rose-600",
  blue: "bg-blue-600",
  neutral: "bg-slate-500"
};

export function Badge({
  tone = "neutral",
  dot = false,
  className = "",
  children
}: {
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-5 whitespace-nowrap ${TONE_CLASSES[tone]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT_CLASSES[tone]}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
