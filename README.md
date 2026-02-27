# Lordfilm Aggregator for Lampa

Модульный плагин-агрегатор `Lordfilm Aggregator` для Lampa:
- параллельный опрос провайдеров через `Promise.allSettled`
- fail-fast таймаут на провайдера (по умолчанию 5000 мс)
- динамическая выдача источников в карточке (появляются по мере ответа)
- источники: `LordFilm`, `Collaps`, `Alloha`, `Kodik`, `CDNVideoHub`, `Rezka`, `Filmix`, `Kinobase`
- Cloudflare Worker прокси (`/proxy`, `/stream`) с `Referer/Origin` override, m3u8 rewrite и cookie proxy

## Структура
- `AGENTS.md` — инструкция для новых LLM-чатов
- `src/core/*.js` — сетевой слой, утилиты, оркестрация
- `src/providers/*.js` — провайдеры
- `src/index.js` — UI/компонент плагина
- `src/lordfilm.js` — bundled output (генерируется)
- `lordfilm.js` — release-файл (генерируется)
- `scripts/build-plugin.ps1` — сборка модулей в bundle
- `scripts/sync-plugin.ps1` — алиас на сборку (совместимость)
- `proxy/worker.js` — Cloudflare Worker прокси
- `proxy/wrangler.toml` — allowlists/timeout

## Для новых LLM чатов
1. `AGENTS.md`
2. `README.md`
3. `docs/LLM_CONTEXT.md`
4. Только целевые файлы по задаче

## Локальная разработка
1. Изменяйте код в `src/core/*`, `src/providers/*`, `src/index.js`.
2. Соберите плагин:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\build-plugin.ps1
```

3. Проверка синхронизации bundle:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\sync-plugin.ps1 -CheckOnly
```

4. Проверка синтаксиса:

```powershell
node --check src\index.js
node --check src\lordfilm.js
node --check lordfilm.js
node --check proxy\worker.js
```

## Подключение в Lampa
1. Используйте ссылку:
- `https://cdn.jsdelivr.net/gh/iwalker2005/lampa-lordfilm-plugin@main/lordfilm.js`
- короткая ссылка через Worker: `https://lordfilm-proxy-iwalker2005.ivonin38.workers.dev/p`
2. В Lampa: `Настройки -> Расширения -> Добавить плагин -> URL`.
3. Полностью перезапустите Lampa.

## Настройки (Lampa.Storage)
- `lordfilm_proxy_url`
- `lordfilm_proxy_token`
- `lordfilm_base_url`
- `lordfilm_extra_bases`
- `lordfilm_provider_enabled_<provider>`
- `lordfilm_debug`
- `lordfilm_kodik_token`
- `lordfilm_alloha_token`
- `lordfilm_rezka_worker_url`
- `lordfilm_filmix_worker_url`
- `lordfilm_kinobase_worker_url`

## Проверка после установки
1. Откройте карточку фильма/сериала.
2. Выберите источник `LordFilm+`.
3. Проверьте:
- источники появляются постепенно
- есть маркировка качества и провайдера
- старт воспроизведения работает для доступных вариантов

## Changelog
### 2.0.0
- модульная архитектура (`src/core`, `src/providers`, `src/index.js`)
- мульти-источниковый агрегатор с `Promise.allSettled`
- динамическая загрузка источников в UI
- расширенный Worker: `rf/of`, cookie proxy, `Set-Cookie`, обновленные allowlists
- сборка через `scripts/build-plugin.ps1`