"""
Chatwoot omnichannel gateway: VK + Telegram <-> Chatwoot (API channels).

Входящие: VK Bots Long Poll и Telegram getUpdates -> создаём контакт/диалог/сообщение
через публичный API Chatwoot (по inbox_identifier).
Исходящие: Chatwoot шлёт webhook (message_created, outgoing) -> доставляем в VK/TG.

Маршрутизация по identifier контакта: "vk:<user_id>" / "tg:<chat_id>".
Telegram ходит наружу через PROXY_URL (DPI в РФ); VK и сам Chatwoot — напрямую.
"""
import asyncio
import json
import logging
import os
import random
import time
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("gateway")

# --- config ---
CHATWOOT_URL = os.environ["CHATWOOT_URL"].rstrip("/")
VK_INBOX = os.environ["CHATWOOT_VK_INBOX_IDENTIFIER"]
TG_INBOX = os.environ["CHATWOOT_TG_INBOX_IDENTIFIER"]
VK_TOKEN = os.environ["VK_COMMUNITY_TOKEN"]
VK_GROUP_ID = os.environ["VK_GROUP_ID"]
TG_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
PROXY_URL = os.environ.get("PROXY_URL") or None
VK_API_V = "5.199"
TG_API = f"https://api.telegram.org/bot{TG_TOKEN}"
STATE_PATH = os.environ.get("STATE_PATH", "/data/state.json")

# --- state (persisted) ---
_state = {"contacts": {}, "convos": {}, "src2ident": {}, "names": {}, "tg_offset": 0}
_lock = asyncio.Lock()


def load_state():
    global _state
    try:
        with open(STATE_PATH) as f:
            _state.update(json.load(f))
        log.info("state загружен: %d контактов", len(_state["contacts"]))
    except FileNotFoundError:
        log.info("state не найден, старт с нуля")


def save_state():
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(_state, f)
    os.replace(tmp, STATE_PATH)


# httpx-клиенты: cw/vk без прокси (trust_env=False), tg через прокси
cw = httpx.AsyncClient(base_url=CHATWOOT_URL, trust_env=False, timeout=20)
vk = httpx.AsyncClient(trust_env=False, timeout=40)
tg = httpx.AsyncClient(proxy=PROXY_URL, trust_env=False, timeout=40)


# --- Chatwoot incoming helpers (public API) ---
async def cw_ensure_contact(inbox, identifier, name):
    if identifier in _state["contacts"]:
        return _state["contacts"][identifier]
    r = await cw.post(f"/public/api/v1/inboxes/{inbox}/contacts",
                      json={"identifier": identifier, "name": name})
    r.raise_for_status()
    src = r.json()["source_id"]
    async with _lock:
        _state["contacts"][identifier] = src
        _state["src2ident"][src] = identifier
        save_state()
    return src


async def cw_ensure_conversation(inbox, identifier, source_id):
    if identifier in _state["convos"]:
        return _state["convos"][identifier]
    r = await cw.post(
        f"/public/api/v1/inboxes/{inbox}/contacts/{source_id}/conversations", json={})
    r.raise_for_status()
    conv = r.json()["id"]
    async with _lock:
        _state["convos"][identifier] = conv
        save_state()
    return conv


async def cw_incoming(inbox, identifier, name, content):
    src = await cw_ensure_contact(inbox, identifier, name)
    conv = await cw_ensure_conversation(inbox, identifier, src)
    r = await cw.post(
        f"/public/api/v1/inboxes/{inbox}/contacts/{src}/conversations/{conv}/messages",
        json={"content": content})
    r.raise_for_status()
    log.info("-> Chatwoot [%s] %s: %s", inbox[:6], identifier, content[:60])


# --- senders ---
async def vk_send(peer_id, text):
    r = await vk.get("https://api.vk.com/method/messages.send", params={
        "peer_id": peer_id, "message": text,
        "random_id": random.randint(1, 2_000_000_000),
        "access_token": VK_TOKEN, "v": VK_API_V})
    j = r.json()
    if "error" in j:
        log.error("VK send error: %s", j["error"])


async def tg_send(chat_id, text):
    r = await tg.post(f"{TG_API}/sendMessage", json={"chat_id": chat_id, "text": text})
    if r.status_code != 200:
        log.error("TG send %s: %s", r.status_code, r.text[:200])


