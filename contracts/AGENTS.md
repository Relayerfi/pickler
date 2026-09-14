# Solidity project instructions

Read [the root instructions](../AGENTS.md) first. Read [chain package instructions](../packages/chain/AGENTS.md) before changing public artifacts and any affected adapter's instructions before integration work.

## Current state

This is an independent Foundry project, not an npm workspace. `foundry.toml` pins Solidity 0.8.30, enables optimization with 200 runs, and configures 256 fuzz runs. `src/`, `test/`, and `script/` currently contain only placeholders. No business contracts, dependencies, networks, deployment scripts, or tests are implemented.

## Organization and rules

- Put Solidity source in `src/`, tests in `test/`, and explicit deployment scripts in `script/`. Keep generated `out/`, `cache/`, and local broadcast output untracked.
- Define product rules, actors, permissions, assets, and target network requirements before implementing business contracts. Do not invent a token, custody model, upgrade mechanism, or administrator role.
- Keep compiler and dependency choices reproducible. Document any added libraries and changes to compiler or EVM target settings.
- Treat on-chain behavior as a separate execution boundary. Do not assume off-chain writes and transactions are atomic or that submission means finality.
- Test access control, expected state transitions, invalid inputs, failure paths, and relevant invariants. Add fuzz testing for meaningful input ranges and adversarial edge cases.
- Generate public ABIs from compiler artifacts into `packages/chain` once contracts exist. Add and document the generation command; it does not exist today.
- Record deployments by chain ID and contract version with verified address and block information. Never commit keys or signing credentials.
- Deployment must be explicit, never a side effect of build or test. Confirm the intended network and deployment parameters before irreversible on-chain actions unless they are already explicitly authorized.

## Commands

From the repository root, with Foundry installed:

```sh
npm run contracts:build
npm run contracts:test
```

For formatting, use `forge fmt --root contracts --check`. Empty directories do not provide contract validation coverage. When introducing tests, ensure they run rather than treating an empty test result as success. Update this file alongside any change to the contract layout, dependencies, commands, or deployment process.
