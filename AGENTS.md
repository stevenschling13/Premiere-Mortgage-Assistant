# Agent Guide

- Follow the engineering playbook in `docs/ENGINEERING_PLAYBOOK.md` for workflow steps, code style, and review expectations.
- Prefer typed, defensive error handling; avoid swallowing errors silently and log through `errorService` when possible.
- Before opening a pull request, run `npm run build` to ensure the project still compiles.
- Keep documentation in sync when you add or change cross-cutting systems (monitoring, storage, or global styling).
