# Agent Guidelines

This file applies to the entire repository.

- Keep all application code under `src/` and avoid reintroducing legacy duplicates at the repo root.
- Favor clear, typed utilities (TypeScript) and avoid silent failures; validate inputs for CLIs or services.
- When updating the Gemini CLI, document user-facing flags in the README and keep session artifacts out of version control.
This file applies to the entire repository.

- Keep all application code under `src/` and avoid reintroducing legacy duplicates at the repo root.
- Use `npm run check:structure` if you add TypeScript files to ensure nothing slips outside `src/`.
- Favor clear, typed utilities (TypeScript) and avoid silent failures; validate inputs for CLIs or services.
- Keep the Gemini CLI and README in sync: document user-facing flags and defaults whenever the CLI changes and ensure session artifacts stay out of version control.
- When updating system instructions, refresh the README snippet so AI Studio and the CLI share the same guardrails.
- Default tests: run `npm run build` before finishing a change.
