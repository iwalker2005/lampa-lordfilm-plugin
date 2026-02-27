# LLM Context Guide (Actionable)

## Read Order
1. `AGENTS.md`
2. `README.md`
3. Этот файл
4. `docs/NEW_CHAT_CHECKLIST.md`
5. Только целевые файлы по задаче

## Source Of Truth
- Для плагина всегда редактировать `src/lordfilm.js`.
- После правок синхронизировать в `lordfilm.js`:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1`

## Target Files By Task
- Не находит контент:
  - `src/lordfilm.js` -> `parseSearch`, `resolveMatch`, `searchUrl`.
- Контент найден, но плеер не стартует:
  - `src/lordfilm.js` -> `parsePlayerMeta`, `parseEmbedSources`, `loadEmbedSources`.
- `levelLoadError` / HLS проблемы:
  - `src/lordfilm.js` -> `sproxy`, `qualityMap`.
  - `proxy/worker.js` -> `rewriteM3u8Body`, `/stream`.
- CORS/403/404:
  - `proxy/worker.js`, `proxy/wrangler.toml`.

## Minimal Check Commands
```powershell
node --check src\lordfilm.js
node --check lordfilm.js
node --check proxy\worker.js
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1 -CheckOnly
```

## Deploy Commands
- Только при изменениях в `proxy/*`:
```powershell
cd proxy
npx wrangler deploy
```

## Stable URLs
- Worker: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- Plugin short URL: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
- Plugin CDN URL: `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`

## Context Rules
- Не открывать весь репозиторий сразу.
- Использовать `rg` и чтение точечных участков.
- Документацию менять только если изменилась логика/процесс.
