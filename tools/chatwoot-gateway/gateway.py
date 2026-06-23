"""
Chatwoot omnichannel gateway: VK + Telegram <-> Chatwoot (API channels).

Входящие: VK Bots Long Poll и Telegram getUpdates -> создаём контакт/диалог/сообщение
(с вложениями) через публичный API Chatwoot (по inbox_identifier).
Исходящие: Chatwoot шлёт webhook (message_created, outgoing) -> доставляем текст и
вложения в VK/TG.

Маршрутизация по identifier контакта: "vk:<user_id>" / "tg:<chat_id>".
Telegram ходит наружу через PROXY_URL (DPI в РФ); VK и сам Chatwoot — напрямую.

ГАРАНТИИ ДОСТАВКИ (почему этот файл такой большой):
  * Исходящие — атомарно: сначала скачиваем ВСЕ вложения из Chatwoot, и только если
    скачались все, отправляем клиенту. Не скачалось всё -> клиенту НИЧЕГО не уходит,
    а в диалог Chatwoot падает приватная заметка об ошибке. Никаких «3 из 6» молча.
  * Отправка атомарна на стороне мессенджера: TG — sendMediaGroup (альбом одним
    вызовом), VK — один messages.send со всеми вложениями.
  * Ретраи: 5 попыток, бэкофф 30/90/180/300с (~10 мин) на исходящих.
  * Доставка вынесена в фоновый воркер: webhook сразу отвечает ok (иначе Chatwoot
    отвалится по таймауту и пришлёт дубль). Дедуп по message_id. Очередь и in-flight
    Telegram-альбомы персистятся в state.json -> переживают рестарт без потерь.
  * Входящие — offset/ts двигаются ТОЛЬКО после успешной доставки в Chatwoot;
    что не доставилось после коротких ретраев -> в dead-letter (видно, переигрываемо),
    а не молча в /dev/null.
"""
import asyncio
import json
import logging
import mimetypes
import os
import random
import time
from contextlib import asynccontextmanager
from urllib.parse import urlsplit

import httpx
from fastapi import FastAPI, Request

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
# httpx на INFO пишет полные URL запросов с query-параметрами -> в лог утекает
# VK access_token. Глушим до WARNING (свои осмысленные логи пишем сами).
logging.getLogger("httpx").setLevel(logging.WARNING)
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
DEADLETTER_PATH = os.environ.get("DEADLETTER_PATH", "/data/deadletter.jsonl")
MAX_BYTES = 40 * 1024 * 1024  # лимит вложения Chatwoot по умолчанию
TG_PHOTO_LIMIT = 10 * 1024 * 1024  # Telegram не примет фото крупнее -> шлём документом
ACCOUNT_ID = os.environ.get("CHATWOOT_ACCOUNT_ID", "1")
API_TOKEN = os.environ.get("CHATWOOT_API_TOKEN", "")  # агентский токен (аватар, заметки, свежие URL вложений)

# Ретраи: исходящие — длинное окно (флапающий прокси), входящие — короткое (локальный Chatwoot)
OUT_ATTEMPTS = 5
OUT_DELAYS = [30, 90, 180, 300]   # сек между попытками; сумма ~10 мин
IN_ATTEMPTS = 4
IN_DELAYS = [5, 15, 45]
ALBUM_DEBOUNCE = 3.0              # сек на сбор Telegram-альбома (приходит N апдейтов подряд)
SEEN_MAX = 3000                  # сколько message_id помним для дедупа

# --- state (persisted) ---
_state = {"contacts": {}, "convos": {}, "src2ident": {}, "names": {}, "tg_offset": 0,
          "outbox": [], "seen_out": [], "tg_groups": {}}
_lock = asyncio.Lock()
_outbox_q = asyncio.Queue()
_group_seen = {}  # mgid -> monotonic время последнего апдейта (в памяти; на рестарте пусто = flush сразу)


