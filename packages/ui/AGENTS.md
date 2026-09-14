# UI package instructions

Read [the root instructions](../../AGENTS.md) first. Read the web app's local instructions when changing consumption there. Update this file when components, styling exports, or client boundaries change.

`@pickler/ui` contains product-independent React components. Current files are `src/button.tsx`, `src/index.ts`, and `src/styles.css`. The package exports `Button` and the stylesheet `@pickler/ui/styles.css`. The web root layout imports that stylesheet.

- Keep components independent of Next.js, core, infrastructure, authentication, wallets, and provider services.
- Preserve native HTML semantics and prop types. `Button` defaults to `type="button"` and accepts native button props; form submission must use an explicit submit type.
- Preserve keyboard behavior, focus visibility, disabled semantics, and accessible names.
- Keep components server-compatible when possible. Add `"use client"` only to modules requiring client hooks or interactivity; do not mark the entire library client-only.
- Keep shared component styling here with scoped class names such as `pk-button`. Product layouts and feature-specific styles stay in the app.
- Pass behavior through props rather than embedding network calls. Keep product-specific forms and wallet flows in the consuming app.
- Expose public components deliberately; do not require consumers to import internal source paths.

From the root: `npm run typecheck --workspace=@pickler/ui` and `npm run lint`. Run `npm run build` for export or rendering-boundary changes; check the consuming page visually and with keyboard interaction for UI behavior changes. No standalone UI test suite or component explorer exists yet.
