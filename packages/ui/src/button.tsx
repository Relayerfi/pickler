import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "tile";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonOwnProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Uppercase mono label, for navigation and utility actions. */
  mono?: boolean;
  block?: boolean;
  /** Trailing arrow, for actions that move you somewhere. */
  arrow?: boolean;
  children?: ReactNode;
  className?: string;
}

const classes = (...values: (string | undefined)[]) => values.filter(Boolean).join(" ");

/**
 * The one button in the product. Shapes and sizes come from @pickler/ui/styles.css; tone follows
 * the surrounding `data-surface`. Only one `primary` per view, and never two filled buttons side
 * by side: pair a primary with a secondary.
 */
export function Button({
  variant = "primary",
  size = "md",
  mono = false,
  block = false,
  arrow = false,
  type = "button",
  className,
  children,
  ...props
}: ButtonOwnProps & ComponentPropsWithoutRef<"button">) {
  return (
    <button
      className={classes("pk-button", className)}
      type={type}
      data-variant={variant}
      data-size={size}
      data-mono={mono || undefined}
      data-block={block || undefined}
      {...props}
    >
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </button>
  );
}

/**
 * The same button as a link. `as` takes the router's link component so navigation stays client
 * side; it defaults to a plain anchor.
 */
export function ButtonLink<T extends ElementType = "a">({
  as,
  variant = "secondary",
  size = "md",
  mono = false,
  block = false,
  arrow = false,
  className,
  children,
  ...props
}: ButtonOwnProps & { as?: T } & Omit<ComponentPropsWithoutRef<T>, keyof ButtonOwnProps | "as">) {
  const Component = (as ?? "a") as ElementType;
  return (
    <Component
      className={classes("pk-button", className)}
      data-variant={variant}
      data-size={size}
      data-mono={mono || undefined}
      data-block={block || undefined}
      {...props}
    >
      {children}
      {arrow && <span aria-hidden="true">→</span>}
    </Component>
  );
}