def load_state():
    try:
        with open(STATE_PATH) as f:
            _state.update(json.load(f))
    except FileNotFoundError:
        log.info("state не найден, старт с нуля")
    # бэкофилл новых ключей для старого state.json
    for k, v in {"outbox": [], "seen_out": [], "tg_groups": {}}.items():
        _state.setdefault(k, v)
    log.info("state загружен: %d контактов, %d в очереди доставки, %d недо-альбомов",
             len(_state["contacts"]), len(_state["outbox"]), len(_state["tg_groups"]))


def save_state():
    tmp = STATE_PATH + ".tmp"
    with open(tmp, "w") as f:
        json.dump(_state, f, ensure_ascii=False)
    os.replace(tmp, STATE_PATH)


def deadletter(kind, payload, err):
    """Не доставленное никогда не теряем молча — пишем в dead-letter (без байтов)."""
    rec = {"kind": kind, "err": repr(err), "payload": payload}
    try:
        with open(DEADLETTER_PATH, "a") as f:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    except Exception as e:
        log.error("не смог записать dead-letter (%s): %r", kind, e)
    log.error("DEAD-LETTER [%s]: %r", kind, err)


# httpx-клиенты: cw/vk без прокси (trust_env=False), tg через прокси
cw = httpx.AsyncClient(base_url=CHATWOOT_URL, trust_env=False, timeout=60)
vk = httpx.AsyncClient(trust_env=False, timeout=60, follow_redirects=True)
tg = httpx.AsyncClient(proxy=PROXY_URL, trust_env=False, timeout=60, follow_redirects=True)


def guess_ct(name, fallback="application/octet-stream"):
    return mimetypes.guess_type(name)[0] or fallback


def chunked(seq, n):
    return [seq[i:i + n] for i in range(0, len(seq), n)]


def is_permanent(e):
    """Постоянные ошибки (4xx кроме 404/429) ретраить бессмысленно."""
    if isinstance(e, httpx.HTTPStatusError):
        return e.response.status_code in (400, 401, 403, 413, 422)
    return False


async def with_retries(factory, what, attempts, delays):
    """factory — callable, возвращающий свежую корутину на каждую попытку."""
    for i in range(attempts):
        try:
            return await factory()
        except Exception as e:
            if is_permanent(e):
                log.error("%s — постоянная ошибка, ретрай бессмысленен: %r", what, e)
                raise
            if i == attempts - 1:
                log.error("%s — исчерпаны все %d попыток: %r", what, attempts, e)
                raise
            d = delays[min(i, len(delays) - 1)] * random.uniform(0.85, 1.15)
            log.warning("%s — попытка %d/%d не удалась (%r); повтор через %.0fс",
                        what, i + 1, attempts, e, d)
            await asyncio.sleep(d)


# --- Chatwoot incoming helpers (public API) ---
async def cw_ensure_contact(inbox, identifier, name, avatar_bytes=None):
    if identifier in _state["contacts"]:
        return _state["contacts"][identifier]
    r = await cw.post(f"/public/api/v1/inboxes/{inbox}/contacts",
                      json={"identifier": identifier, "name": name})
    r.raise_for_status()
    data = r.json()
    src = data["source_id"]
    cid = data.get("id")
    async with _lock:
        _state["contacts"][identifier] = src
        _state["src2ident"][src] = identifier
        save_state()
    # аватар грузим только при создании контакта, агентским API (multipart)
    if avatar_bytes and cid and API_TOKEN:
        try:
            await cw.put(f"/api/v1/accounts/{ACCOUNT_ID}/contacts/{cid}",
                         headers={"api_access_token": API_TOKEN},
                         files={"avatar": ("avatar.jpg", avatar_bytes, "image/jpeg")})
            log.info("avatar -> %s", identifier)
        except Exception as e:
            log.warning("avatar upload fail %s: %r", identifier, e)
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


