#!/usr/bin/env python3
"""Generate Reels #19, #20, #21 for Sofia / ЭНЖЕ — новые форматы по ОС-2."""

import base64
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT_BASE = ROOT / "projects/Sofia/posts/drafts"

with open(ROOT / "global/brand/logo.png", "rb") as f:
    LOGO_B64 = "data:image/png;base64," + base64.b64encode(f.read()).decode()

FONT_URI = (ROOT / "global/brand/NataSans-VariableFont_wght.ttf").as_uri()

CSS = f"""<style>
@font-face {{
  font-family:'Nata Sans';
  src:url('{FONT_URI}') format('truetype');
  font-weight:100 900;
}}
*{{box-sizing:border-box;margin:0;padding:0}}
body{{font-family:'Nata Sans',-apple-system,sans-serif;background:var(--bg);color:var(--text);
  font-size:13px;line-height:1.5;max-width:860px;margin:0 auto;padding:24px 28px}}
:root{{--bg:#FEFEFF;--bg-alt:#F6FAFC;--text:#0B0B0B;--accent:#FF1E1E;
  --accent-orange:#FF6B00;--border:rgba(11,11,11,0.09);--muted:rgba(11,11,11,0.42);
  --r:10px;--r-sm:5px;--r-pill:20px}}
.header{{display:flex;justify-content:space-between;align-items:flex-start;
  border-bottom:2px solid var(--border);padding-bottom:16px;margin-bottom:18px}}
.logo{{height:44px;flex-shrink:0}}
.label{{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;
  color:var(--muted);margin-bottom:4px}}
h1{{font-size:20px;font-weight:800;line-height:1.2;margin-bottom:4px}}
.sub{{font-size:11.5px;color:var(--muted)}}
.ref-block{{background:#FFF8E1;border-left:3px solid var(--accent-orange);
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:12px 14px;margin-bottom:14px}}
.ref-label{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--accent-orange);margin-bottom:4px}}
.ref-text{{font-size:12.5px}}
.concept-block{{background:var(--bg-alt);border-left:3px solid var(--accent);
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:12px 14px;margin-bottom:14px}}
.concept-label{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--accent);margin-bottom:4px}}
.concept-text{{font-size:12.5px}}
.badges{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}}
.badge{{font-size:10.5px;font-weight:700;border-radius:var(--r-pill);padding:3px 10px}}
.badge-type{{background:#1a1a1a;color:#fff}}
.badge-seg{{background:#e8f4fd;color:#1565c0}}
.badge-dur{{background:#e8f5e9;color:#2e7d32}}
.badge-ref{{background:#fff3e0;color:#e65100;font-size:10px}}
.hook-block{{border:2px solid var(--accent);border-radius:var(--r);padding:14px 16px;
  margin-bottom:14px;page-break-inside:avoid;break-inside:avoid}}
.hook-label{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--accent);margin-bottom:6px}}
.hook-text{{font-size:17px;font-weight:800;margin-bottom:6px}}
.hook-type{{font-size:11px;color:var(--muted)}}
.hook-vis{{font-size:11.5px;margin-top:8px;background:var(--bg-alt);
  padding:8px 10px;border-radius:var(--r-sm)}}
.section-title{{font-size:11px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--muted);margin:18px 0 8px}}
.storyboard{{width:100%;border-collapse:collapse;font-size:11.5px;
  page-break-inside:avoid;break-inside:avoid}}
.storyboard th{{background:#0B0B0B;color:#fff;font-weight:700;
  padding:7px 8px;text-align:left;font-size:10.5px}}
.storyboard td{{border-bottom:1px solid var(--border);padding:7px 8px;vertical-align:top}}
.storyboard tr:nth-child(even) td{{background:var(--bg-alt)}}
.num{{font-weight:800;color:var(--accent);width:24px}}
.time{{white-space:nowrap;color:var(--muted);font-weight:700;width:50px}}
.instr-grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px;
  page-break-inside:avoid;break-inside:avoid}}
.instr-card{{background:var(--bg-alt);border:1px solid var(--border);
  border-radius:var(--r-sm);padding:10px 12px}}
.instr-card .key{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:var(--muted);margin-bottom:3px}}
.instr-card .val{{font-size:12px}}
.music-block{{background:var(--bg-alt);border:1px solid var(--border);
  border-radius:var(--r);padding:14px 16px;margin-bottom:14px;
  page-break-inside:avoid;break-inside:avoid}}
.music-block .track{{font-size:15px;font-weight:800}}
.music-block .why{{font-size:11.5px;color:var(--muted);margin-top:6px}}
.music-block .alt{{font-size:11px;margin-top:8px;color:var(--muted)}}
.two-col{{display:grid;grid-template-columns:3fr 2fr;gap:12px;
  page-break-inside:avoid;break-inside:avoid}}
.caption-block,.hash-block{{background:var(--bg-alt);border:1px solid var(--border);
  border-radius:var(--r-sm);padding:12px 14px}}
.caption-block pre,.hash-block pre{{font-family:inherit;font-size:11.5px;
  white-space:pre-wrap;word-break:break-word}}
.publish-grid{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;
  margin-bottom:16px;page-break-inside:avoid;break-inside:avoid}}
.pub-card{{background:#FFF3E0;border:1px solid #FFD0A0;
  border-radius:var(--r-sm);padding:10px 12px}}
.pub-card .key{{font-size:10px;font-weight:700;color:var(--accent-orange);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}}
.footer{{border-top:1px solid var(--border);margin-top:20px;padding-top:10px;
  display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}}
.sitcom-note{{background:#E8F5E9;border-left:3px solid #2E7D32;
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:10px 14px;margin-bottom:14px}}
.sitcom-note .key{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:#2E7D32;margin-bottom:4px}}
.sitcom-note .val{{font-size:12px}}
</style>"""


