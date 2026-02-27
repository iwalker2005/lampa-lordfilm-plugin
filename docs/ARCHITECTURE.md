# Архитектура проекта Lordfilm Aggregator для Lampa

## 1. Назначение
Проект состоит из двух частей:
- Модульный плагин Lampa (агрегатор провайдеров).
- Cloudflare Worker прокси (CORS, headers rewrite, stream proxy, m3u8 rewrite, cookie proxy).

## 2. Компоненты

### 2.1 Плагин
- `src/core/utils.js` — конфиг, storage, нормализация, score, dedupe.
- `src/core/network.js` — fetch/proxy слой, таймауты, stream-proxy helpers.
- `src/core/providers.js` — оркестрация провайдеров (`Promise.allSettled`, fail-fast timeout).
- `src/providers/*.js` — источники:
  - `lordfilm.js` (зеркала + SEO домены + dynamic slug + DuckDuckGo fallback)
  - `collaps.js`
  - `alloha.js`
  - `kodik.js`
  - `cdnvideohub.js`
  - `rezka.js`
  - `filmix.js`
  - `kinobase.js`
- `src/index.js` — UI-компонент Lampa, кнопка `LordFilm+`, динамическое пополнение списка.

### 2.2 Bundle/Release
- `src/lordfilm.js` — generated bundle.
- `lordfilm.js` — generated release файл для CDN/Lampa.

### 2.3 Worker (`proxy/worker.js`)
Эндпоинты:
- `GET /health`
- `GET|HEAD|POST /proxy?url=...`
- `GET|HEAD /stream?url=...`
- `GET /p` (и `/plugin`, `/plugin.js`, `/`) — отдача JS плагина

Поддержка:
- `rf` (`Referer` override), `of` (`Origin` override)
- `X-Proxy-Cookie` / `cookie` passthrough
- `Set-Cookie` passthrough
- rewrite `.m3u8` относительных ссылок на `/stream`

## 3. Структура репозитория

```text
lampa-plugin/
|-- AGENTS.md
|-- README.md
|-- lordfilm.js
|-- src/
|   |-- core/
|   |-- providers/
|   |-- index.js
|   `-- lordfilm.js
|-- scripts/
|   |-- build-plugin.ps1
|   `-- sync-plugin.ps1
|-- proxy/
|   |-- worker.js
|   |-- wrangler.toml
|   `-- README.md
`-- docs/
    |-- LLM_CONTEXT.md
    |-- SPEC.md
    |-- ARCHITECTURE.md
    `-- ТЗ_LordFilm_Lampa_v1.1.md
```

## 4. Поток данных
1. Пользователь открывает карточку и выбирает `LordFilm+`.
2. Компонент запускает активные провайдеры параллельно (`Promise.allSettled`).
3. Каждый провайдер возвращает варианты воспроизведения или ошибку (до 5000 мс).
4. UI обновляется по мере ответов (без ожидания всех провайдеров).
5. При выборе пункта извлекается `sourceMap`, выбирается качество, запускается `Lampa.Player`.

## 5. Технические правила изменений
- Изменения вносятся в модульные файлы (`src/core/*`, `src/providers/*`, `src/index.js`).
- После правок запускать:
  - `powershell -ExecutionPolicy Bypass -File .\scripts\build-plugin.ps1`
- Проверки:
  - `node --check src/index.js`
  - `node --check src/lordfilm.js`
  - `node --check lordfilm.js`
  - `node --check proxy/worker.js` (если трогали прокси)
- При изменениях `proxy/*` деплой:
  - `cd proxy`
  - `npx wrangler deploy`

## 6. Типовые причины инцидентов
- Изменился HTML/JS конкретного провайдера.
- Неактуальный `ALLOWED_HOSTS`/`VIDEO_ALLOWED_HOSTS` в Worker.
- Источник требует специфические `Referer/Origin/Cookie`.
- Bundle не пересобран после изменений модулей.

## 7. Production URL
- Worker: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- Plugin short URL: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
- Plugin CDN URL: `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`