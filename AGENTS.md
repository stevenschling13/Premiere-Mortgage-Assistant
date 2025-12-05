# Premiere Mortgage Assistant Agent Guide

## Scope
This file applies to the entire repository.

## Code & Documentation Style
- Prefer TypeScript/React functional components and hooks.
- Keep imports clean—do not wrap imports in try/catch blocks.
- Favor small, well-named components under `components/` and keep shared types in `types.ts`.
- When adding documentation, link to related files and keep sections short with tables or bullet lists.

## Development Workflow
- Use `npm install` to manage dependencies and commit the generated `package-lock.json` when dependencies change.
- Validate changes with `npm run build` before opening a PR.
- Record any new environment variables in the README or relevant docs.

## Communication
- Summaries and PR descriptions should highlight user-facing impacts and any configuration steps.
