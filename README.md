# LordFilm Plugin for Lampa

Плагин-источник `LordFilm` для Lampa с поддержкой фильмов и сериалов:
- поиск по карточке Lampa (`title/original_title/year`)
- матчинг результатов
- выбор озвучки/качества
- для сериалов: сезоны/серии/автопереход через плейлист
- локальные `избранное`, `прогресс`, `последний выбор`
- работа через прокси (`/proxy`, `/stream`)

## Структура
- `src/lordfilm.js` — исходник плагина (source of truth)
- `lordfilm.js` — release-файл для подключения в Lampa (синхронизируется из `src/`)
- `proxy/worker.js` — Cloudflare Worker прокси
- `proxy/README.md` — деплой прокси
- `scripts/sync-plugin.ps1` — синхронизация `src/lordfilm.js -> lordfilm.js`
- `docs/ТЗ_LordFilm_Lampa_v1.1.md` — ТЗ
- `docs/ARCHITECTURE.md` — архитектура (полная версия)
- `docs/LLM_CONTEXT.md` — краткая карта проекта для LLM (минимальный контекст)
- `docs/SPEC.md` — entrypoint к требованиям без лишнего контекста

## Локальная разработка
1. Вносите изменения в `src/lordfilm.js`.
2. Синхронизируйте release-файл:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1
```

3. (Опционально) проверка синхронизации:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1 -CheckOnly
```

## Подключение в Lampa
1. Используйте стабильную ссылку с корректным JS MIME:
   - `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`
   - короткая ссылка через Worker: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
2. Альтернатива (может блокироваться в части окружений): `raw.githubusercontent.com`.
2. В Lampa откройте: `Настройки -> Расширения -> Добавить плагин -> URL`.
3. Вставьте ссылку и подтвердите установку.
4. Полностью перезапустите Lampa и заново откройте карточку фильма.

## Обязательная настройка прокси
Плагин использует ключи `Lampa.Storage`:
- `lordfilm_proxy_url`
- `lordfilm_proxy_token`
- `lordfilm_base_url` (по умолчанию `https://lordfilm-2026.org`)

По умолчанию уже прописан рабочий Cloudflare Worker:
- `lordfilm_proxy_url = https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev`
- `lordfilm_proxy_token = ''` (не обязателен)

Пример (в консоли Lampa/Web, после деплоя Worker):

```js
Lampa.Storage.set('lordfilm_proxy_url', 'https://<your-worker>.workers.dev');
Lampa.Storage.set('lordfilm_proxy_token', '<YOUR_SECRET_TOKEN>');
Lampa.Storage.set('lordfilm_base_url', 'https://lordfilm-2026.org');
```

## Локальные данные
- `lordfilm_favorites`
- `lordfilm_progress`
- `lordfilm_last_choice`
- `lordfilm_match_cache`

## Проверка после установки
1. Откройте карточку фильма/сериала.
2. Выберите источник `LordFilm`.
3. Проверьте:
- поиск и старт воспроизведения
- выбор озвучки/качества
- сезоны/серии для сериалов
- сохранение прогресса и избранного

## Известные ограничения
- Верстка и домены источника могут меняться.
- При смене домена обновите `lordfilm_base_url` и whitelist прокси.
- Если `lordfilm_proxy_url` не задан, на части устройств работа может быть нестабильной из-за CORS.

## Changelog
### 1.0.7
- фикс `levelLoadError` для HLS: Worker переписывает относительные URI внутри m3u8 в проксированные `/stream` ссылки

### 1.0.6
- исправлено определение типа контента (фильмы больше не определяются как `S1E1`)
- улучшен матчинг поиска: используются все запросы (`title/original`) и более мягкий порог для карточек с кривым/пустым годом на источнике
- повышена стабильность старта: при отсутствии принудительного выбора качества используется `Auto HLS`

### 1.0.5
- фикс прокси стримов: добавлен `*.vkuser.net` в whitelist `/stream`
- фикс wildcard-сопоставления хостов в Worker (`*.domain` теперь покрывает и корневой хост)
- фикс обработки proxy-ошибок в клиенте (ошибки больше не проглатываются)
- защита от двойной инициализации плагина

### 1.0.1
- фикс инициализации (`watchers`, `CONTEXT_BTN_CLASS`, `log`)
- добавлена рабочая GitHub-ссылка для подключения плагина в Lampa

### 1.0.2
- улучшена инициализация плагина (app-ready bootstrap)
- улучшено добавление кнопки в меню `Источник`
- рекомендация подключения через jsDelivr

### 1.0.3
- добавлен прокси URL по умолчанию (без ручной настройки)
- обновлен дефолтный запуск через готовый Cloudflare Worker

### 1.0.4
- исправлен вывод `[object Object]` в списке серий
- добавлена короткая ссылка плагина через Worker (`/p`)

### 1.0.0
- реализован `lordfilm.js` (MVP)
- реализован Cloudflare Worker прокси (`/health`, `/proxy`, `/stream`)
- добавлены README и документация
