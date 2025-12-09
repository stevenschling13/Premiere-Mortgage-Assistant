# Agent Guidelines

This file applies to the entire repository.

- Keep all application code under `src/` and avoid reintroducing legacy duplicates at the repo root.
- Favor clear, typed utilities (TypeScript) and avoid silent failures; validate inputs for CLIs or services.
- When updating the Gemini CLI, document user-facing flags in the README and keep session artifacts out of version control.
- Default tests: run `npm run build` before finishing a change.
