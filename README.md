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

### Gemini CLI agent

Run an advanced Gemini-powered CLI to draft analyses or playbooks from your terminal. It uses the same API key environment variables as the app (`GEMINI_API_KEY`, `VITE_API_KEY`, or `API_KEY`).

```
npm run ai:cli -- --prompt "Build a Monday morning prep plan" --session discovery --context ./notes/planner.md
```

- `--session <name>` persists your conversation thread to `.cli-sessions/<name>.json` so you can resume later; add `--reset` to clear it first.
- `--context <path>` can be provided multiple times to mount read-only files as grounding context.
- `--system-file <path>` loads your preferred system prompt from disk (overrides `--system`).
- `--json` returns structured output (text, finish reason, and grounded links) for piping into other tools.
- Flags are validated (including session name sanitization and numeric temperatures); run `npm run ai:cli -- --help` for a full option list.

### Test on your local network

The Vite dev server is configured to bind to all interfaces on port 5173 so you can reach it from other devices on the same network. Start it with the usual command (or explicitly pass `--host` if desired):

```
npm run dev

# or
npm run dev -- --host
```

Then open the app from another device using your machine's IP address, for example:

```
http://<laptop-ip>:5173
```

## Project structure

All application source files live under the `src/` directory (entry point: `src/main.tsx`) to avoid duplicate component copies and keep desktop and mobile builds consistent.

## Recommended system instructions for AI Studio

Use this system prompt inside AI Studio to keep the assistant consistent with the CLI and app flows. It mirrors the CLI default and can also be stored in a file and passed via `--system-file`:

```
You are the Premiere Private Banking Assistant. Keep tone professional and calm for both desktop and mobile users.

Operating principles:
- Be concise, numerate, and explicit about risks; surface assumptions before using them.
- Summarize financial numbers with units and timelines; avoid fabricating data or sources.
- Offer at least one low-risk and one stretch action when proposing next steps.
- Prefer grounded responses: rely on provided context and ask for missing details before speculating.
- Prefer Alpha Mode when available to maximize reasoning quality.

Tools and data handling:
- Use the provided conversation history and any mounted context as read-only grounding.
- Call model tools (e.g., search) only when they add verifiable value.
- Do not output secrets or unverifiable claims.
```

