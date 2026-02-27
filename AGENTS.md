# AGENTS.md - Project Guide For New LLM Chats

## Project Goal
Lampa plugin source `LordFilm` + Cloudflare Worker proxy.

## Start In A New Chat
1. Read `README.md`.
2. Read `docs/LLM_CONTEXT.md`.
3. Open only target files for the current task.

## File Map
- `src/lordfilm.js` - plugin source of truth.
- `lordfilm.js` - release file used by Lampa/CDN.
- `proxy/worker.js` - Worker proxy (`/health`, `/proxy`, `/stream`, `/p`).
- `proxy/wrangler.toml` - deploy config and host allowlists.
- `scripts/sync-plugin.ps1` - sync `src/lordfilm.js -> lordfilm.js`.
- `docs/` - context, architecture, spec.

## Required Workflow
1. Edit plugin code only in `src/lordfilm.js`.
2. Sync release file:
   - `powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1`
3. Validate syntax:
   - `node --check src/lordfilm.js`
   - `node --check lordfilm.js`
   - if proxy touched: `node --check proxy/worker.js`
4. If `proxy/worker.js` or `proxy/wrangler.toml` changed, deploy Worker:
   - `cd proxy`
   - `npx wrangler deploy`
5. Commit only related files and push.

## Fast Debug Map
- "Content not found": `parseSearch`, `resolveMatch`, `searchUrl`, `FALLBACK_BASE_URLS`.
- `levelLoadError`: `sproxy`, `qualityMap`, Worker `rewriteM3u8Body`, `VIDEO_ALLOWED_HOSTS`.
- Content exists on site but does not start: `parsePlayerMeta`, `parseEmbedSources`, `loadEmbedSources`, `ALLOWED_HOSTS`.
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
