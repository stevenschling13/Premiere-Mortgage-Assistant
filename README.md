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

## Quality gates

- Type safety: `npm run typecheck`
- CI: GitHub Actions runs the same type check on every push and pull request (`.github/workflows/typecheck.yml`).

## Project structure

All source files live at the repository root (for example, `components/`, `services/`, `App.tsx`, and `index.tsx`).
There is no `src/` directory; it was removed to avoid drift with the active code under the top-level modules.
