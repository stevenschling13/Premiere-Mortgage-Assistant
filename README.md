<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/186_Uuec2HzFHN-DoXsysBSw8yYCHJWox

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set `VITE_GEMINI_API_KEY` (preferred) or `GEMINI_API_KEY`/`API_KEY` in [.env.local](.env.local) to your Gemini API key.
3. Run the app:
   `npm run dev`

## Codebase Map (Gemini + Bundling)

* **Gemini feature services** live under `services/gemini/` and share `geminiCore.ts` for client setup, MIRROR prompt, safety settings, and caching. The barrel `services/geminiService.ts` re-exports all feature modules.
* **Dynamic imports** are used in components to load cold-path AI actions on demand (e.g., marketing campaign generation, audio briefings).
* **Icon imports** use per-icon paths (`lucide-react/icons/*`) to keep bundles lean.
* **Vite** is configured with manual vendor chunks for React, Gemini, Recharts, and Lucide in `vite.config.ts`.
