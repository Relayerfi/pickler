# UI package instructions

Read [the root instructions](../../AGENTS.md) first. Read the web app's local instructions when changing consumption there. Update this file when components, styling exports, or client boundaries change.

`@pickler/ui` contains product-independent React components and the control system both surfaces share. Current files are `src/button.tsx`, `src/chart.tsx`, `src/chip.tsx`, `src/icon.tsx`, `src/index.ts`, and `src/styles.css`. The package exports `Button`, `ButtonLink`, `CandleChart`, `BarChart`, `Chip`, `Tag`, `Icon` and the stylesheet `@pickler/ui/styles.css`. The web root layout imports that stylesheet.

## The control system

One set of shapes, two surfaces. The public site and the creator console share radii, control sizes and button variants; what changes is tone.

- **Shapes:** pill for actions, chips and status; `--pk-radius-lg` (16) for cards and panels; `--pk-radius-md` (12) for inputs and tiles; `--pk-radius-sm` (6) for small marks. Nothing square. Feature stylesheets use these tokens rather than literal values.
- **Surfaces:** put `data-surface="public"` or `data-surface="console"` on a wrapper. Both use Manrope; what changes is the background and the ink. Public is the blue-ink surface and the default, console is near-black.
- **Type:** three faces, everywhere. Chakra Petch for titles and the lead figure of a view (a token price, a wallet balance); JetBrains Mono for tabular data, labels, tickers, addresses and timestamps; Manrope for everything else, including every control label.
- **Buttons:** one `primary` per view, and never two filled buttons side by side — pair `primary` with `secondary`. `tile` is the rectangular action used in console grids. Sizes are `sm`, `md` and `lg`; `mono` switches the label to uppercase mono for navigation and utility actions.
- **Icons:** `Icon` wraps a curated set from `lucide-react`, which matches what the canvases drew by hand: a 24×24 grid, round joins and one stroke weight (1.9 here). Colour comes from `currentColor`, and `label` is required whenever the icon is the only content of a control. Add a name to `src/icon.tsx` rather than importing from `lucide-react` inside a feature — that is how two screens end up with two different arrows.
- **Charts:** `CandleChart` and `BarChart` wrap [lightweight-charts](https://github.com/tradingview/lightweight-charts). Features pass data — candles or bars, each bucket timestamped in milliseconds — and the look is decided in `src/chart.tsx`, which reads `--pk-ink-faint`, `--pk-border`, `--pk-lime`, `--pk-magenta` and `--pk-font-mono` from the surrounding surface, so a chart follows `data-surface` like everything else. Do not call `createChart` in a feature; add an option or a series type here instead. The library's in-panel logo is turned off (`layout.attributionLogo: false`), which its Apache-2.0 notice allows as long as the credit and a link to <https://www.tradingview.com/> live on the page — the public shell's footer carries them, so keep that credit wherever a chart ships on a new surface.
- New controls use these components. Feature stylesheets may keep their own layout, but not their own shapes.

- Keep components independent of Next.js, core, infrastructure, authentication, wallets, and provider services.
- Preserve native HTML semantics and prop types. `Button` defaults to `type="button"` and accepts native button props; form submission must use an explicit submit type.
- Preserve keyboard behavior, focus visibility, disabled semantics, and accessible names.
- Keep components server-compatible when possible. Add `"use client"` only to modules requiring client hooks or interactivity; do not mark the entire library client-only.
- Keep shared component styling here with scoped class names such as `pk-button`. Product layouts and feature-specific styles stay in the app.
- Pass behavior through props rather than embedding network calls. Keep product-specific forms and wallet flows in the consuming app.
- Expose public components deliberately; do not require consumers to import internal source paths.

From the root: `npm run typecheck --workspace=@pickler/ui` and `npm run lint`. Run `npm run build` for export or rendering-boundary changes; check the consuming page visually and with keyboard interaction for UI behavior changes. No standalone UI test suite or component explorer exists yet.
