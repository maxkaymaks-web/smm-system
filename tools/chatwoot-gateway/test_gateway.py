"""Юнит-тесты чистой логики шлюза (без сети). Запуск: python test_gateway.py"""
import os
import asyncio

# дефолтное окружение, чтобы gateway.py импортировался без реального .env
os.environ.setdefault("CHATWOOT_URL", "http://rails:3000")
os.environ.setdefault("CHATWOOT_VK_INBOX_IDENTIFIER", "vkinbox")
os.environ.setdefault("CHATWOOT_TG_INBOX_IDENTIFIER", "tginbox")
os.environ.setdefault("VK_COMMUNITY_TOKEN", "x")
os.environ.setdefault("VK_GROUP_ID", "1")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "1:abc")
os.environ.setdefault("STATE_PATH", "/tmp/test_state.json")

import httpx  # noqa: E402
import gateway as g  # noqa: E402


def test_chunked():
    assert g.chunked([1, 2, 3, 4, 5], 2) == [[1, 2], [3, 4], [5]]
    assert g.chunked([], 10) == []
    assert g.chunked([1, 2], 10) == [[1, 2]]


def test_retry_window_is_about_10min():
    assert g.OUT_ATTEMPTS == 5
    # 4 паузы между 5 попытками, сумма ~10 минут
    assert sum(g.OUT_DELAYS) == 600
    assert len(g.OUT_DELAYS) == g.OUT_ATTEMPTS - 1


def test_is_permanent():
    def err(code):
        req = httpx.Request("GET", "http://x")
        resp = httpx.Response(code, request=req)
        return httpx.HTTPStatusError("x", request=req, response=resp)
    assert g.is_permanent(err(422)) is True
    assert g.is_permanent(err(400)) is True
    assert g.is_permanent(err(404)) is False   # 404 ретраим (протухший URL)
    assert g.is_permanent(err(429)) is False   # rate limit ретраим
    assert g.is_permanent(err(500)) is False
    assert g.is_permanent(httpx.ReadError("")) is False  # сетевой обрыв -> ретрай


def test_tg_partition_images_vs_docs():
    small = b"x" * 10
    big = b"x" * (g.TG_PHOTO_LIMIT + 1)
    files = [
        {"file_type": "image", "data": small, "name": "a.jpg"},
        {"file_type": "image", "data": big, "name": "huge.jpg"},   # >10МБ -> в документы
        {"file_type": "file", "data": small, "name": "doc.pdf"},
    ]
    imgs, docs = g.tg_partition(files)
    assert [f["name"] for f in imgs] == ["a.jpg"]
    assert [f["name"] for f in docs] == ["huge.jpg", "doc.pdf"]


def test_dedup_seen_ring():
    g._state["seen_out"] = []
    g._state["outbox"] = [{"mid": 7}]
    assert g._seen_has(7) is True       # в очереди
    assert g._seen_has(8) is False
    asyncio.run(g._mark_done(7, delivered=True))
    assert g._seen_has(7) is True       # теперь в seen
    assert all(j.get("mid") != 7 for j in g._state["outbox"])  # выкинут из outbox


def test_seen_ring_bounded():
    g._state["seen_out"] = list(range(g.SEEN_MAX + 50))
    g._state["outbox"] = []
    asyncio.run(g._mark_done(999999, delivered=True))
    assert len(g._state["seen_out"]) <= g.SEEN_MAX


def test_tg_build_part_album_no_download():
    m = {"chat": {"id": 123}, "from": {"id": 9, "first_name": "Ан"},
         "caption": "подпись", "media_group_id": "MG1",
         "photo": [{"file_id": "small"}, {"file_id": "BIG"}]}
    part = g.tg_build_part(m)
    assert part["ident"] == "tg:123"
    assert part["name"] == "Ан"
    assert part["text"] == "подпись"
    assert part["media"] == [["photo.jpg", "image/jpeg", "BIG"]]  # берём крупнейший размер
    # часть JSON-сериализуема (важно для персиста альбома)
    import json
    json.loads(json.dumps(part))


def run():
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for t in tests:
        try:
            t()
            print(f"  ok  {t.__name__}")
        except Exception as e:
            failed += 1
            print(f"FAIL  {t.__name__}: {e!r}")
    print(f"\n{len(tests) - failed}/{len(tests)} passed")
    return failed


if __name__ == "__main__":
    raise SystemExit(1 if run() else 0)