async def cw_incoming(inbox, identifier, name, content, attachments=None, avatar_bytes=None):
    """attachments: список dict {name, ctype, data(bytes)}."""
    if not content and not attachments:
        return
    src = await cw_ensure_contact(inbox, identifier, name, avatar_bytes)
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


async def cw_post_note(conv, text):
    """Приватная заметка в диалог — так оператор видит сбой доставки там, где работает."""
    if not API_TOKEN or not conv:
        log.error("не могу записать заметку (нет API_TOKEN/conv): %s", text)
        return
    try:
        await cw.post(f"/api/v1/accounts/{ACCOUNT_ID}/conversations/{conv}/messages",
                      headers={"api_access_token": API_TOKEN},
                      json={"content": text, "message_type": "outgoing", "private": True})
    except Exception as e:
        log.error("не смог записать заметку об ошибке в диалог %s: %r", conv, e)


async def cw_set_status(conv, mid, status, external_error=None):
    """Отразить РЕАЛЬНЫЙ статус доставки в Chatwoot (только для API-инбоксов — наши TG/VK).
    Схема: sent (1 галка) = принято в очередь; delivered (2 галки) = реально дошло до
    клиента; failed (!) = не дошло, с текстом ошибки и кнопкой resend. 'read' (2 синие)
    не ставим — Telegram-бот не отдаёт read-receipt. Статусы Chatwoot: sent/delivered/read/failed."""
    if not API_TOKEN or not conv or mid is None:
        return
    try:
        body = {"status": status}
        if external_error:
            body["external_error"] = external_error[:990]
        r = await cw.patch(f"/api/v1/accounts/{ACCOUNT_ID}/conversations/{conv}/messages/{mid}",
                           headers={"api_access_token": API_TOKEN}, json=body)
        r.raise_for_status()
    except Exception as e:
        log.warning("не смог обновить статус msg=%s -> %s: %r", mid, status, e)


async def download(client, url):
    r = await client.get(url)
    r.raise_for_status()
    data = r.content
    if len(data) > MAX_BYTES:
        raise ValueError(f"файл {len(data)}B превышает лимит")
    return data


# =================== TELEGRAM (входящие) ===================
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
    r.raise_for_status()
    fp = r.json()["result"]["file_path"]
    return await download(tg, f"{TG_FILE}/{fp}")


async def tg_avatar(user_id):
    """Аватар профиля TG (bytes) — зовём только для новых контактов."""
    try:
        r = await tg.get(f"{TG_API}/getUserProfilePhotos",
                         params={"user_id": user_id, "limit": 1})
        photos = (r.json().get("result") or {}).get("photos") or []
        if not photos:
            return None
        return await tg_download(photos[0][-1]["file_id"])  # самый крупный размер
    except Exception as e:
        log.warning("tg_avatar fail: %r", e)
        return None


def tg_build_part(m):
    """Из апдейта -> метаданные сообщения. Медиа НЕ скачиваем (только file_id),
    чтобы часть была JSON-сериализуемой и переживала рестарт (для альбомов)."""
    chat = m["chat"]["id"]
    frm = m.get("from", {})
    name = (f"{frm.get('first_name','')} {frm.get('last_name','')}".strip()
            or m["chat"].get("title") or f"tg {chat}")
    text = m.get("text") or m.get("caption") or ""
    media = [list(t) for t in tg_extract_media(m)]  # [[fname, ctype, fid], ...]
    return {"ident": f"tg:{chat}", "name": name, "text": text,
            "media": media, "frm_id": frm.get("id")}


