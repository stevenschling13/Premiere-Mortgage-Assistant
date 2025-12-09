# Engineering Playbook

This playbook standardizes how agents work in this repository so every change follows the same quality bar.

## Workflow
1. **Read `AGENTS.md`** before you start. Confirm any scoped instructions for touched files.
2. **Plan the change**: note risks, add monitoring/error-handling strategy, and update tests.
3. **Keep diffs tight**: remove dead code and prefer small, focused commits.
4. **Testing is mandatory**: run `npm run build` at minimum; add targeted checks for the area you touched.
5. **Document operational changes** in this playbook or the README when the development process evolves.

## Coding Standards
- **TypeScript-first**: use explicit types and narrow `unknown` errors via guards instead of `any`.
- **Resilient errors**: surface failures through `errorService`, prefer actionable messages, and avoid silent catch blocks.
- **UI safety**: wrap risky rendering paths in `<ErrorBoundary>` or lightweight guards and keep async work off the main thread where possible.
- **Observability**: add breadcrumbs and context when logging so issues can be reproduced.

## Pull Requests
- Summarize user-facing behavior changes and notable risk mitigations.
- Include the exact test commands executed with their results.
- Avoid speculative refactors in the same PR as functional changes unless they reduce risk (e.g., removing dead code that blocks a fix).

## Testing Expectations
- `npm run build` (required)
- Add component- or service-specific checks when modifying logic (e.g., utility unit tests, integration smoke tests, or type checks).
