# TypeScript configuration instructions

Read [the root instructions](../../AGENTS.md) first. Changes here affect all TypeScript workspaces; read affected projects' local instructions before changing their configuration.

`@pickler/typescript-config` exports `./base.json`. It supplies strict shared compiler settings, including `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ES2022 targeting, bundler module resolution, and no emit. Each consuming project owns its include paths and overrides; Next.js-specific settings live in `apps/web/tsconfig.json`.

- Keep framework-specific plugins and application path aliases out of the shared base.
- Preserve strictness unless an intentional, documented repository-wide decision changes it. Fix local typing issues rather than disabling checks globally.
- Internal packages currently export TypeScript source. This configuration does not generate distributable JavaScript; introduce a separate build configuration if a future consumer needs compiled output.
- Keep the package free of runtime code and dependencies. Maintain the `./base.json` export when changing layout.

Validate from the root with `npm run typecheck` and `npm run build` after compiler configuration changes. This package has no standalone typecheck or test script. Update these instructions when shared settings or consumption requirements change.