async def deliver_inbound_tg(part):
    """Скачать медиа part (с ретраями) и доставить в Chatwoot. Бросает при неудаче cw_incoming."""
    atts, lost = [], 0
    for fname, ctype, fid in part.get("media", []):
        try:
            data = await with_retries(lambda fid=fid: tg_download(fid),
                                      f"tg download {fname}", IN_ATTEMPTS, IN_DELAYS)
            atts.append({"name": fname, "ctype": ctype, "data": data})
        except Exception as e:
            lost += 1
            log.error("tg download окончательно не удалось %s: %r", fname, e)
    text = part.get("text") or ""
    if lost:
        text = (text + f"\n[⚠️ не получено вложений от клиента: {lost} — попросите прислать заново]").strip()
    ident = part["ident"]
    avatar = None
    if ident not in _state["contacts"] and part.get("frm_id"):
        avatar = await tg_avatar(part["frm_id"])
    await with_retries(
        lambda: cw_incoming(TG_INBOX, ident, part["name"], text, atts, avatar_bytes=avatar),
        f"cw_incoming {ident}", IN_ATTEMPTS, IN_DELAYS)


async def tg_poll():
    while True:
        try:
            offset = _state.get("tg_offset", 0)
            r = await tg.get(f"{TG_API}/getUpdates", params={"offset": offset, "timeout": 25})
            d = r.json()
            if not d.get("ok"):
                log.error("TG getUpdates: %s", str(d)[:200]); await asyncio.sleep(3); continue
            now = time.monotonic()
            for upd in d.get("result", []):
                m = upd.get("message") or upd.get("edited_message")
                if m:
                    try:
                        part = tg_build_part(m)
                        mgid = m.get("media_group_id")
                        if mgid:
                            # альбом: копим части по media_group_id, доставим после debounce
                            async with _lock:
                                g = _state["tg_groups"].get(mgid)
                                if not g:
                                    g = _state["tg_groups"][mgid] = {
                                        "ident": part["ident"], "name": part["name"],
                                        "text": "", "media": [], "frm_id": part["frm_id"]}
                                g["media"].extend(part["media"])
                                if part["text"]:
                                    g["text"] = (g["text"] + " " + part["text"]).strip() if g["text"] else part["text"]
                                save_state()
                            _group_seen[mgid] = now
                        else:
                            await deliver_inbound_tg(part)
                    except Exception as e:
                        deadletter("tg-incoming", {"update": upd}, e)
                # offset двигаем только после того, как апдейт ОБРАБОТАН
                # (доставлен, забуферен в персистентный альбом, или ушёл в dead-letter)
                async with _lock:
                    _state["tg_offset"] = upd["update_id"] + 1
                    save_state()
            await tg_flush_groups(force=False)
        except Exception as e:
            log.error("tg_poll цикл: %r", e); await asyncio.sleep(3)


async def tg_flush_groups(force):
    """Доставить альбомы, которые «дозрели» (нет новых частей ALBUM_DEBOUNCE сек)."""
    now = time.monotonic()
    ready = []
    for mgid in list(_state["tg_groups"].keys()):
        seen = _group_seen.get(mgid)
        if force or seen is None or (now - seen) >= ALBUM_DEBOUNCE:
            ready.append(mgid)
    for mgid in ready:
        async with _lock:
            g = _state["tg_groups"].pop(mgid, None)
            save_state()
        _group_seen.pop(mgid, None)
        if not g:
            continue
        try:
            await deliver_inbound_tg(g)
        except Exception as e:
            deadletter("tg-incoming-album", {k: v for k, v in g.items() if k != "media"} | {"media": g.get("media")}, e)


# =================== VK (входящие) ===================
async def vk_profile(user_id):
    """(name, avatar_bytes) — зовём только для новых контактов."""
    name = f"VK {user_id}"
    avatar = None
    try:
        r = await vk.get("https://api.vk.com/method/users.get", params={
            "user_ids": user_id, "fields": "photo_200",
            "access_token": VK_TOKEN, "v": VK_API_V})
        u = r.json().get("response", [])
        if u:
            name = f"{u[0].get('first_name','')} {u[0].get('last_name','')}".strip() or name
            url = u[0].get("photo_200")
            if url and "/camera_" not in url:   # пропускаем дефолтную «камеру»
                try:
                    avatar = await download(vk, url)
                except Exception as e:
                    log.warning("vk avatar dl: %r", e)
    except Exception as e:
        log.warning("vk_profile fail: %r", e)
    return name, avatar


