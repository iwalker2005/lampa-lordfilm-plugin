# Cloudflare Worker Proxy (LordFilm)

## Что делает
- `GET /health`
- `GET /proxy?url=<encoded_target_url>`
- `GET /stream?url=<encoded_video_url>`

Поддерживает:
- `X-Proxy-Token` (или `token` query для `/stream`)
- CORS для Lampa
- whitelist хостов
- проброс `Range`/`Content-Range` для стрима

## Переменные окружения
- `PROXY_TOKEN` — обязательный секрет (рекомендуется)
- `ALLOWED_HOSTS` — список хостов для `/proxy` через запятую
- `VIDEO_ALLOWED_HOSTS` — список хостов для `/stream` через запятую
- `UPSTREAM_TIMEOUT_MS` — таймаут upstream (по умолчанию `12000`)

Пример:

```txt
PROXY_TOKEN=very_secret_token
ALLOWED_HOSTS=lordfilm-2026.org,plapi.cdnvideohub.com,player.cdnvideohub.com,*.okcdn.ru
VIDEO_ALLOWED_HOSTS=*.okcdn.ru,plapi.cdnvideohub.com
UPSTREAM_TIMEOUT_MS=12000
```

## Деплой
1. Установите `wrangler`:
   ```bash
   npm i -g wrangler
   ```
2. Авторизуйтесь одним из способов:
   - OAuth: `npx wrangler login`
   - API token: `set CLOUDFLARE_API_TOKEN=<token>`
3. В папке `proxy/` уже есть готовый `wrangler.toml`.
4. Опционально задайте токен прокси:
   ```bash
   npx wrangler secret put PROXY_TOKEN
   ```
5. Деплой:
   ```bash
   npx wrangler deploy
   ```

## Проверка
- `GET https://<worker>/health` -> `{"ok":true,...}`
- `GET https://<worker>/proxy?url=https%3A%2F%2Flordfilm-2026.org%2F` с `X-Proxy-Token`
