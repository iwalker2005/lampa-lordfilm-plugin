# AGENTS.md - Project Guide For New LLM Chats

## Project Goal
Lampa plugin source `LordFilm` + Cloudflare Worker proxy.

## Start In A New Chat
1. Read `README.md`.
2. Read `docs/LLM_CONTEXT.md`.
3. Open only target files for the current task.

## File Map
- `src/core/*.js` - shared helpers (`utils`, `network`, provider runner).
- `src/providers/*.js` - provider modules (LordFilm, Collaps, Kodik, Alloha, etc.).
- `src/index.js` - Lampa UI/component entrypoint.
- `src/lordfilm.js` - bundled plugin output (generated).
- `lordfilm.js` - release file used by Lampa/CDN (generated).
- `proxy/worker.js` - Worker proxy (`/health`, `/proxy`, `/stream`, `/p`).
- `proxy/wrangler.toml` - deploy config and host allowlists.
- `scripts/build-plugin.ps1` - build bundle from modular `src/*`.
- `scripts/sync-plugin.ps1` - alias for build script (kept for compatibility).
- `docs/` - context, architecture, spec.

## Required Workflow
1. Edit plugin code in modular files under `src/core/*`, `src/providers/*`, `src/index.js`.
2. Build bundled files:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\build-plugin.ps1`
   - or compatibility alias: `powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1`
3. Validate syntax:
   - `node --check src/index.js`
   - `node --check src/lordfilm.js`
   - `node --check lordfilm.js`
   - if proxy touched: `node --check proxy/worker.js`
4. If `proxy/worker.js` or `proxy/wrangler.toml` changed, deploy Worker:
   - `cd proxy`
   - `npx wrangler deploy`
5. Commit only related files and push.

## Fast Debug Map
- "Content not found": `src/providers/lordfilm.js` (`resolveCandidate`, `searchByGroup`, `searchDuckDuckGo`), provider toggles in settings.
- `levelLoadError`: Worker `rewriteM3u8Body`, stream proxy headers, `VIDEO_ALLOWED_HOSTS`.
- Content exists on site but does not start: provider parser module for that source + Worker (`/proxy`, `/stream`) headers/cookies.
- CORS/403/404: `proxy/worker.js` + `proxy/wrangler.toml`.

## Stable Production URLs
- Worker: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- Short plugin URL: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
- CDN plugin URL: `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`

## Definition Of Done
- Bug is reproduced and fixed.
- Local checks passed.
- Worker deployed if proxy changed.
- `src/lordfilm.js` and `lordfilm.js` are in sync.
- Docs updated if workflow/architecture changed.
