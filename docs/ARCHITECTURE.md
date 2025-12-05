# Architecture Overview

## Application Shell
- `App.tsx` manages global view state, mobile sidebar toggling, and toast notifications.
- The `ToastContext` exposes `showToast` to components so they can surface success or error banners.

## Navigation & Views
- `components/Sidebar.tsx` renders navigation that sets the `AppView` enum in `App.tsx`.
- Feature screens are registered in `App.tsx` and live under `components/`:
  - `ClientManager` serves as the dashboard view.
  - `Calculator` handles loan payment calculations.
  - `DtiAnalysis`, `RatesNotes`, `MarketInsights`, and `CompensationTracker` provide analytics and dashboards.
  - `Assistant` is the Gemini-powered chat experience.

## Services & Data
- `services/aiService.ts` wraps calls to Gemini via `@google/genai` and centralizes model configuration.
- UI state is client-side only; there is no API server in this repository.

## Styling & UI
- Components use Tailwind utility classes for layout and Lucide icons for visual cues.
- Reusable UI pieces such as toast notifications live in `components/Toast.tsx`.

## Build & Tooling
- Vite is the build tool; development commands are exposed through npm scripts.
- TypeScript configuration lives in `tsconfig.json`; Vite config is in `vite.config.ts`.

## Environment
- Requires `VITE_GEMINI_API_KEY` in `.env.local` for AI features.
- No other runtime services are required to launch the app locally.
