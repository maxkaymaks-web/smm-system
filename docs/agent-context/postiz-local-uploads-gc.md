---
name: postiz-local-uploads-gc
description: "Postiz хранит медиа локально (STORAGE_PROVIDER=local), сам НЕ чистит; есть GC-крон"
metadata:
  node_type: memory
  type: project
---

Postiz у нас `STORAGE_PROVIDER=local`: загруженные картинки/видео лежат на диске
сервера в docker-volume `postiz-uploads` → путь в контейнере `/uploads/ГГГГ/ММ/ДД/<32hex>.<ext>`,
физически `/var/lib/docker/volumes/postiz-official_postiz-uploads/_data`. Volume
**durable** — переживает рестарт контейнера и ребут (теряется только при `down -v`).

Postiz **сам медиа не удаляет** (нет TTL, removeFile дёргается не во всех флоу) →
файлы копились бы вечно. S3-провайдер Postiz умеет ТОЛЬКО Cloudflare R2 (endpoint
захардкожен `${accountID}.r2.cloudflarestorage.com`), наш Timeweb S3 без патча не
подключить — поэтому остаёмся на local + чистим кроном.

**GC:** скрипт `tools/postiz/uploads-gc.mjs` (в репо) задеплоен на сервер
`/opt/postiz-official/scripts/uploads-gc.mjs`, крон `/etc/cron.d/postiz-uploads-gc`
гоняет ежедневно 04:00 с `--apply`, лог `/var/log/postiz-uploads-gc.log`. Логика:
удаляет файлы старше 30 дней, КРОМЕ привязанных к живым постам `QUEUE`/`DRAFT` или с
будущим `publishDate` (keep-set из таблицы `Post`, колонка `image` = JSON
`[{id,path}]`); чистит пустые папки дат + soft-delete осиротевших строк `Media`.
Dry-run по умолчанию, удаляет только с `--apply`. Сервер seo 5.42.117.201 (SSH 22).

Связано: [postiz-vk-telegram-integration](postiz-vk-telegram-integration.md), [smm-servers-and-egress](smm-servers-and-egress.md).
