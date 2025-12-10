# Agent Instructions (Repository-Wide)

## Keep this file intact
- This `AGENTS.md` is the single source of truth for contributor guidance. It lives at the repo root and **must not be moved, renamed, or deleted**. If you cannot find it, check out the latest `main` branch or ensure your working copy is not excluding it. Every change touching the codebase should preserve this file.
- If you create new folders with specialized rules, add nested `AGENTS.md` files there—but keep this root file untouched so future agents always have baseline guidance.

## Project layout
- The legacy `src/` tree is deprecated. All active application code lives at the repository root (`App.tsx`, `components/`, `services/`, etc.). **Do not add or modify files under `src/`** unless explicitly asked to migrate something from that directory.
- Favor colocating new modules alongside existing root-level components and services for consistency and discoverability.

## Code quality expectations
- Aim for production-ready TypeScript/React: strict typing, clear naming, and defensive error handling. Avoid `any` unless absolutely necessary and document why.
- Prefer small, composable components; lift shared utilities into `services/` or `constants.ts` instead of duplicating logic.
- Keep React render paths lean: memoize expensive computations, avoid recreating stable handlers unnecessarily, and prefer declarative data flows.
- Never wrap imports in try/catch. Handle runtime errors at usage sites with explicit messaging and logging.

## Testing and validation
- Run `npm run build` after meaningful changes. Add targeted tests or diagnostics where feasible. Surface any limitations clearly in your summary.

## Security and data handling
- Treat API keys and secrets as sensitive. Do not hardcode credentials. Respect existing storage prefixes (e.g., `premiere_mortgage_`) and avoid leaking user data to logs.

These instructions apply to the entire repository unless overridden by a nested `AGENTS.md`.
