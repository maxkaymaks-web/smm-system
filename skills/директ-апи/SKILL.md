---
name: директ-апи
description: "Создаёт кампании Яндекс Директ через API v5: Поиск (WB_MAXIMUM_CLICKS + SKAG-lite) и РСЯ (AVERAGE_CPC) с фото/видео. Вызывай когда нужно создать кампанию через API, директ-апи, залей в директ, создай поиск, создай РСЯ."
allowedTools:
  - Bash
  - Read
  - Write
  - Glob
---

# /директ-апи — Яндекс Директ API Campaign Creator

Создаёт кампании через Яндекс Директ API v5. Два типа: Поиск (SKAG-lite) и РСЯ (фото + видео).

---

## Переменные окружения

```
YANDEX_DIRECT_TOKEN  — OAuth токен (из ~/.claude/.env.direct)
```

Найти токен: `grep "YANDEX_DIRECT_TOKEN" ~/.claude/.env.direct | grep -v "^#" | cut -d= -f2`

---

## API базовые настройки

```python
import json, time, requests
from pathlib import Path
from datetime import date

TOKEN = ""
env_file = Path.home() / ".claude" / ".env.direct"
if env_file.exists():
    for line in env_file.read_text().splitlines():
        if line.startswith("YANDEX_DIRECT_TOKEN") and "=" in line:
            TOKEN = line.split("=", 1)[1].strip(); break
if not TOKEN:
    raise RuntimeError("YANDEX_DIRECT_TOKEN не найден")

API_BASE = "https://api.direct.yandex.com/json/v5"
HEADERS = {
    "Authorization": f"Bearer {TOKEN}",
    "Accept-Language": "ru",
    "Content-Type": "application/json; charset=utf-8",
}

def api_call(service, method, params):
    url = f"{API_BASE}/{service}"
    r = requests.post(url, headers=HEADERS, json={"method": method, "params": params})
    r.raise_for_status()
    data = r.json()
    if "error" in data:
        raise RuntimeError(
            f"API [{data['error']['error_code']}]: "
            f"{data['error']['error_detail']} | {data['error'].get('error_string','')}"
        )
    return data.get("result", data)
```

---

## КРИТИЧЕСКИЕ ЛОВУШКИ API v5

Список ошибок, которые не очевидны и стоят часов дебага:

| Ловушка | Неправильно | Правильно |
|---------|-------------|-----------|
| Минус-слова | `{"Items": ["-слово", "-фраза"]}` | `{"Items": ["слово", "фраза"]}` — **без дефиса!** |
| NegativeGeoId | `group_payload["NegativeGeoId"] = [1]` | Такого поля нет! Использовать отрицательные ID в RegionIds |
| Исключить регион | `RegionIds: [225]` + отдельный NegativeGeoId | `RegionIds: [225, -1, -10174]` — минус перед ID = исключение |
| CounterIds | `"CounterIds": [id]` | `"CounterIds": {"Items": [id]}` |
| Sitelinks параметр | `"SitelinkSets"` | `"SitelinksSets"` — **двойная S!** |
| Callout поле | `{"CalloutText": t}` через `ads.update` | `"AdExtensionIds"` работает только в `ads.add`! |
| Callout поле | `{"Text": t}` | `{"CalloutText": t}` |
| Архив черновика | `campaigns.archive` | Черновики нельзя архивировать! Удалять только через UI |
| Украина геотаргетинг | RegionIds: [..., 187, ...] | 187 (Украина) **заблокирована**, API вернёт ошибку 5120 |
| Ошибка 1000 | Критическая ошибка | Transient (временная) — обернуть в retry с sleep(2) |

### parse_negatives() — ОБЯЗАТЕЛЬНАЯ функция

Минус-слова в API передаются **без ведущего дефиса**. Пиши строки как `-слово1 -фраза1 слово2`, но парси так:

