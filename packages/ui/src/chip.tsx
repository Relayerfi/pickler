import type { ComponentPropsWithoutRef, ReactNode } from "react";

/** A filter or toggle. Pressed state is announced with aria-pressed, not only with colour. */
export function Chip({
  selected = false,
  className,
  children,
  type = "button",
  ...props
}: { selected?: boolean; children?: ReactNode } & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={["pk-chip", className].filter(Boolean).join(" ")}
      type={type}
      aria-pressed={selected}
      {...props}
    >
      {children}
    </button>
  );
}

/** Read-only status: a stage, an outcome, a kind of event. Not clickable. */
export function Tag({ className, children, ...props }: ComponentPropsWithoutRef<"span">) {
  return (
    <span className={["pk-tag", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </span>
  );
}
