# Развёртывание омниканального инбокса (Chatwoot + шлюз VK/TG) с нуля

Chatwoot мы НЕ форкаем — крутим стоковый образ `chatwoot/chatwoot:latest`.
Вся кастомизация — снаружи: шлюз (`gateway.py`) + конфиг. Обновление Chatwoot =
смена тега образа + миграции, без правок кода.

Текущий прод: сервер `seo` 5.42.117.201 (SSH порт **22**), стек в `/opt/chatwoot`,
домен **https://chat.bitandpix.ru**. Делит сервер с Postiz — см. предупреждение
про certbot/ssh в `docs/omnichannel-inbox.md`.

## 0. Предпосылки
- Сервер с Docker CE + compose, ≥4 GiB RAM свободно (Rails+Sidekiq+PG+Redis).
- Домен с A-записью `chat.<домен>` → IP сервера, порты 80/443 наружу.
- Прокси для Telegram, если сервер в РФ (DPI): `PROXY_URL` (HTTP CONNECT 443).

## 1. Файлы
Скопировать на сервер в `/opt/chatwoot/`:
- `docker-compose.yaml` (из этой папки)
- `gateway/gateway.py`
- `.env` (Chatwoot, см. шаг 2) и `gateway.env` (шлюз, см. шаг 6) — **не в git, секреты**

## 2. .env Chatwoot
```
SECRET_KEY_BASE=<openssl rand -hex 64>
FRONTEND_URL=https://chat.<домен>
DEFAULT_LOCALE=ru
RAILS_ENV=production
NODE_ENV=production
INSTALLATION_ENV=docker
FORCE_SSL=false                 # https терминируется на nginx
ENABLE_ACCOUNT_SIGNUP=false
POSTGRES_HOST=postgres
POSTGRES_USERNAME=postgres
POSTGRES_PASSWORD=<openssl rand -hex 24>
POSTGRES_DATABASE=chatwoot
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=<openssl rand -hex 24>
ACTIVE_STORAGE_SERVICE=local
RAILS_MAX_THREADS=5
```

## 3. Инициализация БД и запуск
```bash
cd /opt/chatwoot
docker compose pull
docker compose run --rm rails bundle exec rails db:chatwoot_prepare   # миграции+сид
docker compose up -d rails sidekiq postgres redis
# проверка: curl -o /dev/null -w '%{http_code}' http://127.0.0.1:3000   (302)
```

## 4. Админ + два API-канала (VK, Telegram)
Скрипт в контейнер и `rails runner` (онбординг-мастер обходим):
```ruby
acc = Account.find_or_create_by!(name: 'bit&pix')
u = User.find_by(email: 'admin@<домен>') ||
    User.new(name:'Admin', email:'admin@<домен>', password:'<PASS>', password_confirmation:'<PASS>').tap{|x| x.skip_confirmation!; x.save!}
AccountUser.find_or_create_by!(account: acc, user: u){|au| au.role=:administrator}
mk = ->(name){ ch=Channel::Api.create!(account:acc, webhook_url:''); Inbox.create!(account:acc, name:name, channel:ch); ch.identifier }
vk = Inbox.find_by(account:acc, name:'VK'); tg = Inbox.find_by(account:acc, name:'Telegram')
vk_id = vk ? vk.channel.identifier : mk.('VK')
tg_id = tg ? tg.channel.identifier : mk.('Telegram')
[Inbox.find_by(account:acc,name:'VK'), Inbox.find_by(account:acc,name:'Telegram')].each{|ib| InboxMember.find_or_create_by!(user:u, inbox:ib)}
at = u.access_token || AccessToken.create!(owner:u)
puts "ACCOUNT_ID=#{acc.id} USER_TOKEN=#{at.token} VK=#{vk_id} TG=#{tg_id}"
```
Запуск: `docker compose cp bootstrap.rb rails:/tmp/b.rb && docker compose exec -T rails bundle exec rails runner /tmp/b.rb`
Сохранить `USER_TOKEN`, `VK`/`TG` identifier'ы.

