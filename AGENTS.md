# Agent Guidance

## Scope
This repository is a Vite + React + TypeScript single-page app. The canonical source code lives at the repository root (`App.tsx`, `components/`, `services/`, etc.). The `src/` directory currently mirrors legacy experiments and is not part of the build; avoid modifying it unless migrating the entire app.

## Conventions
- Prefer clear, typed React components with minimal shared mutable state.
- Keep bundle weight in mind; prefer code-splitting for large feature surfaces.
- Avoid introducing new dependencies unless they deliver clear value.
- Tailwind is pulled from CDN via `index.html`; preserve class-based styling.

## Verification
- Install: `npm install`
- Build/typecheck: `npm run build`