```python
def parse_negatives(neg_str):
    """
    '-слово1 -фраза1 слово2 -слово3' → ['слово1', 'фраза1 слово2', 'слово3']
    Многословные фразы: слово после дефисного = продолжение предыдущего.
    """
    tokens = neg_str.split()
    phrases, current = [], []
    for token in tokens:
        if token.startswith('-'):
            if current:
                phrases.append(' '.join(current))
                current = []
            word = token[1:]
            if word:
                current = [word]
        else:
            if current:
                current.append(token)
    if current:
        phrases.append(' '.join(current))
    return phrases

# Использование:
# "NegativeKeywords": {"Items": parse_negatives("-скачать -бесплатно без регистрации")}
# → {"Items": ["скачать", "бесплатно без регистрации"]}
```

---

## Стратегии кампаний

### Поиск-only (WB_MAXIMUM_CLICKS)

```python
"BiddingStrategy": {
    "Search": {
        "BiddingStrategyType": "WB_MAXIMUM_CLICKS",
        "WbMaximumClicks": {
            "WeeklySpendLimit": int(budget_rub * 1_000_000)  # микрорубли!
        }
    },
    "Network": {"BiddingStrategyType": "SERVING_OFF"}
}
```

### РСЯ-only (AVERAGE_CPC)

```python
"BiddingStrategy": {
    "Search": {"BiddingStrategyType": "SERVING_OFF"},
    "Network": {
        "BiddingStrategyType": "AVERAGE_CPC",
        "AverageCpc": {
            "AverageCpc": 15_000_000,  # 15 руб — ОБЯЗАТЕЛЬНОЕ поле!
            "WeeklySpendLimit": int(budget_rub * 1_000_000)
        }
    }
}
```

**Стратегия `AVERAGE_CPA` не работает на старте** — нужно 40+ конверсий. Начинай всегда с WB_MAXIMUM_CLICKS / AVERAGE_CPC.

---

## Географический таргетинг

| Регион | ID |
|--------|----|
| Россия (вся) | 225 |
| Москва | 1 |
| Московская область | 10174 |
| Санкт-Петербург | 2 |
| Беларусь | 149 |
| Казахстан | 159 |
| Армения | 1056 |
| Азербайджан | 167 |
| Узбекистан | 170 |
| Киргизия | 171 |
| Таджикистан | 168 |
| Молдова | 157 |
| Грузия | 29386 |
| ~~Украина~~ | ~~187~~ — **заблокирована в API** |

### Паттерн разбивки по гео

```python
CAMPAIGNS = [
    {"geo": "msk",   "name": "Продукт - Поиск - Москва и МО",  "region_ids": [1, 10174],            "budget": 5000},
    {"geo": "rf",    "name": "Продукт - Поиск - РФ (регионы)", "region_ids": [225, -1, -10174],      "budget": 7000},
    {"geo": "world", "name": "Продукт - Поиск - МИР",          "region_ids": [149,159,171,168,170,1056,167,157,29386], "budget": 3000},
]
# Отрицательные ID в RegionIds = исключение региона. Нет отдельного поля NegativeGeoId!
```

### Именование кампаний

Паттерн: `[Название продукта] - [Тип: Поиск/РСЯ] - [Гео]`

Примеры:
- `Bedtimi CWS - Поиск - Москва и МО`
- `LookBook - РСЯ - Россия`

---

## ПОИСК: SKAG-lite методология

### Принцип

**SKAG-lite** (Single Keyword Ad Group lite) — 1 ядро-запрос на группу, в объявлении ядро стоит дословно в Title1 (первые 30 символов). Яндекс **жирным выделяет совпадение** с поисковым запросом → +20–40% CTR.

### Правило подсветки

```
Поисковик ищет: "как уложить ребенка спать"
Title1: "Как уложить ребёнка спать за 15 мин"  ← совпадение в начале → вся фраза жирная
Title1: "Поможем уложить ребёнка спать"          ← нет совпадения в начале → нет жирного
```

**Вывод:** ядровый запрос ДОСЛОВНО в начале Title1.

### DisplayUrlPath (кириллица!)

- Кириллица в DisplayUrlPath **тоже подсвечивается жирным** при совпадении
- Максимум 20 символов, без точек, дефисы разрешены
- Пример: `display="Уложить-Спать"` → при запросе «уложить спать» → жирное

### Шаблон подстановки `##`

Для групп с разнородными ключами (высокочастотные + хвосты):

