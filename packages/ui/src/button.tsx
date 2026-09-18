import type { ComponentPropsWithoutRef } from "react";

export function Button({
  type = "button",
  className,
  ...props
}: ComponentPropsWithoutRef<"button">) {
  return (
    <button className={["pk-button", className].filter(Boolean).join(" ")} type={type} {...props} />
  );
}
