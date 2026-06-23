# Как ходить в Notion (для Claude Code / оператора)

> TL;DR: **ходи через прямой API — обёртку `tools/lib/notion.mjs`, не через MCP.**
> Обёртка сама читает `.env` и снимает прокси, поэтому работает с любого
> устройства. MCP-сервер ломается, если перед запуском `claude` не
> экспортировали `NOTION_TOKEN` в окружение, и молча отдаёт **401**.

---

## Почему API, а не MCP

| | Прямой API (`tools/lib/notion.mjs`) | MCP-сервер (`.mcp.json`) |
|---|---|---|
| Откуда берёт токен | сам читает `.env` через `loadEnv()` | из env-переменной `${NOTION_TOKEN}` на момент старта `claude` |
| Прокси | сам удаляет `*_PROXY` (tinyproxy режет Notion по IP-allow-листу) | не трогает прокси |
| Надёжность | работает всегда, пока токен в `.env` | 401, если забыли `set -a; source .env` перед `claude` |
| Диагностика | видно `status/code/message` ошибки | «чёрный ящик», лечится только перезапуском сессии |

**Вывод:** рабочий путь — обёртка. MCP — опционально, для ручных проверок,
когда окружение настроено (см. «MCP» внизу).

### Симптом «MCP не работает»
`API token is invalid` / HTTP 401 при вызове `mcp__notion__*`, **хотя токен в
`.env` правильный**. Это не про токен и не про файл — MCP-сервер просто стартовал
без переменной окружения. Проверка: `echo $NOTION_TOKEN` (если пусто — вот и
причина). Не трать время на перечитывание `.env` — переключайся на прямой API.

---

## Быстрая проверка, что доступ есть

```bash
node -e 'import("./tools/lib/notion.mjs").then(m =>
  m.notion("GET","/users/me")).then(u =>
  console.log("OK:", u.bot?.workspace_name, "| bot:", u.name))'
# OK: Max Kaimakan's Notion | bot: API PAVEL
```

Если вернулось `OK:` — Notion доступен, можно работать. Если ошибка — токен в
`.env` битый/не расшарен (см. `docs/access-setup.md`).

---

## Обёртка `tools/lib/notion.mjs`

```js
import * as N from "./tools/lib/notion.mjs";

N.notion(method, path, body)   // сырой REST: ("GET","/users/me") / ("POST","/databases/<id>/query", {...})
N.loadNotionConfig()           // { parent_page, databases:{clients,plans,posts} } из config/notion.json
N.findClientByProjectId(dbId, projectId)   // карточка клиента по Local project ID
N.createClient / updateClient / createPlan // типовые операции
N.pageUrl(page)                // ссылка на страницу
```

`notion()` сам зовёт `loadEnv()` — отдельно дёргать не нужно. На ошибку Notion
кидает `Error` с текстом `Notion <status> <code>: <message>`.

ID баз — **не секрет**, лежат открыто в `config/notion.json`:
`clients` / `plans` / `posts`. Секрет только `NOTION_TOKEN` в `.env`.
API-версия зашита в обёртке: `2022-06-28`.

---

## Рецепты

### Список клиентов
```bash
node -e 'import("./tools/lib/notion.mjs").then(async m => {
  const cfg = m.loadNotionConfig();
  const r = await m.notion("POST", `/databases/${cfg.databases.clients}/query`, {page_size:100});
  for (const p of r.results) console.log(
    p.properties["Name"]?.title?.[0]?.plain_text,
    "| pid:", p.properties["Local project ID"]?.rich_text?.[0]?.plain_text);
})'
```

### Посты одного проекта (фильтр + сортировка)
```js
const cfg = m.loadNotionConfig();
const r = await m.notion("POST", `/databases/${cfg.databases.posts}/query`, {
  filter: { property: "Проект", rich_text: { contains: "travnik_ural" } },
  sorts:  [{ property: "Дата", direction: "ascending" }],
  page_size: 100,
});
// пагинация: пока r.has_more — повторить с { start_cursor: r.next_cursor }
```

### Сменить статус поста
```js
await m.notion("PATCH", `/pages/${pageId}`, {
  properties: { "Статус": { select: { name: "готово" } } },
});
```
Статусы — см. таблицу в `CLAUDE.md` (`черновик` → … → `опубликовано`).

### Пагинация (важно — Notion отдаёт максимум 100 за раз)
```js
let cursor, all = [];
do {
  const r = await m.notion("POST", `/databases/${dbId}/query`,
    { page_size: 100, ...(cursor ? { start_cursor: cursor } : {}) });
  all.push(...r.results);
  cursor = r.has_more ? r.next_cursor : null;
} while (cursor);
```

---

## MCP (если всё же нужен)

Чинится один раз — экспортировать токен в окружение **перед** запуском:
```bash
set -a; source .env; set +a
claude        # при первом старте подтвердить project-scoped MCP-сервер notion
```
Статус внутри сессии — команда `/mcp`. Подробно — `docs/access-setup.md`.
Для рабочих задач это не требуется: используй прямой API.

---

См. также: `docs/access-setup.md` (выпуск токена, расшаривание баз),
`config/notion.json` (ID баз), `CLAUDE.md` (статусы постов, где что лежит).
