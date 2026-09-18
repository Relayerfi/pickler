// Stroke icons from the design, as mask images (colour comes from `currentColor`).
const PATHS = {
  wallet: '<rect x="2.5" y="6" width="19" height="13.5" rx="2.5"/><path d="M2.5 10.5h19"/><path d="M16.5 15h2"/>',
  mail: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  check: '<path d="M4.5 12.5l5 5 10-11"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function iconStyle(name: IconName): React.CSSProperties {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${PATHS[name]}</svg>`;
  return { "--icon": `url("data:image/svg+xml,${encodeURIComponent(svg)}")` } as React.CSSProperties;
}
