# Premiere Mortgage Assistant

A Vite + React + TypeScript single-page app for managing mortgage clients, daily planning, and AI-powered assistance.

## Project Structure
- **Root-level app code**: `App.tsx`, `components/`, `services/`, `constants.ts`, `types.ts`, `polyfill.ts`, `index.tsx`.
- **Legacy experiments**: `src/` mirrors earlier iterations and is not part of the build pipeline.
- **Styling**: Tailwind is consumed via CDN in `index.html`.

## Prerequisites
- Node.js 18+
- A Gemini API key if you intend to use AI-powered features (set `GEMINI_API_KEY` or `VITE_API_KEY` in your environment).

## Getting Started
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Build for production (runs TypeScript type-checking first):
   ```bash
   npm run build
   ```
4. Preview the production bundle locally:
   ```bash
   npm run preview
   ```

## Notes
- The app entry point referenced by `index.html` is `index.tsx` at the repository root.
- Avoid updating `src/` unless performing a full migration, as the current build ignores it.
- Error logging and toast notifications are centralized via `services/errorService` and `components/Toast`.
- Containerization is ready out of the box: the Dockerfile builds the Vite bundle and serves it with Nginx on port 8080 (SPA fallback is configured in `nginx.conf`).
  - Example: `docker build -t premiere-assistant --build-arg VITE_API_KEY=your_key_here . && docker run -p 8080:8080 premiere-assistant`
- If a deployed Cloud Run endpoint returns `403 Forbidden` to a basic `curl` request, the service likely requires authentication; either allow unauthenticated ingress or include an identity token header (for example, `curl -H "Authorization: Bearer $(gcloud auth print-identity-token)" https://<service-host>`).
