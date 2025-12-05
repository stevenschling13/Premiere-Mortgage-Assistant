<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Premiere Mortgage Assistant

Run and deploy the Premiere Mortgage Assistant locally or through AI Studio. The app bundles client management, a loan calculator, AI-assisted conversations, and analytics dashboards to support mortgage workflows.

View the published AI Studio app: https://ai.studio/apps/drive/186_Uuec2HzFHN-DoXsysBSw8yYCHJWox

## Prerequisites

* Node.js 18+
* npm 9+

## Quickstart

1. Install dependencies (generates `package-lock.json`):
   ```bash
   npm install
   ```
2. Create `.env.local` and set your Gemini API key (never commit secrets):
   ```bash
   VITE_GEMINI_API_KEY=your_api_key_here
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```
4. Build for production:
   ```bash
   npm run build
   ```
5. Preview the production build locally:
   ```bash
   npm run preview
   ```

## Project Structure

| Path | Purpose |
| --- | --- |
| `App.tsx` | Application shell, toast provider, and view routing between feature screens. |
| `components/` | Reusable UI blocks, including calculators, dashboards, chat assistant, and navigation. |
| `services/` | Client-side services such as AI calls (`services/aiService.ts`). |
| `types.ts` | Shared enums and types for app-wide state. |

Additional documentation is available in [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and contributor guidance in [`AGENTS.md`](AGENTS.md).
