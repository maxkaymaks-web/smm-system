"""
Chatwoot omnichannel gateway: VK + Telegram <-> Chatwoot (API channels).

Входящие: VK Bots Long Poll и Telegram getUpdates -> создаём контакт/диалог/сообщение
(с вложениями) через публичный API Chatwoot (по inbox_identifier).
Исходящие: Chatwoot шлёт webhook (message_created, outgoing) -> доставляем текст и
вложения в VK/TG.

Маршрутизация по identifier контакта: "vk:<user_id>" / "tg:<chat_id>".
Telegram ходит наружу через PROXY_URL (DPI в РФ); VK и сам Chatwoot — напрямую.
"""
import asyncio
import json
import logging
import mimetypes
import os
import random
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

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
TG_FILE = f"https://api.telegram.org/file/bot{TG_TOKEN}"
STATE_PATH = os.environ.get("STATE_PATH", "/data/state.json")
MAX_BYTES = 40 * 1024 * 1024  # лимит вложения Chatwoot по умолчанию

# --- state (persisted) ---
_state = {"contacts": {}, "convos": {}, "src2ident": {}, "names": {}, "tg_offset": 0}
_lock = asyncio.Lock()


def load_state():
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
cw = httpx.AsyncClient(base_url=CHATWOOT_URL, trust_env=False, timeout=60)
vk = httpx.AsyncClient(trust_env=False, timeout=60, follow_redirects=True)
tg = httpx.AsyncClient(proxy=PROXY_URL, trust_env=False, timeout=60, follow_redirects=True)


def guess_ct(name, fallback="application/octet-stream"):
    return mimetypes.guess_type(name)[0] or fallback


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


async def cw_incoming(inbox, identifier, name, content, attachments=None):
    """attachments: список dict {name, ctype, data(bytes)}."""
    if not content and not attachments:
        return
    src = await cw_ensure_contact(inbox, identifier, name)
    conv = await cw_ensure_conversation(inbox, identifier, src)
    url = f"/public/api/v1/inboxes/{inbox}/contacts/{src}/conversations/{conv}/messages"
    if attachments:
        files = [("attachments[]", (a["name"], a["data"], a["ctype"])) for a in attachments]
        r = await cw.post(url, data={"content": content or ""}, files=files)
    else:
        r = await cw.post(url, json={"content": content})
    r.raise_for_status()
    log.info("-> Chatwoot [%s] %s: %s%s", inbox[:6], identifier,
             (content or "")[:50], f" +{len(attachments)} файл(ов)" if attachments else "")


async def download(client, url):
    r = await client.get(url)
    r.raise_for_status()
    data = r.content
    if len(data) > MAX_BYTES:
        raise ValueError(f"файл {len(data)}B превышает лимит")
    return data


# =================== TELEGRAM ===================
def tg_extract_media(m):
    """-> список (filename, ctype, file_id)."""
    out = []
    if "photo" in m:
        out.append(("photo.jpg", "image/jpeg", m["photo"][-1]["file_id"]))
    if "sticker" in m:
        s = m["sticker"]
        if s.get("is_video"):
            out.append(("sticker.webm", "video/webm", s["file_id"]))
        elif s.get("is_animated"):
            out.append(("sticker.tgs", "application/gzip", s["file_id"]))
        else:
            out.append(("sticker.webp", "image/webp", s["file_id"]))
    if "document" in m:
        d = m["document"]
        nm = d.get("file_name", "file")
        out.append((nm, d.get("mime_type") or guess_ct(nm), d["file_id"]))
    if "video" in m:
        out.append(("video.mp4", "video/mp4", m["video"]["file_id"]))
    if "animation" in m:
        out.append(("animation.mp4", "video/mp4", m["animation"]["file_id"]))
    if "voice" in m:
        out.append(("voice.ogg", "audio/ogg", m["voice"]["file_id"]))
    if "audio" in m:
        a = m["audio"]
        nm = a.get("file_name", "audio.mp3")
        out.append((nm, a.get("mime_type") or guess_ct(nm, "audio/mpeg"), a["file_id"]))
    if "video_note" in m:
        out.append(("video_note.mp4", "video/mp4", m["video_note"]["file_id"]))
    return out


async def tg_download(file_id):
    r = await tg.get(f"{TG_API}/getFile", params={"file_id": file_id})
    fp = r.json()["result"]["file_path"]
    return await download(tg, f"{TG_FILE}/{fp}")


