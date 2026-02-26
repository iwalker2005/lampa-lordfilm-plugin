# LordFilm Plugin for Lampa

Плагин-источник `LordFilm` для Lampa с поддержкой фильмов и сериалов:
- поиск по карточке Lampa (`title/original_title/year`)
- матчинг результатов
- выбор озвучки/качества
- для сериалов: сезоны/серии/автопереход через плейлист
- локальные `избранное`, `прогресс`, `последний выбор`
- работа через прокси (`/proxy`, `/stream`)

## Структура
- `lordfilm.js` — основной плагин
- `proxy/worker.js` — Cloudflare Worker прокси
- `proxy/README.md` — деплой прокси
- `docs/ТЗ_LordFilm_Lampa_v1.1.md` — ТЗ

## Подключение в Lampa
1. Опубликуйте `lordfilm.js` по прямой ссылке (`raw.githubusercontent.com` или GitHub Pages).
2. В Lampa откройте: `Настройки -> Расширения -> Добавить плагин -> URL`.
3. Вставьте прямую ссылку на `lordfilm.js`.

## Обязательная настройка прокси
Плагин использует ключи `Lampa.Storage`:
- `lordfilm_proxy_url`
- `lordfilm_proxy_token`
- `lordfilm_base_url` (по умолчанию `https://lordfilm-2026.org`)

Пример (в консоли Lampa/Web):

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
### 1.0.0
- реализован `lordfilm.js` (MVP)
- реализован Cloudflare Worker прокси (`/health`, `/proxy`, `/stream`)
- добавлены README и документация
