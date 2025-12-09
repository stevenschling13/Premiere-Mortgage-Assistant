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