async def tg_poll():
    while True:
        try:
            offset = _state.get("tg_offset", 0)
            r = await tg.get(f"{TG_API}/getUpdates", params={"offset": offset, "timeout": 25})
            d = r.json()
            if not d.get("ok"):
                log.error("TG getUpdates: %s", str(d)[:200]); await asyncio.sleep(3); continue
            for upd in d.get("result", []):
                async with _lock:
                    _state["tg_offset"] = upd["update_id"] + 1
                    save_state()
                m = upd.get("message") or upd.get("edited_message")
                if not m:
                    continue
                chat = m["chat"]["id"]
                frm = m.get("from", {})
                name = (f"{frm.get('first_name','')} {frm.get('last_name','')}".strip()
                        or m["chat"].get("title") or f"tg {chat}")
                text = m.get("text") or m.get("caption") or ""
                attachments = []
                for fname, ctype, fid in tg_extract_media(m):
                    try:
                        attachments.append({"name": fname, "ctype": ctype,
                                            "data": await tg_download(fid)})
                    except Exception as e:
                        log.error("tg download %s: %s", fname, e)
                        text = (text + f"\n[не удалось скачать вложение: {fname}]").strip()
                await cw_incoming(TG_INBOX, f"tg:{chat}", name, text, attachments)
        except Exception as e:
            log.error("tg_poll: %s", e); await asyncio.sleep(3)


# =================== VK ===================
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


async def vk_extract_media(atts):
    """-> (attachments[dict], text_links[str])."""
    files, links = [], []
    for a in atts:
        t = a.get("type")
        try:
            if t == "photo":
                url = max(a["photo"]["sizes"], key=lambda s: s.get("width", 0))["url"]
                files.append({"name": "photo.jpg", "ctype": "image/jpeg", "data": await download(vk, url)})
            elif t == "doc":
                d = a["doc"]
                nm = d.get("title", "file")
                if d.get("ext") and not nm.lower().endswith("." + d["ext"]):
                    nm = f"{nm}.{d['ext']}"
                files.append({"name": nm, "ctype": guess_ct(nm), "data": await download(vk, d["url"])})
            elif t == "sticker":
                imgs = a["sticker"].get("images") or a["sticker"].get("images_with_background") or []
                if imgs:
                    url = max(imgs, key=lambda s: s.get("width", 0))["url"]
                    files.append({"name": "sticker.png", "ctype": "image/png", "data": await download(vk, url)})
            elif t == "audio_message":
                am = a["audio_message"]
                url = am.get("link_mp3") or am.get("link_ogg")
                if url:
                    files.append({"name": "voice.mp3", "ctype": "audio/mpeg", "data": await download(vk, url)})
            elif t == "video":
                v = a["video"]
                links.append(f"[видео] https://vk.com/video{v.get('owner_id')}_{v.get('id')}")
            else:
                links.append(f"[вложение: {t}]")
        except Exception as e:
            log.error("vk attach %s: %s", t, e)
            links.append(f"[не удалось скачать: {t}]")
    return files, links


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
                r = await vk.get(server, params={"act": "a_check", "key": key, "ts": ts, "wait": 25})
                d = r.json()
                if "failed" in d:
                    if d["failed"] == 1:
                        ts = d["ts"]; continue
                    break
                ts = d["ts"]
                for u in d.get("updates", []):
                    if u.get("type") != "message_new":
                        continue
                    msg = u["object"]["message"]
                    frm = msg.get("from_id")
                    if frm is None or frm < 0:
                        continue
                    text = msg.get("text", "")
                    files, links = await vk_extract_media(msg.get("attachments", []))
                    if links:
                        text = (text + "\n" + "\n".join(links)).strip()
                    name = await vk_name(frm)
                    await cw_incoming(VK_INBOX, f"vk:{frm}", name, text, files)
        except Exception as e:
            log.error("vk_poll: %s", e); await asyncio.sleep(3)


# --- senders ---
async def vk_send(peer_id, text, attachment=None):
    params = {"peer_id": peer_id, "message": text or "",
              "random_id": random.randint(1, 2_000_000_000),
              "access_token": VK_TOKEN, "v": VK_API_V}
    if attachment:
        params["attachment"] = attachment
    r = await vk.get("https://api.vk.com/method/messages.send", params=params)
    j = r.json()
    if "error" in j:
        log.error("VK send error: %s", j["error"])


