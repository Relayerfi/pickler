import type { SVGProps } from "react";

/**
 * The product's icons. No icon library: these are the stroke paths drawn in the design canvases,
 * on a 24×24 grid with a 1.9 stroke and round joins. Add one here rather than importing a set,
 * and keep the same grid and weight so a new icon sits beside the others.
 */
const PATHS = {
  activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  bars: '<path d="M5 20V11"/><path d="M12 20V4.5"/><path d="M19 20v-6"/>',
  book: '<path d="M4.5 5a2 2 0 0 1 2-2H19v18H6.5a2 2 0 0 1-2-2z"/><path d="M8.5 3v18"/>',
  chat: '<path d="M21 15a3 3 0 0 1-3 3H8l-5 4V6a3 3 0 0 1 3-3h12a3 3 0 0 1 3 3z"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  chevronLeft: '<path d="M14.5 6l-6 6 6 6"/>',
  chevronRight: '<path d="M9.5 6l6 6-6 6"/>',
  coin: '<ellipse cx="12" cy="6.8" rx="7.5" ry="3"/><path d="M4.5 6.8v10.4c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3V6.8"/>',
  dollar:
    '<path d="M12 3.5v17"/><path d="M16 8c0-1.7-1.8-2.8-4-2.8S8 6.3 8 8s1.8 2.6 4 3.2 4 1.4 4 3.3-1.8 2.9-4 2.9-4-1.1-4-2.9"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3c3 3.6 3 14.4 0 18"/>',
  grid: '<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2-2.5 3.4"/><path d="M12 17h.01"/>',
  link: '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8A4 4 0 0 0 13.3 5l-1.4 1.4"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3A4 4 0 0 0 10.7 19l1.4-1.4"/>',
  lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  pause: '<path d="M9 5v14"/><path d="M15 5v14"/>',
  pin: '<path d="M12 17v4"/><path d="M8.5 3.5h7l-1 6 2.5 3v1.5h-10V12.5l2.5-3z"/>',
  play: '<path d="M8 5l11 7-11 7z"/>',
  send: '<path d="M12 19V5"/><path d="M5 12l7-7 7 7"/>',
  sliders:
    '<path d="M4 7h9"/><path d="M18 7h2"/><path d="M4 17h5"/><path d="M13 17h7"/><circle cx="15.5" cy="7" r="2"/><circle cx="11" cy="17" r="2"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-3.8 3.4-5.8 7.5-5.8s7.5 2 7.5 5.8"/>',
  users:
    '<circle cx="9.5" cy="8.5" r="3.5"/><path d="M2.5 20c0-3.4 3.1-5.3 7-5.3s7 1.9 7 5.3"/><path d="M17 5.6a3.5 3.5 0 0 1 0 5.8"/>',
  wallet:
    '<rect x="2.5" y="6" width="19" height="13.5" rx="2.5"/><path d="M2.5 10.5h19"/><path d="M16.5 15h2"/>',
  x: '<path d="M5.5 5.5l13 13"/><path d="M18.5 5.5l-13 13"/>',
} as const;

export type IconName = keyof typeof PATHS;
export const ICON_NAMES = Object.keys(PATHS) as IconName[];

/**
 * Colour comes from `currentColor`. An icon is decoration unless it is given a `label`, and then
 * it is announced; a button with only an icon must pass one.
 */
export function Icon({
  name,
  size = 18,
  label,
  ...props
}: { name: IconName; size?: number; label?: string } & Omit<SVGProps<SVGSVGElement>, "children">) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.9}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
      {...props}
      dangerouslySetInnerHTML={{ __html: PATHS[name] }}
    />
  );
}
