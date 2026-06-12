# Подключение Google Drive и Notion — доступы и креды

Эта инструкция — **для того, кто настраивает систему один раз** (начальник или
разработчик). На выходе — набор кредов в `.env`, который **раздаётся операторам**:
каждый оператор кладёт их в свой `.env` в корне репозитория, и его локальный Claude Code
получает доступ к Google Drive и Notion.

> Все креды — секреты. В git **не коммитим** (`.env` в `.gitignore`). Раздаём команде
> по защищённому каналу, не в открытых чатах.

---

## 🟦 Google Drive (service-account)

Claude Code ходит в Drive программно через service-account (тул `tools/gdrive.mjs`).

### Шаг 1. Завести service-account (один раз)
1. [console.cloud.google.com](https://console.cloud.google.com) → создать проект
   (или взять существующий).
2. **APIs & Services → Library** → найти **Google Drive API → Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Имя любое (напр. `smm-gdrive`). Роль можно не давать. Create.
4. Открыть созданный service-account → вкладка **Keys → Add key → Create new key →
   JSON.** Скачается файл `*.json` — это и есть ключ.
5. В JSON есть поле `client_email` вида `smm-gdrive@…iam.gserviceaccount.com` —
   **запомни этот адрес**, он нужен в шаге 2.

### Шаг 2. Дать доступ к рабочей папке
- Открыть нужную папку в Google Drive → **правый клик → «Открыть доступ» (Share)**.
- Вставить адрес `client_email` из шага 1, роль — **Редактор (Editor)**.
- Теперь service-account видит и пишет ровно в эту папку и её подпапки, больше никуда.

> ⚠️ **Для заливки файлов нужен Общий диск (Shared Drive).** Если папка лежит в обычном
> «Моём диске», service-account сможет читать/править, но новые файлы, которые он зальёт,
> упрутся в **нулевую квоту** service-account (ограничение Google). Чтобы заливка постов
> работала — держи рабочую папку в **Shared Drive** и добавь service-account участником
> этого Общего диска (Editor). Бонус: туда же оператор/клиент могут докинуть файл руками.

### Что попадает в `.env`
- Положить JSON-ключ в корень репо как `gdrive-sa.json` (уже под `.gitignore` как `.env`;
  если нет — добавить в `.gitignore`).
- В `.env`:
  ```
  GOOGLE_APPLICATION_CREDENTIALS=./gdrive-sa.json
  GDRIVE_ROOT_FOLDER_ID=<ID папки или Общего диска>
  ```
  `GDRIVE_ROOT_FOLDER_ID` — это часть URL папки после `/folders/`.

---

## 🟧 Notion (Internal Integration Secret)

Claude Code работает с Notion через **внутреннюю интеграцию** (один общий секрет на
команду). Этот же секрет питает локальный Notion MCP-сервер (точную команду запуска
пропишет разработчик на Фазе 2 — см. дизайн-спеку).

### Шаг 1. Создать интеграцию (один раз)
1. [notion.so/my-integrations](https://www.notion.so/my-integrations) → **New
   integration** → имя `smm-system`, выбрать рабочее пространство → Submit.
2. Скопировать **Internal Integration Secret** (`ntn_…` / `secret_…`).

### Шаг 2. Расшарить нужные страницы/базы
- На каждой целевой странице или базе (карточки клиентов, доска постов):
  **••• (вверху справа) → «Соединения» (Connections) → добавить** интеграцию `smm-system`.
- Доступ строго к расшаренным страницам и их вложенности. Что не расшарил — Claude Code
  не видит.

### Что попадает в `.env`
```
NOTION_TOKEN=<Internal Integration Secret>
```
(ID конкретных баз — `NOTION_CLIENTS_DB_ID` / `NOTION_POSTS_DB_ID` — добавятся на Фазе 2,
когда базы будут созданы.)

---

## Раздать команде

После настройки у тебя на руках:
- файл `gdrive-sa.json` (ключ service-account),
- значения для `.env`: `GOOGLE_APPLICATION_CREDENTIALS`, `GDRIVE_ROOT_FOLDER_ID`,
  `NOTION_TOKEN` (+ позже ID баз Notion).

Передай это операторам по защищённому каналу. Каждый кладёт `gdrive-sa.json` в корень
репозитория и прописывает значения в свой `.env`. После этого его Claude Code работает
с общими Drive-папкой и Notion-пространством.

Шаблон переменных — в `.env.example` (без значений).
