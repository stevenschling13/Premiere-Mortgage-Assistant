# Agent Guidance

## Scope
This repository is a Vite + React + TypeScript single-page app. The canonical source code lives at the repository root (`App.tsx`, `components/`, `services/`, etc.). The `src/` directory currently mirrors legacy experiments and is not part of the build; avoid modifying it unless migrating the entire app with a clear plan.

## Conventions
- Prefer clear, typed React components with minimal shared mutable state. Favor functional components, hooks, and local state over global singletons.
- Keep bundle weight in mind; prefer code-splitting for large feature surfaces and reuse existing utilities instead of adding new packages.
- Avoid introducing new dependencies unless they deliver clear value and are necessary for the task at hand.
- Tailwind is pulled from CDN via `index.html`; preserve class-based styling and avoid adding a new styling system.
- Keep documentation and in-line comments concise and actionable so future agents can quickly understand intent.

## Verification
- Install: `npm install`
- Build/typecheck: `npm run build`
- Run targeted scripts or component-level tests when adding logic; document any additional verification performed in commit messages or PR bodies.

## Collaboration and Handoffs
- Prefer small, focused commits with clear messages describing the behavior change.
- When work is incomplete, leave breadcrumbs (TODOs with context, notes in an ExecPlan) so the next agent can resume quickly.
- Keep changes localized: avoid touching files outside the needed surface unless a migration is explicitly in scope.

## ExecPlans

For complex features, multi-file refactors, or any work expected to take more than a quick iteration, author and maintain an ExecPlan as defined in `PLANS.md` at the repository root. ExecPlans are living documents: keep progress, surprises, decisions, and outcomes updated as you work. Follow the formatting and self-containment rules in `PLANS.md` and store the resulting plan alongside the relevant work so another agent can continue from the document alone. When in doubt about complexity, default to creating an ExecPlan before coding.