async def vk_extract_media(atts):
    """-> (attachments[dict], text_links[str]). Скачивание с ретраями; неудача видна маркером."""
    files, links = [], []
    for a in atts:
        t = a.get("type")
        try:
            if t == "photo":
                url = max(a["photo"]["sizes"], key=lambda s: s.get("width", 0))["url"]
                files.append({"name": "photo.jpg", "ctype": "image/jpeg",
                              "data": await with_retries(lambda url=url: download(vk, url), "vk dl photo", IN_ATTEMPTS, IN_DELAYS)})
            elif t == "doc":
                d = a["doc"]
                nm = d.get("title", "file")
                if d.get("ext") and not nm.lower().endswith("." + d["ext"]):
                    nm = f"{nm}.{d['ext']}"
                files.append({"name": nm, "ctype": guess_ct(nm),
                              "data": await with_retries(lambda u=d["url"]: download(vk, u), "vk dl doc", IN_ATTEMPTS, IN_DELAYS)})
            elif t == "sticker":
                imgs = a["sticker"].get("images") or a["sticker"].get("images_with_background") or []
                if imgs:
                    url = max(imgs, key=lambda s: s.get("width", 0))["url"]
                    files.append({"name": "sticker.png", "ctype": "image/png",
                                  "data": await with_retries(lambda url=url: download(vk, url), "vk dl sticker", IN_ATTEMPTS, IN_DELAYS)})
            elif t == "audio_message":
                am = a["audio_message"]
                url = am.get("link_mp3") or am.get("link_ogg")
                if url:
                    files.append({"name": "voice.mp3", "ctype": "audio/mpeg",
                                  "data": await with_retries(lambda url=url: download(vk, url), "vk dl voice", IN_ATTEMPTS, IN_DELAYS)})
            elif t == "video":
                v = a["video"]
                links.append(f"[видео] https://vk.com/video{v.get('owner_id')}_{v.get('id')}")
            else:
                links.append(f"[вложение: {t}]")
        except Exception as e:
            log.error("vk attach %s окончательно не удалось: %r", t, e)
            links.append(f"[⚠️ не удалось получить вложение: {t} — попросите прислать заново]")
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
    backoff = 3
    while True:
        try:
            server, key, ts = await vk_get_server()
            backoff = 3
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
                    try:
                        msg = u["object"]["message"]
                        frm = msg.get("from_id")
                        if frm is None or frm < 0:
                            continue
                        text = msg.get("text", "")
                        files, links = await vk_extract_media(msg.get("attachments", []))
                        if links:
                            text = (text + "\n" + "\n".join(links)).strip()
                        ident = f"vk:{frm}"
                        if ident in _state["contacts"]:
                            name, avatar = "", None
                        else:
                            name, avatar = await vk_profile(frm)
                        await with_retries(
                            lambda: cw_incoming(VK_INBOX, ident, name, text, files, avatar_bytes=avatar),
                            f"cw_incoming {ident}", IN_ATTEMPTS, IN_DELAYS)
                    except Exception as e:
                        deadletter("vk-incoming", {"update": u}, e)
        except Exception as e:
            log.error("vk_poll цикл: %r; пауза %dс", e, backoff)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, 30)


# =================== senders (исходящие) ===================
async def vk_send_raw(peer_id, text, attachment=None):
    params = {"peer_id": peer_id, "message": text or "",
              "random_id": random.randint(1, 2_000_000_000),
              "access_token": VK_TOKEN, "v": VK_API_V}
    if attachment:
        params["attachment"] = attachment
    r = await vk.get("https://api.vk.com/method/messages.send", params=params)
    j = r.json()
    if "error" in j:
        raise RuntimeError(f"VK messages.send: {j['error']}")
    return j


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


