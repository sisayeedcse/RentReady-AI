import { Loader2 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "subtle";
export type ButtonSize = "sm" | "md" | "lg" | "icon";

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    "bg-[#046c4e] text-white border border-[#046c4e] hover:bg-[#03543f] hover:border-[#03543f] shadow-[0_1px_2px_rgba(4,108,78,0.22)]",
  secondary:
    "bg-white text-[var(--ink-primary)] border border-[var(--border-default)] hover:bg-[var(--bg-hover)] hover:border-[var(--border-strong)] shadow-[0_1px_2px_rgba(17,24,22,0.03)]",
  subtle:
    "bg-[#ecfdf5] text-[#046c4e] border border-[#a7f3d0] hover:bg-[#d1fae5]",
  ghost:
    "bg-transparent text-[var(--ink-secondary)] border border-transparent hover:bg-[var(--bg-subtle)] hover:text-[var(--ink-primary)]",
  danger:
    "bg-rose-700 text-white border border-rose-700 hover:bg-rose-800 hover:border-rose-800 shadow-[0_1px_2px_rgba(190,18,60,0.2)]"
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "min-h-8 px-3 py-1.5 text-xs gap-1.5 rounded-lg",
  md: "min-h-9 px-3.5 py-2 text-xs sm:text-[13px] gap-1.5 rounded-lg",
  lg: "min-h-11 px-4 py-2.5 text-sm gap-2 rounded-lg",
  icon: "h-9 w-9 p-0 rounded-lg"
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  children: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex cursor-pointer items-center justify-center font-semibold transition-colors duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
