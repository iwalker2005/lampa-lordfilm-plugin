# LLM Context Guide (Minimal)

## Goal
Use this file to keep LLM context small and focused when working on this repo.

## Read Order
1. `README.md`
2. `docs/LLM_CONTEXT.md` (this file)
3. Only then open one target file for the current task.

## Project Map
- `lordfilm.js`
  - Main Lampa plugin logic.
  - UI integration, search/match, playlist/stream selection, progress/favorites.
- `proxy/worker.js`
  - Cloudflare Worker proxy.
  - Endpoints: `/health`, `/proxy`, `/stream`, `/p`.
- `proxy/wrangler.toml`
  - Worker deploy config and env vars.
- `proxy/README.md`
  - Worker deploy and runtime notes.
- `docs/ARCHITECTURE.md`
  - Full architecture document (long form).
- `docs/SPEC.md`
  - Short ASCII entrypoint to requirements.

## What To Open For Common Tasks
- Plugin UI bug:
  - Open `lordfilm.js` only.
- Source/proxy/CORS bug:
  - Open `proxy/worker.js` first, then `lordfilm.js` only if needed.
- Deploy issue:
  - Open `proxy/wrangler.toml` and `proxy/README.md`.
- Requirements question:
  - Open `docs/SPEC.md` first, then targeted sections only.

## Context Budget Rules
- Do not load all files at once.
- Do not paste full large files into chat.
- Read only relevant sections by search (`rg`) and line ranges.
- Avoid reopening spec/docs unless task scope changes.

## Stable Inputs (Prefer)
- Worker URL:
  - `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- Short plugin URL:
  - `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
- Direct plugin CDN URL:
  - `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`

## Non-Goals For Most Tasks
- Editing full spec text.
- Changing project structure.
- Touching deploy config for UI-only fixes.
