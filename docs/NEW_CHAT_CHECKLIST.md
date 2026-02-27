# New Chat Checklist

## 1) Quick Start
- Open `AGENTS.md`.
- Open `docs/LLM_CONTEXT.md`.
- Identify task type: `plugin` or `proxy`.

## 2) Where To Edit
- `plugin` tasks: `src/lordfilm.js`.
- `proxy` tasks: `proxy/worker.js` and/or `proxy/wrangler.toml`.

## 3) Required Commands
```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1
node --check src\lordfilm.js
node --check lordfilm.js
node --check proxy\worker.js
```

## 4) When To Deploy Worker
- Only if files in `proxy/*` changed:
```powershell
cd proxy
npx wrangler deploy
```

## 5) What To Include In Final Reply
- Changed files.
- Executed checks.
- Whether Worker was deployed.
- Required Lampa actions (restart/cache clear).