Снять флаг онбординга (иначе UI редиректит на мастер):
```bash
docker compose exec -T rails bundle exec rails runner \
  "::Redis::Alfred.delete(::Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING)"
```

## 5. Webhook на исходящие -> шлюз
⚠️ **Два подводных камня (оба обязательны, иначе исходящие не уходят):**
1. **URL вебхука должен быть ПУБЛИЧНЫМ** — Chatwoot блокирует доставку на внутренние
   хосты (`gateway:8080`, приватные IP) как SSRF. Поэтому вебхук идёт на
   `https://chat.<домен>/cw-<token>/chatwoot/webhook`, а nginx (шаг 8) проксирует
   этот путь на шлюз (`127.0.0.1:8090`). Шлюз публикует порт на loopback (см. compose).
2. **`extra_hosts` для rails и sidekiq** (в compose):
   `"chat.<домен>:<IP сервера>"`. Иначе контейнер может резолвить домен в старый
   wildcard-IP (DNS-кеш, TTL до суток) и вебхук уйдёт «не туда» (cert mismatch).

Регистрация (после того как nginx-путь поднят, шаг 8):
```bash
TOKEN=$(openssl rand -hex 8)   # тот же, что в nginx location /cw-$TOKEN/
curl -X POST http://127.0.0.1:3000/api/v1/accounts/<ACCOUNT_ID>/webhooks \
  -H "api_access_token: <USER_TOKEN>" -H "Content-Type: application/json" \
  -d "{\"url\":\"https://chat.<домен>/cw-$TOKEN/chatwoot/webhook\",\"subscriptions\":[\"message_created\"]}"
```

## 6. gateway.env (шлюз)
Из `gateway.env.example`: `CHATWOOT_URL=http://rails:3000`, identifier'ы из шага 4,
`CHATWOOT_ACCOUNT_ID`/`CHATWOOT_API_TOKEN` (для аватарок контактов),
`VK_COMMUNITY_TOKEN`/`VK_GROUP_ID`, `TELEGRAM_BOT_TOKEN`, `PROXY_URL` (+ HTTP(S)_PROXY
для pip), `NO_PROXY=rails,redis,postgres,localhost,127.0.0.1,api.vk.com,.vk.com`.
Бэкфилл аватарок существующим контактам (опц.): `docker compose exec -T gateway python /app/backfill_avatars.py`.
```bash
docker compose up -d gateway
docker compose logs -f gateway   # ждём "VK long poll подключён"
```

## 7. Включить VK message_new (иначе сообщения сообщества не приходят!)
```bash
curl "https://api.vk.com/method/groups.setLongPollSettings?group_id=<GID>&access_token=<VK_TOKEN>&v=5.199&enabled=1&api_version=5.199&message_new=1&message_reply=1&message_edit=1&message_allow=1"
```

## 8. nginx + HTTPS
```bash
cp nginx-chat.bitandpix.ru.conf /etc/nginx/sites-available/chat.<домен>
ln -s /etc/nginx/sites-available/chat.<домен> /etc/nginx/sites-enabled/
# (на чистом сервере раскомментируй map $connection_upgrade в конфиге)
nginx -t && systemctl reload nginx
certbot --nginx -d chat.<домен> --agree-tos --redirect -m <email>
```
⚠️ Если на сервере есть другой агент/процесс — **не запускать certbot параллельно**
(общий lock). После HTTPS убедиться, что `FRONTEND_URL` = `https://chat.<домен>`,
и пересоздать: `docker compose up -d --force-recreate rails sidekiq`.

## Эксплуатация
- логи шлюза: `docker compose logs -f gateway`
- рестарт шлюза: `docker compose restart gateway`
- состояние: `docker compose ps`
- обновить Chatwoot: сменить тег в `docker-compose.yaml` → `docker compose pull` →
  `docker compose run --rm rails bundle exec rails db:chatwoot_prepare` → `up -d`
- маппинги контактов шлюза: volume `gateway_data` → `/data/state.json`
