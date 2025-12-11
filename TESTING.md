# Testing & Validation Plan

This guide enumerates automated checks and manual test flows that cover every feature module and component in the Premiere Mortgage Assistant codebase. Follow it when certifying releases or running ad-hoc validations.

## Environment & Setup
- Install dependencies: `npm install`.
- Ensure a valid Gemini API key is available via `VITE_GEMINI_API_KEY`, `GEMINI_API_KEY`, or `API_KEY`.
- Build entry point: `npm run build` (runs type-checking plus Vite production bundle).

## Automated Checks
| Area | Command | Purpose |
| --- | --- | --- |
| Type safety + production bundle | `npm run build` | Validates TypeScript types and ensures Vite bundles with manual chunks configured in `vite.config.ts`. |
| Type-only verification | `npm run typecheck` | Optional focused type pass without emitting output (useful during iterative development). |

> Note: No unit/e2e suite is present today. Use the manual matrix below to validate functionality end-to-end; add automated coverage alongside these scenarios where feasible.

## Manual Test Matrix (by feature)

### Application Shell & Navigation
- Launch `npm run dev` and confirm each view loads via the sidebar: Dashboard/Client Manager, Daily Planner, Calculator, DTI Analysis, Rates & Notes, Market Intelligence, Compensation Tracker, and Assistant.
- Verify lazy loading works: initial load fetches only the active view; switching views triggers deferred loading without console errors.

### Assistant (`components/Assistant.tsx`, `services/gemini/assistantService.ts`, `services/gemini/marketIntelligenceService.ts`)
- Chat: start a conversation and observe streamed responses via `streamChatWithAssistant`.
- Factual verification: run `verifyFactualClaims` against an assistant response; expect validation output/toast.
- Command parsing: issue a natural-language command; ensure `parseNaturalLanguageCommand` routes correctly.
- Pipeline scan (dynamic import path): trigger pipeline analysis; confirm the module loads on demand and returns opportunities without blocking other UI actions.
- Market pulse fetch: execute `fetchDailyMarketPulse` and ensure the assistant consumes and displays summaries.

### Client Manager & Briefings (`components/ClientManager.tsx`, `services/gemini/briefingService.ts`, `services/gemini/assistantService.ts`, `services/gemini/marketIntelligenceService.ts`)
- Market pulse: fetch daily pulse and display data.
- Morning memo (dynamic): request a memo; verify streaming text and stable UI while chunk loads.
- Audio briefing (dynamic): generate audio and confirm link/controls render.
- Pipeline scan (dynamic): run from dashboard list; expect new opportunities populated.
- Prefetch behavior: open client detail panels and ensure memo/audio actions remain responsive after initial load.

### Client Workspace (`components/ClientDetailView.tsx`, `services/gemini/clientWorkspaceService.ts`, `services/gemini/assistantService.ts`)
- Summary generation: run `generateClientSummary` and confirm structured output.
- Email drafting: produce drafts and subject lines via `generateEmailDraft` and `generateSubjectLines`.
- Partner update: generate updates with correct tone.
- Property estimation: execute `estimatePropertyDetails` and check returned fields.
- Smart checklist: build checklist items tailored to the client.
- Deal architecture: generate strategy text and diagrams if applicable.
- Image OCR: upload an image, invoke `extractClientDataFromImage`, and validate parsed data.
- Gift suggestions: call `generateGiftSuggestions` with client context; review personalization.
- Audio transcription: upload audio, run `transcribeAudio`, and confirm transcript text.
- Scratchpad organization (dynamic): reorganize notes and ensure updates persist to state.
- Natural language commands: issue commands in detail view; confirm `parseNaturalLanguageCommand` responses.

### Scheduling (`components/DailyPlanner.tsx`, `services/gemini/scheduleService.ts`)
- Daily schedule (dynamic import): generate schedules from open tasks; ensure items populate and UI stays responsive.
- Meeting prep (dynamic import): request prep notes; verify summary content with meeting context.

### Loan Tools (`components/Calculator.tsx`, `services/gemini/loanToolsService.ts`)
- Loan scenario stream (dynamic): start `streamAnalyzeLoanScenario`; observe incremental updates and final summary.
- Error handling: submit incomplete data to confirm validation prompts or safe failure messaging.

### Debt-to-Income Analysis (`components/DtiAnalysis.tsx`, `services/gemini/loanToolsService.ts`)
- DTI solve (dynamic): run `solveDtiScenario`; validate DTI calculation, mitigation suggestions, and no UI freeze during import.

### Rates & Notes (`components/RatesNotes.tsx`, `services/gemini/marketIntelligenceService.ts`, `services/gemini/clientWorkspaceService.ts`)
- Rate trend analysis (dynamic): execute `analyzeRateTrends` and inspect chart/text outputs.
- Rate sheet email (dynamic): generate an email draft summarizing rate sheets.
- Scratchpad organization (dynamic): reorganize notes and confirm updates render correctly.

### Market Insights (`components/MarketInsights.tsx`, `services/gemini/marketIntelligenceService.ts`)
- Market pulse retrieval: fetch and display pulse cards.
- Client-friendly and buyer-specific analysis: run both and verify tailored messaging.
- Marketing campaign generation (dynamic): create campaigns and inspect structure (hooks, audience, CTA).
- Campaign verification (dynamic): validate generated campaign content and observe any warnings.

### Compensation Tracker (`components/CompensationTracker.tsx`, `services/gemini/compensationService.ts`)
- Gap strategy (dynamic): trigger `generateGapStrategy`; confirm actionable steps and no blocking while module loads.

### Storage & Error Handling (`services/storageService.ts`, `services/errorService.ts`, `components/ErrorBoundary.tsx`)
- Storage: add/update/delete stored items (clients, notes) and refresh the page to confirm persistence.
- Error boundary: simulate a component error (e.g., temporary throw in a child) and ensure the boundary renders fallback UI without crashing the whole app.

### UI Chrome & Icons (`App.tsx`, `components/Sidebar.tsx`, `components/Toast.tsx`)
- Sidebar icons render correctly using per-icon imports; verify navigation tooltips and active state styling.
- Toasts appear/dismiss for success and error events triggered by the flows above.

## Reporting
- Record outcomes per scenario (Pass/Fail/Blocked) with notes on data used, latency, and any Gemini model warnings.
- Capture console logs and network traces for AI calls to assist in debugging and regression tracking.

## Regression Criteria
- Any failure in the matrix above requires triage before release. Prioritize AI regressions that affect streaming, validation, or safety settings sourced from `services/gemini/geminiCore.ts`.
