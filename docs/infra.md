# Инфраструктура bit&pix — серверы и egress

> Снято и проверено 12.06.2026 при проработке автопостинга (Postiz). Секреты
> (пароль прокси, токены) — **не** в этом файле: они в `.env` на серверах.
> Обновлять при изменениях.

## Серверы

| Роль | IP | SSH-порт | ОС | Ресурсы |
|------|----|---------:|----|---------|
| Основной «seo» (медиа/S3, сессии CC, кандидат под Postiz) | `5.42.117.201` | **22** | Ubuntu 24.04 | **1.9 GiB RAM**, 2 CPU, 38G диск (27G свободно) |
| Прокси-egress | `5.2.66.188` | **24822** | — | — |

⚠️ **SSH-порты разные:** основной — `22`, прокси — `24822`. (Глобальная заметка
«везде 24822» для основного сервера неверна.) Основной с некоторых IP роняет
коннект на этапе kex (fail2ban/whitelist) — заходить с доверенного IP.

## Прокси (tinyproxy на 5.2.66.188)

- `tinyproxy` слушает `:8888`, `Listen 0.0.0.0`
- **BasicAuth** (логин/пароль — в `.env` как `PROXY_URL`, формат
  `http://<user>:<pass>@5.2.66.188:8888`)
- CONNECT разрешён только на портах **443 / 563** (HTTPS-туннель)
- **Allow-лист по IP:** `127.0.0.1`, `178.253.42.36`, `5.42.117.201`
  (основной сервер уже включён). Новый клиент egress'а → добавить его IP в
  `/etc/tinyproxy/tinyproxy.conf` (`Allow <ip>`) и `systemctl reload tinyproxy`.
- Побочно на этом же хосте: `litellm-proxy` (Docker, `:4000`) + postgres —
  наследие OpenClaw, к постингу отношения не имеет.

## Egress: достижимость соцсетей (проверено curl-пробами 12.06.2026)

| Хост | Прямо с основного (RU) | Через tinyproxy |
|------|:----------------------:|:---------------:|
| `api.vk.com` | ✅ отвечает | ✅ |
| `api.telegram.org` | ✅ отвечает | ✅ |
| `graph.facebook.com` (Meta/IG) | ✅ отвечает | ✅ |
| `platform-api.max.ru` | — | ✅ |

> Пробы подтверждают только TCP+TLS+HTTP-ответ до API-хоста, не реальную работу
> Bot/Graph-вызовов. Telegram периодически режется DPI в РФ → решено гнать
> **весь** исходящий постинг через tinyproxy (равномерно + страховка). VK через
> прокси тоже ок.

## Postiz (развёрнут 12.06.2026)

- RAM апнут **1.9 → 3.8 GiB** + добавлен **2G swap** (`/swapfile`, в fstab).
- **Docker CE 29.5.3 + compose v5.1.4** установлены (офиц. репозиторий).
- Стек в **`/opt/postiz/`** (`docker-compose.yml` + `.env` с `JWT_SECRET`/`PG_PASSWORD`):
  `postiz` (ghcr.io/gitroomhq/postiz-app, **образ 5.66 GB**) + `postiz-postgres`
  (17-alpine) + `postiz-redis` (7.2). Тома: postgres-volume, postiz-uploads,
  postiz-config, postiz-redis-data.
- **UI живой:** `http://5.42.117.201:5000` (порт проброшен, ufw off, доступен снаружи).
  `/auth` → 200. `MAIN_URL/FRONTEND_URL` пока на голый IP:5000 (временно).
- `DISABLE_REGISTRATION=false` — **claim первого админа в UI сразу**, потом
  выставить `true` и пересоздать контейнер.

### Грабли при установке (чтобы не повторять)

- **Образ Postiz 5.66 GB** не проходит через tinyproxy (затыкается, pull не
  финишит). → daemon-прокси настроен **с `NO_PROXY=ghcr.io,pkg-containers.githubusercontent.com`**:
  Docker Hub (postgres/redis) тянем через прокси (обход rate-limit), а Postiz с
  ghcr — **напрямую**. См. `/etc/systemd/system/docker.service.d/http-proxy.conf`.
- **SSH без pty не убивает удалённую команду по клиентскому таймауту** — длинные
  pull'ы осиротели и копились (9 процессов, load 6.8). Для долгих операций на
  сервере: `nohup ... &` + лог-файл + опрос, либо server-side `timeout`.

## Что НЕ сделано (открыто)

- **Домен + HTTPS перед Postiz** — обязателен для OAuth соцсетей (VK и пр. не
  принимают редирект на голый http://IP). Нужен сабдомен на 5.42.117.201 →
  nginx + Let's Encrypt, и переустановка `MAIN_URL/FRONTEND_URL/NEXT_PUBLIC_BACKEND_URL`.
- **VK-приложение** (`VK_CLIENT_ID`/`VK_CLIENT_SECRET` в env Postiz) + тестовое
  сообщество — для первого VK-теста. Был баг провайдера #1398 (client_id=undefined),
  проверить на текущей версии.
- **Egress контейнера Postiz через tinyproxy** (app-level, для Telegram-resilience) —
  пока контейнер ходит напрямую (VK/TG/Meta с сервера достижимы). Hardening-шаг.
- `DISABLE_REGISTRATION=true` после claim первого админа.
