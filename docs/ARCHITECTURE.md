# Архитектура проекта LordFilm для Lampa

## 1. Назначение
Проект состоит из двух частей:
- Плагин Lampa (`src/lordfilm.js`), который ищет контент, подбирает источники и запускает плеер.
- Cloudflare Worker прокси (`proxy/worker.js`), который решает сетевые ограничения (CORS, whitelist, stream proxy).

## 2. Компоненты

### 2.1 Плагин (`src/lordfilm.js`)
Основные обязанности:
- интеграция в UI Lampa (кнопка источника `LordFilm`);
- матчинг карточки Lampa -> карточка на источнике;
- парсинг нескольких типов сайтов:
  - DLE-источник (`lordfilm-2026.org`),
  - WP-источник (`spongebob-squarepants-lordfilms.ru`);
- извлечение плеерных данных:
  - `plapi` playlist/video,
  - embed-потоки (`api.namy.ws` -> HLS/DASH);
- выбор качества/озвучки/серий;
- локальное сохранение избранного и прогресса.

### 2.2 Release файл (`lordfilm.js`)
- Это файл, который реально подключает Lampa (через CDN или `/p`).
- Должен быть всегда синхронизирован с `src/lordfilm.js`.

### 2.3 Worker (`proxy/worker.js`)
Эндпоинты:
- `GET /health` - проверка доступности.
- `GET /proxy?url=...` - прокси HTML/API-запросов.
- `GET /stream?url=...` - прокси видеопотоков и m3u8 rewrite.
- `GET /p` (и `/plugin`, `/plugin.js`, `/`) - отдача JS плагина.

### 2.4 Конфиг деплоя (`proxy/wrangler.toml`)
Критичные переменные:
- `ALLOWED_HOSTS`
- `VIDEO_ALLOWED_HOSTS`
- `UPSTREAM_TIMEOUT_MS`

## 3. Структура репозитория

```text
lampa-plugin/
|-- AGENTS.md
|-- README.md
|-- lordfilm.js
|-- src/
|   `-- lordfilm.js
|-- scripts/
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

## 4. Основной поток данных
1. Пользователь открывает карточку в Lampa и выбирает `LordFilm`.
2. Плагин формирует поисковые запросы (`title`, `original_title`, `original_name`).
3. Плагин ищет кандидатов на источниках и ранжирует матч.
4. После выбора карточки:
   - либо загружается `plapi` playlist/video,
   - либо извлекаются embed-потоки (`api.namy.ws`).
5. Формируется quality map и запускается `Lampa.Player`.
6. Прогресс/избранное сохраняются в `Lampa.Storage`.

## 5. Технические правила изменений
- Менять плагин только в `src/lordfilm.js`.
- После правок запускать `scripts/sync-plugin.ps1`.
- Проверки:
  - `node --check src/lordfilm.js`
  - `node --check lordfilm.js`
  - `node --check proxy/worker.js` (если трогали прокси)
- При изменениях `proxy/*` делать `npx wrangler deploy`.

## 6. Типовые причины инцидентов
- Источник поменял верстку/селекторы (`parseSearch`, `parsePlayerMeta`).
- Источник сменил домен и не обновлён whitelist в Worker.
- HLS манифест содержит относительные URI и не переписан.
- Плагин и release-файл рассинхронизированы.

## 7. Production URL
- Worker: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- Plugin short URL: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
- Plugin CDN URL: `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`