```python
ad_a=("#Генератор сказок для детей - 30 сек#", ...)
# Если поисковый запрос влезает в 56 символов — он подставляется автоматически
# Если не влезает — показывается дефолтный текст внутри ##
# При валидации: считать len(текст_без_символов_решётки) ≤ 56
```

### Структура групп

```python
GROUPS = [
    dict(
        code="sp-uloschit",          # уникальный код для отладки
        name="A1. Уложить ребёнка спать",  # имя группы (блок + номер)
        seg="sleep-pain",            # ?seg= параметр для гиперсегментации лендинга
        display="Уложить-Спать",     # DisplayUrlPath ≤20 символов
        neg="-грудничок -1 год -2 года -таблетки",  # минус-слова группы
        keywords=["как уложить ребенка спать", ...],
        ad_a=("Title1 56 симв", "Title2 30 симв", "Text 81 симв"),
        ad_b=("Title1 B-вариант", "Title2 B", "Text B"),
    ),
    ...
]
```

### Блоки семантики

Группируй группы по смысловым блокам (A, B, C...):

```
A — Боль/проблема (pain): «не засыпает», «укладывание», «истерика»
B — Контент по возрасту: «сказки 4 года», «сказки 7 лет»
C — Терапия/страхи: «боится темноты», «страхи», «сказкотерапия»
D — Тип контента: «интерактивная», «придумать», «засыпательные»
E — Персонализация: «с именем», «генератор», «нейросеть»
F — VS конкурент: «алиса сказка», «станция», «vs [аналог]»
```

### Что повышает CTR в Поиске

1. **Ядро дословно в Title1** (первые 30 символов) — жирная подсветка +20–40%
2. **DisplayUrlPath на кириллице** — тоже подсвечивается, доверие
3. **Title2** — показывается опционально, используй для УТП
4. **Быстрые ссылки** — API позволяет до 8, все видны на позиции 1
5. **Подсказки (callouts)** — до 8 фраз по 25 символов
6. **Промоакция** — +30% CTR, настраивается в интерфейсе после создания
7. **Вопрос в Title1** — «Ребёнок не засыпает? →» вовлекает эмоционально

### Лимиты объявлений

| Поле | Лимит | Примечание |
|------|-------|------------|
| Title1 | 56 симв | Считать без символов `#` для шаблонов |
| Title2 | 30 симв | |
| Text | 81 симв | |
| DisplayUrlPath | 20 симв | Без точек! Дефисы разрешены |
| Быстрые ссылки | 8 шт | Описание к каждой — до 60 симв |
| Подсказки | 8 шт | До 25 симв каждая |

### Валидация перед запуском

```python
BANNED = set("→←↑↓↔↕⇒⇐⇑⇓«»—–№")
LIMITS = {"t1": 56, "t2": 30, "text": 81, "display": 20}

def validate_ad(code, t1, t2, text, display):
    errs = []
    for val, field in [(t1, "t1"), (t2, "t2"), (text, "text"), (display, "display")]:
        if not val: continue
        clean = val.replace("#", "")  # для шаблонов считаем без решёток
        if len(clean) > LIMITS[field]:
            errs.append(f"  ⚠️  {code}.{field}: {len(clean)} > {LIMITS[field]}: {clean}")
        bad = BANNED & set(val)
        if bad:
            errs.append(f"  ❌ {code}.{field}: запрещённые символы {bad}")
    return errs

# Запускать ПЕРЕД любыми API-вызовами — exit(1) если есть ошибки
```

### «Мало показов» — управление рисками

Группы с <50 показов/месяц Яндекс **автоматически отключает** (статус «Мало показов»).

| Объём ключа | Действие |
|-------------|----------|
| >200/мес | Отдельная группа |
| 50–200/мес | Объединить 2–3 похожих в одну группу |
| <50/мес | Объединить с более крупной или убрать |

Если группа всё равно отключается — использовать шаблон `##` и добавлять хвосты.

---

## Создание кампании (Поиск) — полный шаблон

