---
name: git-pat-on-server
description: GitHub PAT для серверных push-ов живёт в /root/smm-system/.env (GITHUB_PAT) и подключён через credential.helper=store на сервере seo (5.42.112.17).
metadata: 
  node_type: memory
  type: reference
  originSessionId: bc22823f-e514-4f26-b1cb-b65b39d36835
---

**Где токен:** `/root/smm-system/.env` → `GITHUB_PAT=ghp_...` (приватный, в `.gitignore`).

**Как git его использует:** `/root/.git-credentials` (600) с одной строкой `https://x-access-token:<PAT>@github.com` + `git config --global credential.helper store`.

**Сетап (если переустанавливаешь сервер):**
```bash
PAT=$(grep "^GITHUB_PAT=" /root/smm-system/.env | cut -d= -f2-)
umask 077
printf "https://x-access-token:%s@github.com\n" "$PAT" > /root/.git-credentials
chmod 600 /root/.git-credentials
git config --global credential.helper store
```

**Почему важно:** без этого `git push` с сервера падает с `could not read Username for 'https://github.com'`, и любые **серверные авто-коммиты** застревают локально на сервере, не доезжают до GitHub. У оператора локально их не видно, при ребилде сервера — теряются.

**Симптом:** локально `git log origin/main` отстаёт от того, что на сервере. Чинится одним `ssh root@5.42.112.17 'cd /root/smm-system && git push origin main'`.