def html(s):
    rows_html = "\n".join(
        f"<tr><td class='num'>{r[0]}</td><td class='time'>{r[1]}</td>"
        f"<td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td></tr>"
        for r in s["rows"]
    )
    instr_html = "\n".join(
        f"<div class='instr-card'><div class='key'>{k}</div><div class='val'>{v}</div></div>"
        for k, v in s["instr"]
    )
    cap = s["caption"].replace("&", "&amp;").replace("<", "&lt;")
    htags = s["hashtags"].replace("&", "&amp;")
    n = s["n"]
    date = s.get("date", "05.08.2026")

    sitcom_html = ""
    if s.get("characters"):
        chars_html = "".join(
            f"<div class='sitcom-note'><div class='key'>Персонаж</div><div class='val'>{c}</div></div>"
            for c in s["characters"]
        )
        sitcom_html = f"""
<div class="section-title">Персонажи (ситком-формат)</div>
{chars_html}
"""

    return f"""<!doctype html>
<html lang="ru">
<head><meta charset="utf-8">
<title>Сценарий Reels #{n} — ЭНЖЕ | bit&amp;pix</title>
{CSS}
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="label">Сценарий Reels #{n} &mdash; Sofia / ЭНЖЕ Стоматология</div>
    <h1>{s['title']}</h1>
    <div class="sub">{date} &nbsp;|&nbsp; {s['type']} &nbsp;|&nbsp; {s['dur']}</div>
  </div>
  <img class="logo" src="{LOGO_B64}" alt="bit&amp;pix">
</div>

<div class="ref-block">
  <div class="ref-label">&#128279; Референс (ОС-2 от Софии)</div>
  <div class="ref-text">{s['ref_desc']}</div>
</div>

<div class="concept-block">
  <div class="concept-label">Концепция</div>
  <div class="concept-text">{s['concept']}</div>
</div>

<div class="badges">
  <span class="badge badge-type">{s['type']}</span>
  <span class="badge badge-seg">{s['seg']}</span>
  <span class="badge badge-dur">&#9201; {s['dur']}</span>
  <span class="badge badge-ref">Аналог: {s['analog']} &middot; {s['analog_views']}</span>
</div>

<div class="hook-block">
  <div class="hook-label">ХУК &mdash; первые 2 секунды</div>
  <div class="hook-text">{s['hook_text']}</div>
  <div class="hook-type">Тип: {s['hook_type']}</div>
  <div class="hook-vis">{s['hook_vis']}</div>
</div>
{sitcom_html}
<div class="section-title">Раскадровка</div>
<table class="storyboard">
  <thead>
    <tr>
      <th>#</th><th>Время</th><th>Что в кадре / снять</th>
      <th>Монтаж</th><th>Текст на экране</th><th>Голос / субтитры</th>
    </tr>
  </thead>
  <tbody>{rows_html}</tbody>
</table>

<div class="section-title">Инструкции по съёмке и монтажу</div>
<div class="instr-grid">{instr_html}</div>

<div class="section-title">Музыка</div>
<div class="music-block">
  <div class="track">&#127925; {s['music_track']}</div>
  <div class="why">{s['music_why']}</div>
  <div class="alt">Альтернатива: {s['music_alt']}</div>
</div>

<div class="section-title">Подпись и хэштеги</div>
<div class="two-col">
  <div class="caption-block"><pre>{cap}</pre></div>
  <div class="hash-block"><pre>{htags}</pre></div>
</div>

<div class="section-title">Публикация</div>
<div class="publish-grid">
  <div class="pub-card"><div class="key">Время</div>{s['pub_time']}</div>
  <div class="pub-card"><div class="key">Обложка</div>{s['pub_cover']}</div>
  <div class="pub-card"><div class="key">Геометка</div>ЭНЖЕ Стоматология, Казань</div>
</div>

<div class="footer">
  <span>ЭНЖЕ Стоматология (Sofia) &nbsp;&middot;&nbsp; Сценарий Reels #{n} &nbsp;&middot;&nbsp; {date}</span>
  <span>bit&amp;pix агент</span>
</div>

</body>
</html>"""