```python
def create_search_campaign(name, weekly_budget_rub, counter_id=None):
    camp = {
        "Name": name,
        "StartDate": date.today().strftime("%Y-%m-%d"),
        "NegativeKeywords": {"Items": parse_negatives(CAMPAIGN_NEGATIVE)},
        "TextCampaign": {
            "BiddingStrategy": {
                "Search": {
                    "BiddingStrategyType": "WB_MAXIMUM_CLICKS",
                    "WbMaximumClicks": {"WeeklySpendLimit": int(weekly_budget_rub * 1_000_000)}
                },
                "Network": {"BiddingStrategyType": "SERVING_OFF"}
            },
            "Settings": [{"Option": "ADD_METRICA_TAG", "Value": "YES"}],
        }
    }
    if counter_id:
        camp["TextCampaign"]["CounterIds"] = {"Items": [counter_id]}
    result = api_call("campaigns", "add", {"Campaigns": [camp]})
    items = result.get("AddResults", [])
    if not items or "Errors" in items[0]:
        raise RuntimeError(f"Ошибка: {items[0].get('Errors')}")
    return items[0]["Id"]
```

## Создание группы (Поиск) — с минус-словами

```python
def create_group(campaign_id, name, region_ids, neg_str=None):
    payload = {
        "Name": name[:255],
        "CampaignId": campaign_id,
        "RegionIds": region_ids,  # отрицательные ID = исключения: [225, -1, -10174]
    }
    if neg_str:
        payload["NegativeKeywords"] = {"Items": parse_negatives(neg_str)}
    # НЕЛЬЗЯ: payload["NegativeGeoId"] — такого поля нет в API v5!
    result = api_call("adgroups", "add", {"AdGroups": [payload]})
    items = result.get("AddResults", [])
    if not items or "Errors" in items[0]:
        raise RuntimeError(f"Ошибка группы: {items[0].get('Errors')}")
    return items[0]["Id"]
```

## Создание объявлений (Поиск, A/B пара)

```python
def create_search_ads(group_id, geo, g, sitelinks_id, callout_ids):
    ads = []
    for variant, (t1, t2, text) in [("a", g["ad_a"]), ("b", g["ad_b"])]:
        href = (f"https://example.com/app?seg={g['seg']}"
                f"&utm_source=yandex&utm_medium=cpc"
                f"&utm_campaign=search-{geo}"
                f"&utm_term={{keyword}}&utm_content={{ad_id}}-{variant}")
        ad_data = {
            "Title":  t1[:56],
            "Title2": t2[:30],
            "Text":   text[:81],
            "Href":   href,
            "Mobile": "NO",
            "DisplayUrlPath": g["display"][:20],
            "SitelinkSetId": sitelinks_id,
            "AdExtensionIds": callout_ids[:8],  # только в ads.add!
        }
        # В Поиске НЕТ: AdImageHash, VideoExtension
        ads.append({"AdGroupId": group_id, "TextAd": ad_data})

    result = api_call("ads", "add", {"Ads": ads})
    items = result.get("AddResults", [])
    ok = [i["Id"] for i in items if "Errors" not in i]
    err = [i for i in items if "Errors" in i]
    if err:
        for e in err: print(f"  ⚠️  Объявление: {e.get('Errors')}")
    return ok
```

## Быстрые ссылки с описаниями

```python
def create_sitelinks(links):
    """
    links = [{"Title": "...", "Href": "https://...", "Description": "..."}]
    ВАЖНО: 'SitelinksSets' — двойная S!
    Максимум 8 ссылок, описание до 60 символов каждое.
    """
    result = api_call("sitelinks", "add", {"SitelinksSets": [{"Sitelinks": links[:8]}]})
    items = result.get("AddResults", [])
    if not items or "Errors" in items[0]:
        raise RuntimeError(f"Ошибка sitelinks: {items}")
    return items[0]["Id"]
```

## Подсказки (Callouts)

```python
def create_callouts(texts):
    """ВАЖНО: поле CalloutText (не Text!), макс 25 символов каждая."""
    result = api_call("adextensions", "add", {
        "AdExtensions": [{"Callout": {"CalloutText": t[:25]}} for t in texts]
    })
    return [i["Id"] for i in result.get("AddResults", []) if "Errors" not in i]
```

## Ключевые слова

