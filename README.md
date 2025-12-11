<div align="center">
  <img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Premiere Mortgage Assistant

An AI-powered command center for private bankers that blends Gemini 3 reasoning with deal calculators, client tools, and daily market intel—all in a single Vite + React app.

![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite&logoColor=white) ![React](https://img.shields.io/badge/React-18-149ECA?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript&logoColor=white)

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Quickstart](#quickstart)
- [Configuration](#configuration)
- [Scripts](#scripts)
- [Testing & Quality](#testing--quality)
- [Project Structure](#project-structure)
- [Data & Persistence](#data--persistence)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Overview
Premiere Mortgage Assistant is a front-end only Vite + React experience that accelerates day-to-day private banking work:

- Fast calculators keep underwriting math deterministic and transparent.
- Gemini-powered analyst provides guided prompts and market intelligence with circuit breakers for reliability.
- Client/marketing helpers and exporting make it easy to move between workstations without backend setup.

## Features
- **Virtual Analyst**: Gemini-backed assistant tuned with underwriting guidelines, circuit breakers, and error normalization for resilient responses.
- **Client Dashboard & Planner**: Manage clients, tasks, and daily workflow with persistent storage in the browser.
- **Deal Calculators**: Jumbo payment calculator, affordability/DTI views, and deterministic math helpers to keep AI calls grounded.
- **Market Intelligence**: Market pulse shortcuts plus rates/commentary notes for quick briefings.
- **Marketing & Wealth Tools**: Campaign ideas, compensation/performance tracking, and export-to-JSON for local backups.
- **Gemini Cookbook Guide**: Notebook-style guidance for extending retrieval, function calling, and streaming patterns (see `docs/cookbook-refactors.md`).

## Architecture
- **UI**: React 18 + TypeScript with Vite, modularized into sidebar, planners, calculators, and chat panels.
- **AI Integration**: `@google/genai` client with retry/backoff, timeout guards, and local caching for market data and valuations.
- **State & Persistence**: Pure client-side state stored in `localStorage` under the `premiere_mortgage_*` namespace, with import/export controls.
- **Error Handling**: Global listeners forward errors to `errorService` and surface actionable toasts in the UI.
- **Routing/Layout**: Single-page layout driven by `App.tsx`, with lazy-loading where possible to keep startup fast.

## Tech Stack
- **Language**: TypeScript
- **Framework**: React 18, Vite 5
- **UI**: Tailwind-style utility classes (co-located), Lucide icons
- **Data/Runtime**: Client-only; no backend required
- **Testing**: Vitest

## Quickstart
**Prerequisites**
- Node.js 18+ (aligns with the Vite toolchain)
- npm 9+

**Setup**
1. Install dependencies: `npm install`
2. Create `.env.local` in the repo root and set your Gemini API key:
   ```bash
   VITE_API_KEY=your_gemini_key
   ```
3. Start the dev server: `npm run dev`
4. Open the printed localhost URL to load the app.

## Configuration
- **Environment variables**
  - `VITE_API_KEY` — Required. Gemini API key used by the virtual analyst.
- **Local storage namespace**: All user data is stored under `premiere_mortgage_*` keys. Use the sidebar export/import controls to move data between browsers.

## Scripts
- `npm run dev` — Launch Vite in development mode with hot reload.
- `npm run build` — Type-check via `tsc` then emit optimized assets.
- `npm run preview` — Serve the production build for local QA.
- `npm test` — Run Vitest (when tests exist).

## Testing & Quality
- **Type safety**: `npm run build` runs the TypeScript compiler.
- **Unit tests**: `npm test` runs Vitest. Add new tests alongside features to preserve behavior.
- **Manual QA**: Use `npm run preview` to validate the production bundle in a browser before release.

## Project Structure
- `App.tsx` — Top-level layout, lazy-loaded views, and global error/transition handling.
- `components/` — UI modules (sidebar navigation, calculators, analyst chat, planners, etc.).
- `services/` — Gemini client, storage helpers, and error logging utilities.
- `constants.ts` — Underwriting guideline corpus injected into AI prompts.
- `docs/` — Cookbook and implementation notes for extending the AI workflows.

## Data & Persistence
- **Storage**: Client-only; data is written to `localStorage` and never leaves the browser unless you export it.
- **Backups**: Sidebar export downloads a JSON snapshot of the `premiere_mortgage_*` keys; import restores it on another machine.
- **Privacy**: Avoid storing sensitive PII—exports are plain text JSON.

## Deployment
- **Static hosting**: Build once with `npm run build` and serve the `dist/` directory from any static host (Netlify, Vercel, S3 + CloudFront, etc.).
- **Containerization**: Pair the production build with your preferred static server (e.g., `nginx`) if you need a containerized deployment.

## Troubleshooting
- **API key errors**: Confirm `VITE_API_KEY` is set; invalid keys surface as `INVALID_API_KEY` with guidance in the UI.
- **Cooling-off period**: Three consecutive AI failures open a 30s circuit breaker to protect the UX.
- **Storage access**: In private browsing modes with blocked storage, caching/exports may be unavailable; re-run in a standard tab.