async def tg_send_text(chat_id, text):
    if not text:
        return

    async def f():
        r = await tg.post(f"{TG_API}/sendMessage", json={"chat_id": str(chat_id), "text": text})
        r.raise_for_status()
        return r
    await with_retries(f, f"tg sendMessage {chat_id}", OUT_ATTEMPTS, OUT_DELAYS)


async def tg_send_photo(chat_id, img, caption):
    async def f():
        data = {"chat_id": str(chat_id)}
        if caption:
            data["caption"] = caption
        r = await tg.post(f"{TG_API}/sendPhoto", data=data, files={"photo": (img["name"], img["data"])})
        r.raise_for_status()
        return r
    await with_retries(f, f"tg sendPhoto {chat_id}", OUT_ATTEMPTS, OUT_DELAYS)


async def tg_send_document(chat_id, doc, caption):
    async def f():
        data = {"chat_id": str(chat_id)}
        if caption:
            data["caption"] = caption
        r = await tg.post(f"{TG_API}/sendDocument", data=data, files={"document": (doc["name"], doc["data"])})
        r.raise_for_status()
        return r
    await with_retries(f, f"tg sendDocument {chat_id}", OUT_ATTEMPTS, OUT_DELAYS)


async def tg_send_media_group(chat_id, imgs, caption):
    """Альбом одним запросом — атомарно (Telegram создаёт весь альбом либо отклоняет целиком)."""
    async def f():
        files, media = {}, []
        for i, im in enumerate(imgs):
            key = f"file{i}"
            files[key] = (im["name"], im["data"])
            mm = {"type": "photo", "media": f"attach://{key}"}
            if i == 0 and caption:
                mm["caption"] = caption
            media.append(mm)
        data = {"chat_id": str(chat_id), "media": json.dumps(media)}
        r = await tg.post(f"{TG_API}/sendMediaGroup", data=data, files=files)
        r.raise_for_status()
        return r
    await with_retries(f, f"tg sendMediaGroup {chat_id} x{len(imgs)}", OUT_ATTEMPTS, OUT_DELAYS)


def tg_partition(files):
    """Фото (<=10МБ) шлём как фото/альбом; всё прочее (и крупные фото) — документами."""
    imgs = [f for f in files if f.get("file_type") == "image" and len(f["data"]) <= TG_PHOTO_LIMIT]
    rest = [f for f in files if f not in imgs]
    return imgs, rest


async def tg_deliver_atomic(chat_id, content, files):
    """Все файлы уже скачаны. Фото — альбомом (атомарно), остальное — документами."""
    if not files:
        await tg_send_text(chat_id, content)
        return
    imgs, docs = tg_partition(files)
    caption_used = False
    if len(imgs) >= 2:
        for chunk in chunked(imgs, 10):
            cap = content if (not caption_used and content) else None
            await tg_send_media_group(chat_id, chunk, cap)
            caption_used = True
    elif len(imgs) == 1:
        cap = content if content else None
        await tg_send_photo(chat_id, imgs[0], cap)
        caption_used = bool(content)
    for d in docs:
        cap = content if (not caption_used and content) else None
        await tg_send_document(chat_id, d, cap)
        caption_used = True
    if content and not caption_used:
        await tg_send_text(chat_id, content)


