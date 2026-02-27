# Архитектура и структура проекта LordFilm для Lampa

## 1. Назначение
Проект реализует источник `LordFilm` для Lampa:
- ищет контент по карточке фильма/сериала;
- получает доступные потоки, озвучки, качества;
- запускает воспроизведение через `Lampa.Player`;
- сохраняет избранное и прогресс локально;
- использует Cloudflare Worker как прокси для обхода CORS и унификации сетевого доступа.

## 2. Компоненты системы

### 2.1 Клиентский плагин (`lordfilm.js`)
Зона ответственности:
- интеграция в UI Lampa (кнопка/источник LordFilm);
- матчинг карточки Lampa и результата источника;
- загрузка плейлиста и потоков;
- экран выбора серий/озвучек/качеств;
- сохранение пользовательского состояния в `Lampa.Storage`.

### 2.2 Прокси-слой (`proxy/worker.js`)
Зона ответственности:
- проксирование запросов к источнику и видеохостам;
- CORS-заголовки для Lampa;
- whitelist разрешенных доменов;
- обработка `Range`-запросов для стриминга;
- короткий endpoint плагина (`/p`), отдающий JS плагина.

### 2.3 Конфигурация деплоя (`proxy/wrangler.toml`)
Содержит:
- имя Worker;
- точку входа (`worker.js`);
- переменные окружения (`ALLOWED_HOSTS`, `VIDEO_ALLOWED_HOSTS`, `UPSTREAM_TIMEOUT_MS`).

## 3. Структура репозитория

```text
lampa-plugin/
├── lordfilm.js
├── README.md
├── ТЗ_LordFilm_Lampa_v1.1.md
├── docs/
│   ├── ТЗ_LordFilm_Lampa_v1.1.md
│   └── ARCHITECTURE.md
└── proxy/
    ├── worker.js
    ├── wrangler.toml
    └── README.md
```

## 4. Потоки данных

### 4.1 Подключение плагина
1. Lampa загружает JS плагина по URL расширения.
2. Плагин регистрирует компонент `lordfilm`.
3. На карточке добавляется кнопка/точка входа в LordFilm.

### 4.2 Поиск и матчинг контента
1. Плагин берет данные карточки (`title`, `original_title`, `year`, IDs).
2. Выполняет поиск на источнике через прокси.
3. Считает score кандидатов и выбирает лучший матч.
4. Из карточки источника извлекает `titleId/publisherId`.

### 4.3 Получение потоков и запуск
1. Плагин запрашивает playlist API.
2. Для выбранного эпизода/фильма запрашивает video API.
3. Формирует карту качеств (HLS/DASH/MP4).
4. Запускает `Lampa.Player` и плейлист.

### 4.4 Состояние пользователя
Хранится в `Lampa.Storage`:
- `lordfilm_favorites`
- `lordfilm_progress`
- `lordfilm_last_choice`
- `lordfilm_match_cache`
- `lordfilm_proxy_url`
- `lordfilm_proxy_token`
- `lordfilm_base_url`

## 5. HTTP-контракт Worker

### `GET /health`
Проверка доступности Worker.

### `GET /proxy?url=<encoded>`
Прокси для HTML/API-ответов источника.

### `GET /stream?url=<encoded>`
Прокси для видео (включая `Range` и `Content-Range`).

### `GET /p` (также `/plugin`, `/plugin.js`, `/`)
Отдает JS плагина напрямую с `200` и `Content-Type: application/javascript`.

## 6. Конфигурация по умолчанию
- `lordfilm_base_url`: `https://lordfilm-2026.org`
- `lordfilm_proxy_url`: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- `lordfilm_proxy_token`: пустой (не обязателен)

## 7. Развертывание
1. Код плагина хранится в GitHub-репозитории.
2. Lampa подключает плагин по URL (`jsdelivr` или короткий Worker URL `/p`).
3. Worker деплоится через Wrangler в Cloudflare и работает независимо от локального ПК.

## 8. Ограничения и риски
- Источник может менять DOM/контракт API, что требует обновления парсеров.
- Возможны блокировки по сети/VPN и временная недоступность доменов.
- Качество/наличие потоков зависит от внешних провайдеров.