```python
def add_keywords(group_id, keywords):
    kw_list = [{"Keyword": kw, "AdGroupId": group_id} for kw in keywords]
    result = api_call("keywords", "add", {"Keywords": kw_list})
    ok = [i for i in result.get("AddResults", []) if "Errors" not in i]
    print(f"  🔑 Ключей: {len(ok)}/{len(keywords)}")
    return ok
```

---

## РСЯ: фото и видео объявления

### Типы объявлений РСЯ

| Тип | Поля |
|-----|------|
| Текстово-графическое (ТГО) | `TextAd` + `AdImageHash` |
| Видео-дополнение | `TextAd` + `VideoExtension.CreativeId` |

В одной группе создавай оба типа — они не конкурируют.

### Требования к изображениям

| Параметр | Значение |
|----------|----------|
| Форматы | JPG, PNG, WebP, GIF |
| 16:9 | 1280×720 px минимум (2752×1536 **не принимается**!) |
| 1:1 | 600×600 px минимум |
| Вес | ≤ 10 МБ |

Ресайз на macOS: `sips -z 720 1280 input.jpg --out output.jpg`

### Требования к видео

| Параметр | Значение |
|----------|----------|
| Формат | MP4 (H.264), 16:9 |
| Длительность | 5–60 сек |
| Вес | ≤ 100 МБ |
| ID | Возвращается как **hex-строка** (не int!) |
| Статус готовности | `Status = "READY"` (поля `Moderate` не существует) |

### Загрузка изображений и видео

```python
import base64

def upload_image(path, name):
    data = base64.b64encode(open(path, "rb").read()).decode()
    result = api_call("adimages", "add", {"AdImages": [{"ImageData": data, "Name": name[:50]}]})
    items = result.get("AddResults", [])
    if not items or "Errors" in items[0]:
        raise RuntimeError(f"Ошибка изображения: {items[0].get('Errors')}")
    return items[0]["AdImageHash"]  # ВАЖНО: AdImageHash, не ImageHash!

def upload_video(path, name):
    data = base64.b64encode(open(path, "rb").read()).decode()
    result = api_call("advideos", "add", {"AdVideos": [{"VideoData": data, "Name": name[:100]}]})
    items = result.get("AddResults", [])
    if not items or "Errors" in items[0]:
        raise RuntimeError(f"Ошибка видео: {items[0].get('Errors')}")
    return str(items[0]["Id"])  # hex-строка!

def wait_for_video(video_id, timeout=300):
    """FieldNames только ['Id', 'Status']. Status='READY' = готово."""
    start = time.time()
    while time.time() - start < timeout:
        result = api_call("advideos", "get", {
            "SelectionCriteria": {"Ids": [video_id]},
            "FieldNames": ["Id", "Status"]
        })
        items = result.get("AdVideos", [])
        if items:
            status = items[0].get("Status")
            if status == "READY": return video_id
            if status == "REJECTED": raise RuntimeError("Видео отклонено")
        time.sleep(15)
    raise TimeoutError(f"Видео не обработалось за {timeout}с")

def create_video_creative(video_id):
    """ВАЖНО: только VideoId. Нет полей Name и Duration."""
    result = api_call("creatives", "add", {
        "Creatives": [{"VideoExtensionCreative": {"VideoId": video_id}}]
    })
    items = result.get("AddResults", [])
    if not items or "Errors" in items[0]:
        raise RuntimeError(f"Ошибка креатива: {items[0].get('Errors')}")
    return items[0]["Id"]
```

### Что повышает CTR в РСЯ

1. **Быстрые ссылки** — до 4 ссылок в расширенном формате
2. **Подсказки (Callout)** — до 8 фраз по 25 символов
3. **Title2** — 30 симв, показывается опционально
4. **Качественное изображение** — лицо/эмоция > продукт
5. **Видео-дополнение** — аутоплей на мобильных, +20–30% CTR

---

## Метрика: счётчик и цели

