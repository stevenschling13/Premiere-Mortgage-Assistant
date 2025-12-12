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
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Quality & Testing

- `npm run lint` – ESLint static analysis
- `npm run typecheck` – strict TypeScript checks
- `npm run test` – Vitest unit/integration suite
- `npm run test:e2e` – Playwright smoke tests (spins up the dev server automatically)
- `npm run build` – production build