def md(s):
    rows_md = "\n".join(
        f"| {r[0]} | {r[1]} | {r[2]} | {r[3]} | {r[4]} | {r[5]} |"
        for r in s["rows"]
    )
    chars_md = ""
    if s.get("characters"):
        chars_md = "\n## Персонажи (ситком-формат)\n" + "\n".join(f"- {c}" for c in s["characters"]) + "\n"
    n = s["n"]
    date = s.get("date", "05.08.2026")
    return f"""# Сценарий Reels #{n} — Sofia / ЭНЖЕ Стоматология
Дата: {date}
Тип: {s['type']}
Тема: {s['title']}
Аналог: {s['analog']} — {s['analog_views']} | {s['analog_url']}

---

## Референс (ОС-2 от Софии)
{s['ref_desc']}

## Идея
{s['concept']}

## Хронометраж: {s['dur']}

---

## ХУК — первые 2 секунды
**Тип:** {s['hook_type']}
**Текст на экране:** «{s['hook_text']}»
**Визуал:** {s['hook_vis']}

---
{chars_md}
## Раскадровка

| # | Время | Что снять | Монтаж | Текст на экране | Озвучка |
|---|-------|-----------|--------|-----------------|---------|
{rows_md}

---

## Инструкции по съёмке

{chr(10).join(f"- **{k}:** {v}" for k, v in s['instr'])}

---

## Музыка

**Трек:** {s['music_track']}
**Почему:** {s['music_why']}
**Альтернатива:** {s['music_alt']}

---

## Подпись

```
{s['caption']}
```

## Хэштеги

```
{s['hashtags']}
```

---

## Публикация

- **Время:** {s['pub_time']}
- **Обложка:** {s['pub_cover']}
- **Геометка:** ЭНЖЕ Стоматология, Казань
"""