async def vk_deliver_atomic(peer_id, content, files):
    """Грузим все вложения, затем ОДИН messages.send. Любой провал загрузки -> бросаем
    до отправки -> клиент не получает ничего (атомарность по построению)."""
    att_strs = []
    for fobj in files:
        if fobj.get("file_type") == "image":
            att_strs.append(await with_retries(
                lambda fobj=fobj: vk_upload_photo(peer_id, fobj["data"], fobj["name"]),
                f"vk upload photo {fobj['name']}", OUT_ATTEMPTS, OUT_DELAYS))
        else:
            att_strs.append(await with_retries(
                lambda fobj=fobj: vk_upload_doc(peer_id, fobj["data"], fobj["name"]),
                f"vk upload doc {fobj['name']}", OUT_ATTEMPTS, OUT_DELAYS))
    await with_retries(
        lambda: vk_send_raw(peer_id, content, ",".join(att_strs) if att_strs else None),
        f"vk send {peer_id}", OUT_ATTEMPTS, OUT_DELAYS)


# --- доставка из Chatwoot: свежие URL вложений (лечит протухший active_storage) ---
def cw_path(url):
    p = urlsplit(url)
    return p.path + (("?" + p.query) if p.query else "")


async def cw_message_attachments(conv, mid):
    """Свежие метаданные вложений сообщения через агентский API (URL не протухшие)."""
    r = await cw.get(f"/api/v1/accounts/{ACCOUNT_ID}/conversations/{conv}/messages",
                     headers={"api_access_token": API_TOKEN})
    r.raise_for_status()
    payload = r.json().get("payload", [])
    msg = next((m for m in payload if m.get("id") == mid), None)
    out = []
    for a in (msg or {}).get("attachments") or []:
        url = a.get("data_url") or a.get("file_url")
        if not url:
            continue
        out.append({"name": (cw_path(url).split("/")[-1] or "file"),
                    "file_type": a.get("file_type"), "url": url})
    return out


async def cw_fetch(url):
    r = await cw.get(cw_path(url), follow_redirects=True)
    r.raise_for_status()
    data = r.content
    if len(data) > MAX_BYTES:
        raise ValueError(f"файл {len(data)}B превышает лимит")
    return data


# --- dedup / persisted outbox ---
def _seen_has(mid):
    return mid in _state.get("seen_out", []) or any(j.get("mid") == mid for j in _state.get("outbox", []))


async def _mark_done(mid, delivered):
    async with _lock:
        if delivered:
            s = _state.setdefault("seen_out", [])
            if mid not in s:
                s.append(mid)
            if len(s) > SEEN_MAX:
                del s[:len(s) - SEEN_MAX]
        _state["outbox"] = [j for j in _state.get("outbox", []) if j.get("mid") != mid]
        save_state()


async def deliver_job(job):
    ident = job["ident"]; content = job.get("content") or ""; conv = job.get("conv"); mid = job.get("mid")
    files = []
    if job.get("has_atts"):
        # 1) свежий список вложений
        try:
            metas = await with_retries(lambda: cw_message_attachments(conv, mid),
                                       f"cw meta msg={mid}", OUT_ATTEMPTS, OUT_DELAYS)
        except Exception as e:
            await cw_set_status(conv, mid, "failed", f"не получен список вложений из Chatwoot: {e!r}")
            await cw_post_note(conv, f"⚠️ Не удалось получить список вложений из Chatwoot после {OUT_ATTEMPTS} попыток ({e!r}). Клиенту НИЧЕГО не отправлено — повторите.")
            await _mark_done(mid, delivered=False)
            return
        # 2) атомарный гейт: скачиваем ВСЕ; не скачалось одно -> не шлём ничего
        for a in metas:
            try:
                data = await with_retries(lambda a=a: cw_fetch(a["url"]),
                                          f"cw fetch {a['name']}", OUT_ATTEMPTS, OUT_DELAYS)
                files.append({**a, "data": data})
            except Exception as e:
                log.error("АТОМАРНЫЙ ОТКАЗ (скачивание) %s mid=%s: файл «%s» -> клиенту ничего не шлём",
                          ident, mid, a["name"])
                await cw_set_status(conv, mid, "failed", f"не скачалось вложение «{a['name']}»: {e!r}")
                await cw_post_note(conv, f"⚠️ Не удалось получить вложение «{a['name']}» из Chatwoot после {OUT_ATTEMPTS} попыток ({e!r}). Клиенту НИЧЕГО не отправлено — повторите отправку.")
                await _mark_done(mid, delivered=False)
                return
        if not files and not content:
            await _mark_done(mid, delivered=False)
            return
    # 3) отправка (атомарно на стороне мессенджера)
    try:
        if ident.startswith("tg:"):
            await tg_deliver_atomic(int(ident[3:]), content, files)
        elif ident.startswith("vk:"):
            await vk_deliver_atomic(int(ident[3:]), content, files)
        else:
            log.error("неизвестный ident %s", ident)
            await _mark_done(mid, delivered=False)
            return
        await _mark_done(mid, delivered=True)
        await cw_set_status(conv, mid, "delivered")  # две галки = реально дошло до клиента
        log.info("ДОСТАВЛЕНО -> %s: %s +%d файл(ов)", ident, content[:40], len(files))
    except Exception as e:
        log.error("ОТПРАВКА НЕ УДАЛАСЬ -> %s mid=%s: %r", ident, mid, e)
        await cw_set_status(conv, mid, "failed", f"сбой отправки клиенту: {e!r}")
        await cw_post_note(conv, f"⚠️ Сбой отправки клиенту после {OUT_ATTEMPTS} попыток: {e!r}. Проверьте — возможно, доставлено не всё.")
        await _mark_done(mid, delivered=False)


