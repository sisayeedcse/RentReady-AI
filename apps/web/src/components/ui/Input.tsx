import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes
} from "react";

const FIELD_CONTROL_BASE =
  "w-full rounded-lg border border-[var(--border-default)] bg-white text-sm text-[var(--ink-primary)] placeholder:text-[var(--ink-muted)]/75 transition-colors duration-150 hover:border-[var(--border-strong)] focus:border-[#046c4e] focus:ring-2 focus:ring-[#046c4e]/15 focus:outline-none disabled:cursor-not-allowed disabled:bg-[var(--bg-subtle)] disabled:opacity-65";

export function Field({
  id,
  label,
  required,
  hint,
  error,
  labelAction,
  className = "",
  children
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string | null;
  labelAction?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-semibold text-[var(--ink-secondary)]">
          {label}
          {required && (
            <span className="ml-0.5 text-rose-600" aria-hidden="true">
              *
            </span>
          )}
        </label>
        {labelAction}
      </div>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs font-medium text-rose-700">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-[11px] text-[var(--ink-muted)]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function Input({
  leftIcon,
  rightSlot,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  leftIcon?: ReactNode;
  rightSlot?: ReactNode;
}) {
  if (!leftIcon && !rightSlot) {
    return (
      <input
        className={`${FIELD_CONTROL_BASE} min-h-10 px-3 py-2 ${className}`}
        {...props}
      />
    );
  }
  return (
    <div className="relative flex items-center">
      {leftIcon && (
        <span
          className="pointer-events-none absolute left-3 flex items-center text-[var(--ink-muted)]"
          aria-hidden="true"
        >
          {leftIcon}
        </span>
      )}
      <input
        className={`${FIELD_CONTROL_BASE} min-h-10 py-2 ${leftIcon ? "pl-9" : "pl-3"} ${
          rightSlot ? "pr-10" : "pr-3"
        } ${className}`}
        {...props}
      />
      {rightSlot && (
        <span className="absolute right-1.5 flex items-center">{rightSlot}</span>
      )}
    </div>
  );
}

export function Select({
  className = "",
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${FIELD_CONTROL_BASE} min-h-10 px-3 py-2 ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}

export function Textarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`${FIELD_CONTROL_BASE} px-3 py-2.5 leading-relaxed ${className}`}
      {...props}
    />
  );
}