# --- VK name lookup ---
async def vk_name(user_id):
    if str(user_id) in _state["names"]:
        return _state["names"][str(user_id)]
    name = f"VK {user_id}"
    try:
        r = await vk.get("https://api.vk.com/method/users.get", params={
            "user_ids": user_id, "access_token": VK_TOKEN, "v": VK_API_V})
        u = r.json().get("response", [])
        if u:
            name = f"{u[0].get('first_name','')} {u[0].get('last_name','')}".strip() or name
    except Exception as e:
        log.warning("vk_name fail: %s", e)
    _state["names"][str(user_id)] = name
    return name


# --- pollers ---
async def vk_get_server():
    r = await vk.get("https://api.vk.com/method/groups.getLongPollServer", params={
        "group_id": VK_GROUP_ID, "access_token": VK_TOKEN, "v": VK_API_V})
    j = r.json()
    if "error" in j:
        raise RuntimeError(f"VK getLongPollServer: {j['error']}")
    resp = j["response"]
    return resp["server"], resp["key"], resp["ts"]


async def vk_poll():
    while True:
        try:
            server, key, ts = await vk_get_server()
            log.info("VK long poll подключён")
            while True:
                r = await vk.get(server, params={"act": "a_check", "key": key,
                                                 "ts": ts, "wait": 25})
                d = r.json()
                if "failed" in d:
                    if d["failed"] == 1:
                        ts = d["ts"]
                        continue
                    break  # 2/3 -> переполучить сервер
                ts = d["ts"]
                for u in d.get("updates", []):
                    if u.get("type") != "message_new":
                        continue
                    msg = u["object"]["message"]
                    frm = msg.get("from_id")
                    if frm is None or frm < 0:
                        continue
                    text = msg.get("text", "")
                    name = await vk_name(frm)
                    await cw_incoming(VK_INBOX, f"vk:{frm}", name, text)
        except Exception as e:
            log.error("vk_poll: %s", e)
            await asyncio.sleep(3)


async def tg_poll():
    while True:
        try:
            offset = _state.get("tg_offset", 0)
            r = await tg.get(f"{TG_API}/getUpdates",
                             params={"offset": offset, "timeout": 25})
            d = r.json()
            if not d.get("ok"):
                log.error("TG getUpdates: %s", str(d)[:200])
                await asyncio.sleep(3)
                continue
            for upd in d.get("result", []):
                async with _lock:
                    _state["tg_offset"] = upd["update_id"] + 1
                    save_state()
                m = upd.get("message") or upd.get("edited_message")
                if not m or "text" not in m:
                    continue
                chat = m["chat"]["id"]
                frm = m.get("from", {})
                name = (f"{frm.get('first_name','')} {frm.get('last_name','')}".strip()
                        or m["chat"].get("title") or f"tg {chat}")
                await cw_incoming(TG_INBOX, f"tg:{chat}", name, m["text"])
        except Exception as e:
            log.error("tg_poll: %s", e)
            await asyncio.sleep(3)


# --- outgoing webhook from Chatwoot ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_state()
    t1 = asyncio.create_task(vk_poll())
    t2 = asyncio.create_task(tg_poll())
    log.info("gateway запущен")
    yield
    t1.cancel(); t2.cancel()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"ok": True, "contacts": len(_state["contacts"])}


@app.post("/chatwoot/webhook")
async def webhook(req: Request):
    data = await req.json()
    if data.get("event") != "message_created":
        return {"ok": True}
    if data.get("message_type") != "outgoing" or data.get("private"):
        return {"ok": True}
    content = data.get("content")
    conv = data.get("conversation", {})
    ident = (((conv.get("meta") or {}).get("sender") or {}).get("identifier"))
    if not ident:
        src = ((conv.get("contact_inbox") or {}).get("source_id"))
        ident = _state["src2ident"].get(src)
    if not ident or not content:
        return {"ok": True}
    try:
        if ident.startswith("vk:"):
            await vk_send(int(ident[3:]), content)
        elif ident.startswith("tg:"):
            await tg_send(int(ident[3:]), content)
        log.info("<- Chatwoot outgoing -> %s: %s", ident, content[:60])
    except Exception as e:
        log.error("deliver fail %s: %s", ident, e)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