SCRIPTS = [
    # ─────────────────────────────────────────────────────────────────────────────
    # #19 — Паттерн DXbG8x0DbsK: страшные термины → абсурдные картинки → финал-разрядка
    # ─────────────────────────────────────────────────────────────────────────────
    {
        "n": 19,
        "date": "05.08.2026",
        "title": "Слова стоматолога которые вас пугают",
        "type": "Юмористический / Скетч-абсурд",
        "seg": "Все сегменты",
        "dur": "20–25 сек",
        "analog": "@kosmetolog.almaty",
        "analog_views": "24 000 просмотров",
        "analog_url": "https://www.instagram.com/reel/DXbG8x0DbsK/",
        "ref_desc": (
            "DXbG8x0DbsK — врач называет медицинские термины пациенту (нити, филлеры, полимолочка, лосось), "
            "каждое слово сопровождается абсурдной картинкой-ассоциацией на экране. "
            "Пациент нарастающе паникует. Субтитры слово-за-словом. Без музыки, только речь + эффект крика."
        ),
        "concept": (
            "Врач перечисляет стоматологические термины — они звучат страшно, но картинки показывают, "
            "что пациент представляет при каждом слове. Абсурдный юмор → разрядка. "
            "Финал: \"Всё. Зуб чистый. Больно не было?\" — пациент в ступоре: \"Нет...\" "
            "Работает как образовательный контент про страхи + вовлечение через узнавание."
        ),
        "hook_text": "ВАМ НУЖНО...",
        "hook_type": "Интрига / обрезанное начало",
        "hook_vis": (
            "Пациент в кресле, чуть напряжён. Врач открывает рот, текст «ВАМ НУЖНО...» появляется "
            "по одному слову на чёрном фоне. Голос врача стартует сразу."
        ),
        "rows": [
            ("1", "0–1с", "Пациент в кресле стоматолога. Нейтральное выражение, чуть напряжённое.", "Статика", "ВАМ НУЖНО...", "Врач: «Вам нужно...»"),
            ("2", "1–3с", "Врач говорит, рядом абсурдная картинка на экране — экскаватор.", "Cut", "ЭКСКАВАЦИЯ", "«...экскавация...»"),
            ("3", "3–5с", "Пациент слегка нахмурился. Картинка: мотоклуб «Ночные волки».", "Cut", "ДЕПУЛЬПИРОВАНИЕ", "«...депульпирование...»"),
            ("4", "5–7с", "Пациент напрягся. Картинка: швея с нитками и иголкой.", "Cut", "КОФФЕРДАМ", "«...коффердам...»"),
            ("5", "7–9с", "Пациент в лёгком ужасе. Картинка: советская шлифовальная машина.", "Cut", "РЕТРАКТОР", "«...ретрактор...»"),
            ("6", "9–11с", "Широко открытые глаза. Картинка: операция на мозге (мультяшно).", "Cut", "АПИКЭКТОМИЯ", "«...апикэктомия...»"),
            ("7", "11–14с", "Пациент в полном ужасе — крупный план лица.", "Zoom-in", "...", "—"),
            ("8", "14–17с", "Врач откладывает инструмент. Пациент выдыхает.", "Cut", "Всё. Зуб чистый. Больно было?", "Врач: «Всё. Зуб чистый. Больно было?» Пациент: «Нет...»"),
            ("9", "17–22с", "Пациент смотрит в камеру растерянно. Врач улыбается.", "Крупный план", "Напиши в комментарии какое слово тебя пугало", "—"),
        ],
        "instr": [
            ("Формат", "Статичный кадр с пациентом + стикеры-картинки поверх видео"),
            ("Стикеры", "Emoji или GIF на каждый термин — смешные, абсурдные ассоциации"),
            ("Субтитры", "Слово-за-словом, крупный белый шрифт на чёрном фоне (как в референсе)"),
            ("Темп", "Один термин = 2 секунды. Нарастание напряжения через мимику пациента"),
            ("Финал", "Разрядка: врач спокойно завершает — контраст с ужасом пациента"),
            ("CTA в видео", "«Напиши в комменты слово которое тебя пугало» — буст комментариев"),
        ],
        "music_track": "Нет музыки — только речь и эффекты (как в референсе DXbG8x0DbsK)",
        "music_why": "Оригинал работал без музыки: пауза + нарастающая речь создаёт напряжение лучше трека.",
        "music_alt": "Если нужен фон — очень тихий lo-fi без мелодии, почти неслышимый",
        "caption": """Вот что происходит в голове у пациента, когда врач открывает рот 😅

А потом — «Всё, зуб готов. Больно было?»

Напишите в комментарии: какое стоматологическое слово вас пугало больше всего?

Запись: директ или по телефону
📞 +7(843)590-10-00 (Адоратского 4)
📞 +7(843)564-14-14 (Восстания 42)""",
        "hashtags": """#стоматологказань #страхстоматолога
#стоматологияюмор #зубы
#энже #стоматолог""",
        "pub_time": "Вт или Пт, 18:00–21:00",
        "pub_cover": "Крупный план лица пациента с ужасом или абсурдная картинка",
    },

    # ─────────────────────────────────────────────────────────────────────────────
    # #20 — Паттерн DYOyd5OSu7K: ситком-закулисье, персонажи, конфессиональные интервью
    # ─────────────────────────────────────────────────────────────────────────────
    {
        "n": 20,
        "date": "05.08.2026",
        "title": "Лучшая женская роль в ЭНЖЕ",
        "type": "Закулисный ситком",
        "seg": "Все сегменты",
        "dur": "50–70 сек",
        "analog": "@kosmetolog.almaty",
        "analog_views": "129 000 просмотров · ×1.6 к медиане",
        "analog_url": "https://www.instagram.com/reel/DYOyd5OSu7K/",
        "ref_desc": (
            "DYOyd5OSu7K — ситком-формат: врач говорит «нет времени», потом для «своей» Жанночки "
            "вдруг находит час. Администратор в шоке. Пациентка-подруга показывает ему средний палец. "
            "Конфессиональные интервью персонажей в стиле «Офис». "
            "129K просмотров, 15K лайков — один из самых вирусных форматов ниши."
        ),
        "concept": (
            "Мини-ситком в 3 сцены + интервью персонажей. "
            "Сцена 1: Администратор говорит пациенту «очередь, два часа ждать». "
            "Сцена 2: Пациент говорит «я три года к вам хожу» → врач выходит из кабинета и сама забирает его. "
            "Сцена 3: Другой пациент возмущается «а я уже 40 минут жду!» → врач: «Это другое». "
            "Интервью: администратор говорит в камеру про «систему приоритетов». "
            "Тональность — лёгкая ирония, не обида: клиника, где всех знают по имени."
        ),
        "hook_text": "К НАШЕМУ ДОКТОРУ ЗАПИСЬ НА ДВА МЕСЯЦА ВПЕРЁД",
        "hook_type": "Провокация / неожиданный поворот",
        "hook_vis": (
            "Администратор за стойкой. Пациент стоит перед ним. Надпись появляется крупно. "
            "Администратор говорит уверенно, пациент кивает."
        ),
        "characters": [
            "Администратор — говорит «нет мест», потом удивляется развитию событий. Конфессиональное интервью в конце.",
            "Врач — «занята», но выходит сама для пациента который «три года к нам ходит». Интервью: «Это не блат. Это наши люди.»",
            "Пациент 1 (лояльный) — три года ходит в ЭНЖЕ, врач его помнит. Выходит довольным.",
            "Пациент 2 (новый) — стоит в очереди, возмущён. Потом сам понимает как это работает.",
        ],
        "rows": [
            ("1", "0–3с", "Стойка администратора. Пациент 1 стоит, спрашивает.", "Статика", "К НАШЕМУ ДОКТОРУ ЗАПИСЬ НА ДВА МЕСЯЦА ВПЕРЁД", "Администратор: «К Наталье Ивановне? Ну... ближайшее окошко — через 6 недель.»"),
            ("2", "3–8с", "Пациент 1 говорит что-то вполголоса.", "Cut", "Он у вас три года лечится", "Пациент 1: «Я у вас три года. Наталья Ивановна меня знает.» Администратор прикрывает бумаги."),
            ("3", "8–13с", "Из кабинета выходит врач. Видит пациента — меняется в лице.", "Cut", "Сергей Александрович! Как раз иди!", "Врач: «Серёжа! Иди, я тебя сейчас возьму — у меня 15 минут есть.»"),
            ("4", "13–17с", "Пациент 1 и врач уходят в кабинет. Администратор смотрит вслед.", "Cut", "Администратор смотрит в камеру", "—"),
            ("5", "17–22с", "Пациент 2 подходит к стойке возмущённо.", "Cut", "Я 40 минут жду уже!", "Пациент 2: «Простите, а я уже сорок минут жду...» Администратор: «Это... другое.»"),
            ("6", "22–32с", "Конфессиональное интервью: администратор сидит, смотрит в камеру.", "Крупный план", "Администратор. Свидетель всего этого.", "«Система у нас простая. Все пациенты важны. Но некоторые — немного важнее. Шучу. Но не очень.»"),
            ("7", "32–45с", "Конфессиональное интервью: врач сидит, смотрит в камеру.", "Крупный план", "Наталья Ивановна. Врач. Не виновата.", "«Серёжа три года к нам ходит. Я знаю как он лечился, чего боится, что у него было. Это называется — вести пациента. Не блат. Забота.»"),
            ("8", "45–55с", "Обратно к стойке. Пациент 2 тоже записался — уходит довольный.", "Cut", "Он тоже теперь наш", "Администратор в камеру: «Через год и Пациент 2 будет получать своё окошко.»"),
        ],
        "instr": [
            ("Формат", "Ситком в стиле «Офис» — съёмка в клинике, несколько сцен + интервью"),
            ("Интервью", "Конфессиональные: персонаж сидит, смотрит прямо в камеру, говорит иронично"),
            ("Субтитры", "Белый шрифт на полупрозрачном чёрном фоне — весь диалог"),
            ("Имена", "У каждого персонажа — табличка с именем и должностью (как в референсе «Оскар»)"),
            ("Монтаж", "Смена планов на каждую реплику, крупные планы на мимику"),
            ("Тональность", "Лёгкая ирония — не жалоба на блат, а гордость: мы знаем своих пациентов"),
        ],
        "music_track": "Лёгкая позитивная фоновая — pop или chill без слов",
        "music_why": "DYOyd5OSu7K использовал ненавязчивый фон, не перебивающий диалоги. Музыка — настроение, а не центр.",
        "music_alt": "Original Audio из трендовых ситком-роликов Instagram (ищи по: «office style reels music»)",
        "caption": """Система работает просто: все пациенты важны.
Некоторые — немного важнее 😅

На самом деле — просто мы вас помним. По имени, по истории, по тому чего вы боитесь.

Три года вместе — это уже семья.

Записаться: директ или
📞 +7(843)590-10-00 (Адоратского 4)
📞 +7(843)564-14-14 (Восстания 42)""",
        "hashtags": """#стоматологказань #закулисье
#стоматология #ЭНЖЕ
#врачиказань #клиника""",
        "pub_time": "Пт или Сб, 17:00–20:00",
        "pub_cover": "Администратор смотрит в камеру с фирменным выражением",
    },

    # ─────────────────────────────────────────────────────────────────────────────
    # #21 — Паттерн DYOyd5OSu7K: второй ситком, другая ситуация
    # ─────────────────────────────────────────────────────────────────────────────
    {
        "n": 21,
        "date": "05.08.2026",
        "title": "Просто посмотреть",
        "type": "Закулисный ситком",
        "seg": "Все сегменты",
        "dur": "40–55 сек",
        "analog": "@kosmetolog.almaty",
        "analog_views": "129 000 просмотров · ×1.6 к медиане",
        "analog_url": "https://www.instagram.com/reel/DYOyd5OSu7K/",
        "ref_desc": (
            "DYOyd5OSu7K — мини-ситком с несколькими персонажами и конфессиональными интервью. "
            "Сцены короткие, диалог живой, финал неожиданный. "
            "Персонажи узнаваемы — у каждого своя роль. Субтитры весь диалог."
        ),
        "concept": (
            "Классика: пациент говорит «просто посмотреть, ничего не трогать». "
            "Администратор предупреждает врача. Через 5 минут — звук дрели из кабинета. "
            "Пациент выходит с щекой в вате: «Ну... там оказалось чуть больше чем посмотреть». "
            "Интервью врача: «Просто посмотреть — это у нас диагноз. Означает: готовьте всё оборудование». "
            "Юмор через узнаваемую ситуацию — каждый откладывал зубы до последнего."
        ),
        "hook_text": "Я ПРОСТО ХОЧУ ПОСМОТРЕТЬ. НИЧЕГО НЕ ТРОГАТЬ.",
        "hook_type": "Узнай себя / Relatable",
        "hook_vis": (
            "Пациент стоит у стойки, серьёзный, поднимает ладонь как «стоп». "
            "Администратор кивает с видом человека, который это уже слышал тысячу раз."
        ),
        "characters": [
            "Пациент — уверен что «просто посмотрит». Выходит с ватой в щеке.",
            "Администратор — знает что будет. Конфессиональное интервью: «Они все так говорят».",
            "Врач — принимает «смотреть» буквально. Интервью: «Просто посмотреть — это наш любимый диагноз».",
        ],
        "rows": [
            ("1", "0–3с", "Стойка. Пациент — серьёзный, поднимает руку.", "Статика", "Я ПРОСТО ХОЧУ ПОСМОТРЕТЬ. НИЧЕГО НЕ ТРОГАТЬ.", "Пациент: «Просто посмотреть. Вы поняли? Ничего не сверлить, не лечить. СМОТРЕТЬ.» Администратор: «Конечно, конечно.»"),
            ("2", "3–6с", "Администратор провожает пациента в кабинет. Оборачивается в камеру.", "Cut", "(оборачивается)", "—"),
            ("3", "6–12с", "Тихий коридор. Надпись «5 минут спустя». Из кабинета слышен звук дрели.", "Статика + звук", "5 минут спустя...", "Звук дрели за дверью."),
            ("4", "12–18с", "Пациент выходит из кабинета. Вата в щеке. Растерянный взгляд.", "Cut", "Там оказалось чуть больше чем посмотреть", "Пациент: «Ну... там была маленькая... ну, в общем, чуть-чуть. Просто смотрели.» Администратор смотрит в камеру."),
            ("5", "18–30с", "Конфессиональное интервью: администратор сидит, смотрит в камеру.", "Крупный план", "Администратор. Видел всё.", "«Они все приходят с этим. Просто посмотреть. Я уже не предупреждаю — просто говорю врачу: готовьте.»"),
            ("6", "30–45с", "Конфессиональное интервью: врач сидит, смотрит в камеру.", "Крупный план", "Врач. Смотрит. Просто.", "«Просто посмотреть — это у нас профессиональный диагноз. Означает: там точно что-то есть. Мы привыкли. Главное — зуб потом не болит.»"),
            ("7", "45–50с", "Пациент у выхода — щека немного опухла, но улыбается.", "Cut", "Зуб не болит. А это главное.", "—"),
        ],
        "instr": [
            ("Формат", "Ситком-закулисье: живые сцены + конфессиональные интервью"),
            ("Звук", "Звук дрели за дверью — ключевой момент. Можно смонтировать или снять реально"),
            ("Пациент", "Можно снять с реальным пациентом (с согласия) или с сотрудником в роли"),
            ("Субтитры", "Весь диалог — белый шрифт на тёмном фоне, как в оригинале"),
            ("Таблички", "Имя и должность у каждого персонажа при интервью (как «Администратор. Видел всё.»)"),
            ("CTA", "Вопрос в подписи: «Ты тоже приходил просто посмотреть?» — буст комментариев"),
        ],
        "music_track": "Лёгкий нейтральный фон — acoustic или chill pop без слов",
        "music_why": "Фон не должен перебивать диалог. Такой же подход как в DYOyd5OSu7K — музыка на втором плане.",
        "music_alt": "Тихий lo-fi pop, популярный в ситком-роликах Instagram",
        "caption": """«Просто посмотреть» — самый популярный диагноз у наших пациентов 😅

Спойлер: просто посмотреть не бывает.

А вы когда-нибудь приходили «просто посмотреть»? Напишите в комментарии 👇

Запись: директ или
📞 +7(843)590-10-00 (Адоратского 4)
📞 +7(843)564-14-14 (Восстания 42)""",
        "hashtags": """#стоматологказань #стоматолог
#ЭНЖЕ #стоматология
#зубыказань #просто""",
        "pub_time": "Ср или Пн, 18:00–21:00",
        "pub_cover": "Пациент с ватой в щеке, растерянный взгляд",
    },
]


def main():
    for s in SCRIPTS:
        n = s["n"]
        folder = OUT_BASE / f"2026-08-05-reels-{n}"
        folder.mkdir(parents=True, exist_ok=True)

        (folder / "script.md").write_text(md(s), encoding="utf-8")
        (folder / "scenario.html").write_text(html(s), encoding="utf-8")
        print(f"[✓] #{n} — {s['title']} → {folder}")


if __name__ == "__main__":
    main()
