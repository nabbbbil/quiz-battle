import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  /** Shows the button as working without greying it out. The parent ignores clicks meanwhile. */
  busy?: boolean;
}

// The hard bottom edge is the bevel of the Math Quiz operator tiles. It sinks
// on press, so a tap on a phone visibly lands.
const variants: Record<Variant, string> = {
  primary:
    "border-red-deep bg-red text-white shadow-[0_4px_0_var(--color-red-deep)] enabled:active:shadow-[0_1px_0_var(--color-red-deep)]",
  secondary:
    "border-ink bg-white text-ink shadow-[0_4px_0_var(--color-ink)] enabled:active:shadow-[0_1px_0_var(--color-ink)]",
};

export function Button({ variant = "secondary", busy = false, className = "", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      aria-disabled={busy || undefined}
      {...props}
      className={[
        "inline-flex min-h-12 items-center justify-center rounded-2xl border-2 px-5 font-display text-lg font-semibold",
        "transition-[translate,box-shadow] duration-75 enabled:active:translate-y-[3px] motion-reduce:transition-none",
        "disabled:cursor-not-allowed disabled:border-dashed disabled:border-line disabled:bg-paper-deep disabled:text-ink-soft disabled:shadow-none",
        busy ? "cursor-progress" : "",
        variants[variant],
        className,
      ].join(" ")}
    />
  );
}
