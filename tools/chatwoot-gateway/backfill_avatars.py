"""Одноразовый бэкфилл аватарок существующим контактам (новые получают авто).
Запуск в контейнере шлюза: docker compose exec -T gateway python /app/backfill_avatars.py
Переиспользует логику gateway.py (vk_profile/tg_avatar/cw).
"""
import asyncio
import gateway as g

# (identifier, kind, user_id) — кому проставить
USERS = [
    ("vk:232768520", "vk", 232768520),
    ("tg:1642013697", "tg", 1642013697),
]


async def find_contact_id(ident):
    r = await g.cw.get(f"/api/v1/accounts/{g.ACCOUNT_ID}/contacts/search",
                       params={"q": ident},
                       headers={"api_access_token": g.API_TOKEN})
    for c in r.json().get("payload", []):
        if c.get("identifier") == ident:
            return c["id"]
    return None


async def main():
    for ident, kind, uid in USERS:
        cid = await find_contact_id(ident)
        if not cid:
            print(f"{ident}: контакт не найден"); continue
        av = (await g.vk_profile(uid))[1] if kind == "vk" else await g.tg_avatar(uid)
        if not av:
            print(f"{ident}: аватар недоступен"); continue
        await g.cw.put(f"/api/v1/accounts/{g.ACCOUNT_ID}/contacts/{cid}",
                       headers={"api_access_token": g.API_TOKEN},
                       files={"avatar": ("avatar.jpg", av, "image/jpeg")})
        print(f"{ident}: аватар установлен (contact {cid}, {len(av)}B)")


asyncio.run(main())