async def vk_upload_photo(peer_id, data, name):
    r = await vk.get("https://api.vk.com/method/photos.getMessagesUploadServer",
                     params={"peer_id": peer_id, "access_token": VK_TOKEN, "v": VK_API_V})
    up_url = r.json()["response"]["upload_url"]
    up = await vk.post(up_url, files={"photo": (name, data, "image/jpeg")})
    uj = up.json()
    sv = await vk.get("https://api.vk.com/method/photos.saveMessagesPhoto", params={
        "photo": uj["photo"], "server": uj["server"], "hash": uj["hash"],
        "access_token": VK_TOKEN, "v": VK_API_V})
    p = sv.json()["response"][0]
    return f"photo{p['owner_id']}_{p['id']}"


async def vk_upload_doc(peer_id, data, name):
    r = await vk.get("https://api.vk.com/method/docs.getMessagesUploadServer",
                     params={"type": "doc", "peer_id": peer_id,
                             "access_token": VK_TOKEN, "v": VK_API_V})
    up_url = r.json()["response"]["upload_url"]
    up = await vk.post(up_url, files={"file": (name, data, guess_ct(name))})
    sv = await vk.get("https://api.vk.com/method/docs.save", params={
        "file": up.json()["file"], "title": name,
        "access_token": VK_TOKEN, "v": VK_API_V})
    resp = sv.json()["response"]
    doc = resp["doc"] if isinstance(resp, dict) and "doc" in resp else resp
    return f"doc{doc['owner_id']}_{doc['id']}"


async def tg_send(chat_id, text):
    if not text:
        return
    r = await tg.post(f"{TG_API}/sendMessage", json={"chat_id": chat_id, "text": text})
    if r.status_code != 200:
        log.error("TG send %s: %s", r.status_code, r.text[:200])


# --- outgoing delivery ---
def cw_path(url):
    p = urlsplit(url)
    return p.path + (("?" + p.query) if p.query else "")


async def fetch_cw_file(data_url):
    r = await cw.get(cw_path(data_url), follow_redirects=True)
    r.raise_for_status()
    return r.content


async def deliver_vk(user_id, content, atts):
    att_strs = []
    for a in atts:
        try:
            data = await fetch_cw_file(a["data_url"])
            if a["file_type"] == "image":
                att_strs.append(await vk_upload_photo(user_id, data, a["name"]))
            else:
                att_strs.append(await vk_upload_doc(user_id, data, a["name"]))
        except Exception as e:
            log.error("vk upload %s: %s", a["name"], e)
    await vk_send(user_id, content, ",".join(att_strs) if att_strs else None)


async def deliver_tg(chat_id, content, atts):
    if not atts:
        await tg_send(chat_id, content); return
    first = True
    for a in atts:
        try:
            data = await fetch_cw_file(a["data_url"])
            payload = {"chat_id": str(chat_id)}
            if first and content:
                payload["caption"] = content
            if a["file_type"] == "image":
                await tg.post(f"{TG_API}/sendPhoto", data=payload, files={"photo": (a["name"], data)})
            else:
                await tg.post(f"{TG_API}/sendDocument", data=payload, files={"document": (a["name"], data)})
            first = False
        except Exception as e:
            log.error("tg send file %s: %s", a["name"], e)


# --- webhook ---
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
    content = data.get("content") or ""
    conv = data.get("conversation", {})
    ident = (((conv.get("meta") or {}).get("sender") or {}).get("identifier"))
    if not ident:
        ident = _state["src2ident"].get((conv.get("contact_inbox") or {}).get("source_id"))
    atts = []
    for a in (data.get("attachments") or []):
        url = a.get("data_url") or a.get("file_url")
        if url:
            atts.append({"name": cw_path(url).split("/")[-1] or "file",
                         "file_type": a.get("file_type"), "data_url": url})
    if not ident or (not content and not atts):
        return {"ok": True}
    try:
        if ident.startswith("vk:"):
            await deliver_vk(int(ident[3:]), content, atts)
        elif ident.startswith("tg:"):
            await deliver_tg(int(ident[3:]), content, atts)
        log.info("<- Chatwoot outgoing -> %s: %s +%d файл(ов)", ident, content[:40], len(atts))
    except Exception as e:
        log.error("deliver fail %s: %s", ident, e)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