```python
def connect_counter(campaign_id, counter_id):
    api_call("campaigns", "update", {"Campaigns": [{
        "Id": campaign_id,
        "TextCampaign": {"CounterIds": {"Items": [counter_id]}}
        # ВАЖНО: {"Items": [id]}, не просто [id]!
    }]})

def ensure_metrica_goal(counter_id, goal_name):
    """Ищет цель по имени, создаёт если нет. Возвращает goal_id."""
    url = f"https://api-metrika.yandex.net/management/v1/counter/{counter_id}/goals"
    goals = requests.get(url, headers={"Authorization": f"Bearer {TOKEN}"}).json().get("goals", [])
    for g in goals:
        if g.get("name", "").lower() == goal_name.lower():
            return g["id"]
    r = requests.post(url,
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
        json={"goal": {"name": goal_name, "type": "action"}}
    )
    r.raise_for_status()
    return r.json()["goal"]["id"]
```

---

## Переименование и управление кампаниями

```python
# Переименовать несколько кампаний за раз
api_call("campaigns", "update", {"Campaigns": [
    {"Id": 12345, "Name": "Новое название 1"},
    {"Id": 67890, "Name": "Новое название 2"},
]})

# Запустить кампанию (DRAFT → запущена)
api_call("campaigns", "resume", {"SelectionCriteria": {"Ids": [campaign_id]}})

# Архивировать кампанию (НЕЛЬЗЯ архивировать DRAFT — только через UI!)
api_call("campaigns", "archive", {"SelectionCriteria": {"Ids": [campaign_id]}})
```

---

## Полный алгоритм запуска

### Шаг 0 — Сбор параметров

Спроси если не задано явно:

1. **Название кампании** — паттерн: `Продукт - Поиск/РСЯ - Гео`
2. **Бюджет** — недельный (рублей)
3. **Счётчик Метрики** — ID (ищи в HTML лендинга `ym(XXXXX`)
4. **Тип кампании** — Поиск или РСЯ
5. **Регионы** — [1, 10174] / [225] / [225, -1, -10174] / страны
6. **Семантика** — сегменты → группы → ключи
7. **Тексты** — Title1 (≤56), Title2 (≤30), Text (≤81) × A и B вариант
8. **Быстрые ссылки** — до 8 пар (заголовок + URL + описание)
9. **Подсказки** — до 8 фраз по ≤25 символов
10. **Для РСЯ:** пути к фото (1280×720) и видео (MP4, 5-60 сек)

### Шаг 1 — Создать Python-скрипт

Создавай скрипт в `~/Downloads/` (не `/tmp/` — он может переполниться!).

Структура скрипта:
1. Загрузить токен
2. Определить `parse_negatives()`, `api_call()`, `validate_ad()`
3. Объявить GROUPS, CAMPAIGNS, CAMPAIGN_NEGATIVE
4. Валидация всех текстов → exit(1) если ошибки
5. Создать shared ресурсы (sitelinks, callouts) — 1 раз на все кампании
6. Цикл по кампаниям → создать → добавить группы → объявления → ключи
7. Оставить в DRAFT, сохранить IDs в JSON

### Шаг 2 — Запустить

```bash
python3 ~/Downloads/yd_campaign.py
```

Если нет `requests`: `pip3 install requests`

### Шаг 3 — После создания

- Проверить в direct.yandex.ru: тексты, быстрые ссылки, стратегию
- Добавить промоакцию (+30% CTR) — только через UI
- Запустить кампанию (Resume) или оставить в DRAFT до согласования

### Шаг 4 — Оптимизация (через 2–4 недели)

- CTR < 2% на Поиске → переработать Title1 (проверь подсветку)
- Статус «Мало показов» → объединить группы или добавить хвосты
- После 40+ конверсий → сменить стратегию на «Максимум конверсий»
- A/B тест: оценивать по CPI = CTR × CR (не только CTR)

---

## Коды Яндекс регионов — быстрый справочник

```python
REGIONS = {
    "msk":   [1, 10174],                      # Москва + МО
    "spb":   [2, 10219],                      # СПб + ЛО
    "rf":    [225, -1, -10174],               # РФ без Москвы и МО
    "rf_all":[225],                           # Вся Россия
    "cis":   [149, 159, 171, 168, 170, 1056, 167, 157, 29386],  # СНГ без UA
    # 187 (Украина) — заблокирована в Яндекс Директ
}
```
