# survey-service

Лёгкий self-hosted опросник-бриф на SurveyJS. Клиент заполняет форму по ссылке →
ответ падает в S3 → Claude у оператора забирает по токену через read-API и заводит
проект. Без внешних SaaS, без VPN для клиента, без ежемесячной платы.

Дизайн: `docs/superpowers/specs/2026-06-20-survey-intake-form-design.md`.

## Что внутри
- `server.mjs` — http-сервер (голый `node:http`), порт `4020`.
- `lib.mjs` — чистые хелперы (slugify, ключ заявки, разворот ответов). Тесты — `lib.test.mjs`.
- `public/` — форма: `index.html`, `survey.json` (32 вопроса брифа), `vendor/` (SurveyJS 2.5, вендорим локально — без CDN).

## Маршруты
- `GET /` — форма (публично).
- `GET /survey.json` — описание формы (TG оператора подставляется из env).
- `POST /submit` — публично: ответ клиента → `s3://<bucket>/smm/intake/{дата}-{бренд}-{rand}.json`.
  Защита: honeypot-поле, rate-limit 20/час на IP, лимит тела 256 КБ.
- `GET /api/intake?since=<ISO>&limit=N` — **токен**: список заявок.
- `GET /api/intake/{key}` — **токен**: одна заявка (вопрос→ответ).
  Auth: заголовок `Authorization: <SURVEY_API_KEY>`.

## Env
| Переменная | Назначение | Дефолт |
|---|---|---|
| `S3_ENDPOINT` `S3_BUCKET` `S3_ACCESS_KEY` `S3_SECRET_KEY` `S3_REGION` | хранилище заявок | — / `ru-1` |
| `SURVEY_API_KEY` | токен read-API (обязателен) | — |
| `OPERATOR_TG` | TG оператора на вступительном экране | `@krMaxim` |
| `INTAKE_PREFIX` | префикс ключей в S3 | `smm/intake/` |
| `PORT` | порт | `4020` |

## Локально
```bash
SURVEY_API_KEY=dev INTAKE_PREFIX=smm/intake/_test/ PORT=4099 node server.mjs
# тесты:
node --test
```

## Деплой на seo (5.42.112.17)
1. **DNS (оператор):** A-запись `survey.bitandpix.ru → 5.42.112.17`.
2. Собрать/запустить контейнер (env передать через `--env-file` или compose):
   ```bash
   docker build -t survey-service tools/survey-service
   docker run -d --name survey-service --restart unless-stopped \
     -p 127.0.0.1:4020:4020 --env-file /opt/survey-service.env survey-service
   ```
3. **nginx-vhost** `survey.bitandpix.ru` → `proxy_pass http://127.0.0.1:4020;`
   (как `tech.bitandpix.ru`), TLS через certbot.
4. Дать оператору в `.env`: `SURVEY_API_URL=https://survey.bitandpix.ru` +
   `SURVEY_API_KEY=<тот же токен>`.

## Забрать заявки (оператор)
```bash
node tools/intake/check.mjs                 # список
node tools/intake/check.mjs --get <key>     # одна целиком
```