async def outbox_worker():
    while True:
        job = await _outbox_q.get()
        try:
            await deliver_job(job)
        except Exception as e:
            log.error("deliver_job неожиданно упал mid=%s: %r", job.get("mid"), e)
            await _mark_done(job.get("mid"), delivered=False)
        finally:
            _outbox_q.task_done()


# --- webhook ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_state()
    tasks = [asyncio.create_task(vk_poll()),
             asyncio.create_task(tg_poll()),
             asyncio.create_task(outbox_worker())]
    # переигрываем недоставленное из прошлой жизни
    requeued = 0
    for job in list(_state.get("outbox", [])):
        if job.get("mid") and job["mid"] in _state.get("seen_out", []):
            continue
        await _outbox_q.put(job); requeued += 1
    if requeued:
        log.info("переотправляю %d задач из персистентной очереди", requeued)
    log.info("gateway запущен")
    yield
    for t in tasks:
        t.cancel()


app = FastAPI(lifespan=lifespan)


@app.get("/health")
async def health():
    return {"ok": True, "contacts": len(_state["contacts"]),
            "outbox": len(_state.get("outbox", [])),
            "pending_albums": len(_state.get("tg_groups", {}))}


@app.post("/chatwoot/webhook")
async def webhook(req: Request):
    data = await req.json()
    if data.get("event") != "message_created":
        return {"ok": True}
    if data.get("message_type") != "outgoing" or data.get("private"):
        return {"ok": True}
    mid = data.get("id")
    conv = data.get("conversation", {})
    conv_id = conv.get("id")
    ident = (((conv.get("meta") or {}).get("sender") or {}).get("identifier"))
    if not ident:
        ident = _state["src2ident"].get((conv.get("contact_inbox") or {}).get("source_id"))
    content = data.get("content") or ""
    has_atts = bool(data.get("attachments"))
    if not ident or (not content and not has_atts):
        return {"ok": True}
    if mid is not None and _seen_has(mid):
        log.info("дубль webhook mid=%s — пропуск", mid)
        return {"ok": True}
    job = {"mid": mid, "conv": conv_id, "ident": ident, "content": content, "has_atts": has_atts}
    # ставим в очередь и СРАЗУ отвечаем ok (доставка — в фоне, до 10 мин с ретраями)
    async with _lock:
        _state["outbox"].append(job)
        save_state()
    await _outbox_q.put(job)
    return {"ok": True}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080, log_level="info")
