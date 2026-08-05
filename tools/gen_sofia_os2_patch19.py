#!/usr/bin/env python3
"""Patch #19 — замена терминов на знакомые слова (ОС Софии). v2."""

import base64, sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
OUT = ROOT / "projects/Sofia/posts/drafts/2026-08-05-reels-19"

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
.os-badge{{background:#FFF3E0;border:1px solid #FFD0A0;border-radius:var(--r-pill);
  display:inline-block;font-size:10px;font-weight:700;color:#E65100;
  padding:3px 10px;margin-bottom:12px}}
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
.badge-v2{{background:var(--accent);color:#fff}}
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
.word-highlight{{font-weight:800;color:var(--accent);font-size:13px}}
.instr-grid{{display:grid;grid-template-columns:1fr 1fr;gap:10px;
  page-break-inside:avoid;break-inside:avoid}}
.instr-card{{background:var(--bg-alt);border:1px solid var(--border);
  border-radius:var(--r-sm);padding:10px 12px}}
.instr-card .key{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.08em;color:var(--muted);margin-bottom:3px}}
.instr-card .val{{font-size:12px}}
.music-block{{background:var(--bg-alt);border:1px solid var(--border);
  border-radius:var(--r);padding:14px 16px;margin-bottom:14px}}
.music-block .track{{font-size:15px;font-weight:800}}
.music-block .why{{font-size:11.5px;color:var(--muted);margin-top:6px}}
.music-block .alt{{font-size:11px;margin-top:8px;color:var(--muted)}}
.two-col{{display:grid;grid-template-columns:3fr 2fr;gap:12px}}
.caption-block,.hash-block{{background:var(--bg-alt);border:1px solid var(--border);
  border-radius:var(--r-sm);padding:12px 14px}}
.caption-block pre,.hash-block pre{{font-family:inherit;font-size:11.5px;
  white-space:pre-wrap;word-break:break-word}}
.publish-grid{{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px}}
.pub-card{{background:#FFF3E0;border:1px solid #FFD0A0;
  border-radius:var(--r-sm);padding:10px 12px}}
.pub-card .key{{font-size:10px;font-weight:700;color:var(--accent-orange);
  text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}}
.footer{{border-top:1px solid var(--border);margin-top:20px;padding-top:10px;
  display:flex;justify-content:space-between;font-size:10px;color:var(--muted)}}
</style>"""

ROWS = [
    ("1", "0–1с",
     "Пациент в кресле стоматолога. Лёгкое напряжение, смотрит на врача.",
     "Статика",
     "ВАМ НУЖНО...",
     "Врач: «Вам нужно...»"),
    ("2", "1–3с",
     "Врач говорит. Стикер на экране: 🗑️ корзина Windows с надписью «Удалить навсегда».",
     "Cut",
     "УДАЛЕНИЕ",
     "«...удаление...»"),
    ("3", "3–5с",
     "Пациент слегка нахмурился. Стикер: 🔨 перфоратор / строительная дрель.",
     "Cut",
     "БОРМАШИНА",
     "«...бормашина...»"),
    ("4", "5–7с",
     "Пациент напрягся. Стикер: ⚡ мультяшный нерв (провод под напряжением, искры).",
     "Cut",
     "НЕРВ",
     "«...нерв...»"),
    ("5", "7–9с",
     "Пациент в лёгком ужасе. Стикер: 📺 пульт от телевизора / переключение каналов.",
     "Cut",
     "КАНАЛЫ",
     "«...каналы...»"),
    ("6", "9–11с",
     "Широко открытые глаза. Стикер: 💉 огромный мультяшный шприц как из старых мультфильмов.",
     "Cut",
     "АНЕСТЕЗИЯ",
     "«...анестезия...»"),
    ("7", "11–14с",
     "Крупный план — пациент в полном ужасе, рот приоткрыт.",
     "Zoom-in",
     "...",
     "—"),
    ("8", "14–17с",
     "Врач откладывает инструмент. Пациент выдыхает с облегчением.",
     "Cut",
     "Всё. Зуб чистый. Больно было?",
     "Врач: «Всё. Зуб чистый. Больно было?» Пациент: «Нет...»"),
    ("9", "17–22с",
     "Пациент смотрит в камеру растерянно. Врач улыбается.",
     "Крупный план",
     "Напиши какое слово пугало тебя больше всего 👇",
     "—"),
]

INSTR = [
    ("Формат", "Статичный кадр пациента + стикеры-картинки поверх — как в DXbG8x0DbsK"),
    ("Слова", "Только знакомые обоим: удаление, бормашина, нерв, каналы, анестезия — не жаргон"),
    ("Стикеры", "Для КАЖДОГО слова — своя картинка. Разные, абсурдные, не медицинские"),
    ("Субтитры", "Слово-за-словом, крупный белый шрифт на чёрном фоне"),
    ("Темп", "1 слово = ~2 сек. Мимика пациента нарастает с каждым словом"),
    ("CTA", "«Напиши какое слово пугало тебя больше всего» — комментарии"),
]

CAPTION = """Что пациент слышит, когда врач открывает рот 😅

«Удаление... бормашина... нерв... каналы... анестезия...»

А потом — «Всё, зуб чистый. Больно было? — Нет.»

Напиши в комментарии: какое из этих слов пугало тебя больше всего? 👇

Записаться: директ или
📞 +7(843)590-10-00 (Адоратского 4)
📞 +7(843)564-14-14 (Восстания 42)"""

HASHTAGS = """#стоматологказань #страхстоматолога
#стоматологияюмор #зубы
#энже #стоматолог"""

rows_html = "\n".join(
    f"<tr><td class='num'>{r[0]}</td><td class='time'>{r[1]}</td>"
    f"<td>{r[2]}</td><td>{r[3]}</td>"
    f"<td class='word-highlight'>{r[4]}</td><td>{r[5]}</td></tr>"
    for r in ROWS
)
instr_html = "\n".join(
    f"<div class='instr-card'><div class='key'>{k}</div><div class='val'>{v}</div></div>"
    for k, v in INSTR
)
cap_esc = CAPTION.replace("&","&amp;").replace("<","&lt;")

html = f"""<!doctype html>
<html lang="ru">
<head><meta charset="utf-8">
<title>Сценарий Reels #19 v2 — ЭНЖЕ | bit&amp;pix</title>
{CSS}
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="label">Сценарий Reels #19 &mdash; Sofia / ЭНЖЕ Стоматология</div>
    <h1>Слова стоматолога которые вас пугают</h1>
    <div class="sub">05.08.2026 &nbsp;|&nbsp; Юмористический / Скетч-абсурд &nbsp;|&nbsp; 20–25 сек</div>
  </div>
  <img class="logo" src="{LOGO_B64}" alt="bit&amp;pix">
</div>

<span class="os-badge">&#9998; Правка по ОС Софии — v2</span>

<div class="ref-block">
  <div class="ref-label">&#128279; Референс</div>
  <div class="ref-text">@kosmetolog.almaty — DXbG8x0DbsK (24K views). Слова говорятся одно за другим с разными абсурдными картинками. Пациент нарастающе паникует. Субтитры слово-за-словом. Без музыки.</div>
</div>

<div class="concept-block">
  <div class="concept-label">Изменение по ОС</div>
  <div class="concept-text">
    <strong>Было:</strong> медицинский жаргон (экскавация, коффердам, апикэктомия) — непонятен пациентам.<br>
    <strong>Стало:</strong> слова, которые знакомы и пациенту, и врачу: <strong>удаление → бормашина → нерв → каналы → анестезия</strong>.<br>
    Визуализация у каждого слова — своя, разная, абсурдная: 🗑️ корзина / 🔨 перфоратор / ⚡ провод / 📺 пульт / 💉 мультяшный шприц.
  </div>
</div>

<div class="badges">
  <span class="badge badge-type">Юмористический / Скетч-абсурд</span>
  <span class="badge badge-seg">Все сегменты</span>
  <span class="badge badge-dur">&#9201; 20–25 сек</span>
  <span class="badge badge-ref">@kosmetolog.almaty &middot; 24 000 просмотров</span>
  <span class="badge badge-v2">v2</span>
</div>

<div class="hook-block">
  <div class="hook-label">ХУК &mdash; первые 2 секунды</div>
  <div class="hook-text">ВАМ НУЖНО...</div>
  <div class="hook-type">Тип: Интрига / обрезанное начало — как в DXbG8x0DbsK</div>
  <div class="hook-vis">Пациент в кресле, лёгкое напряжение. Врач говорит «Вам нужно...» — текст появляется крупно по одному слову на чёрном фоне.</div>
</div>

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
  <div class="track">&#127925; Без музыки — только речь и эффекты</div>
  <div class="why">Оригинал DXbG8x0DbsK работал без музыки: нарастающая речь + тишина создают напряжение лучше любого трека.</div>
  <div class="alt">Альтернатива: очень тихий lo-fi без мелодии, почти неслышимый</div>
</div>

<div class="section-title">Подпись и хэштеги</div>
<div class="two-col">
  <div class="caption-block"><pre>{cap_esc}</pre></div>
  <div class="hash-block"><pre>{HASHTAGS}</pre></div>
</div>

<div class="section-title">Публикация</div>
<div class="publish-grid">
  <div class="pub-card"><div class="key">Время</div>Вт или Пт, 18:00–21:00</div>
  <div class="pub-card"><div class="key">Обложка</div>Крупный план лица пациента в ужасе или стикер с перфоратором</div>
  <div class="pub-card"><div class="key">Геометка</div>ЭНЖЕ Стоматология, Казань</div>
</div>

<div class="footer">
  <span>ЭНЖЕ Стоматология (Sofia) &nbsp;&middot;&nbsp; Сценарий Reels #19 v2 &nbsp;&middot;&nbsp; 05.08.2026</span>
  <span>bit&amp;pix агент</span>
</div>

</body>
</html>"""

md = f"""# Сценарий Reels #19 — Sofia / ЭНЖЕ Стоматология
Дата: 05.08.2026
Тип: Юмористический / Скетч-абсурд
Тема: Слова стоматолога которые вас пугают
Аналог: @kosmetolog.almaty — 24 000 просмотров | https://www.instagram.com/reel/DXbG8x0DbsK/

---

## Правка по ОС Софии (v2)
**Было:** медицинский жаргон (экскавация, коффердам, апикэктомия) — пациентам непонятен.
**Стало:** слова знакомые обоим — удаление, бормашина, нерв, каналы, анестезия.
Визуализация для каждого слова — своя, разная: 🗑️ корзина / 🔨 перфоратор / ⚡ провод / 📺 пульт / 💉 мультяшный шприц.

## Идея
Врач перечисляет знакомые всем слова — они звучат страшно, и картинки показывают что пациент представляет при каждом. У каждого слова СВОЯ абсурдная картинка. Нарастающий ужас → финал: «Зуб чистый. Больно было? — Нет». Юмор через узнавание.

## Хронометраж: 20–25 сек

---

## ХУК — первые 2 секунды
**Тип:** Интрига / обрезанное начало
**Текст на экране:** «ВАМ НУЖНО...»
**Визуал:** Пациент в кресле, лёгкое напряжение. Врач: «Вам нужно...» — текст слово-за-словом на чёрном фоне.

---

## Раскадровка

| # | Время | Что снять | Монтаж | Текст на экране | Озвучка |
|---|-------|-----------|--------|-----------------|---------|
| 1 | 0–1с | Пациент в кресле стоматолога. Лёгкое напряжение. | Статика | ВАМ НУЖНО... | Врач: «Вам нужно...» |
| 2 | 1–3с | Стикер: 🗑️ корзина Windows «Удалить навсегда». Пациент нахмурился. | Cut | УДАЛЕНИЕ | «...удаление...» |
| 3 | 3–5с | Стикер: 🔨 строительный перфоратор / дрель. Пациент напрягся. | Cut | БОРМАШИНА | «...бормашина...» |
| 4 | 5–7с | Стикер: ⚡ мультяшный провод под напряжением, искры. | Cut | НЕРВ | «...нерв...» |
| 5 | 7–9с | Стикер: 📺 пульт от телевизора, переключает каналы. | Cut | КАНАЛЫ | «...каналы...» |
| 6 | 9–11с | Стикер: 💉 огромный мультяшный шприц как в старых мультиках. Глаза широко. | Cut | АНЕСТЕЗИЯ | «...анестезия...» |
| 7 | 11–14с | Крупный план — пациент в полном ужасе, рот приоткрыт. | Zoom-in | ... | — |
| 8 | 14–17с | Врач откладывает инструмент. Пациент выдыхает. | Cut | Всё. Зуб чистый. Больно было? | Врач: «Всё. Зуб чистый. Больно было?» Пациент: «Нет...» |
| 9 | 17–22с | Пациент растерянно смотрит в камеру. Врач улыбается. | Крупный план | Напиши какое слово пугало тебя больше всего 👇 | — |

---

## Инструкции по съёмке

- **Формат:** Статичный кадр пациента + стикеры поверх — как в DXbG8x0DbsK
- **Слова:** Только знакомые обоим: удаление, бормашина, нерв, каналы, анестезия — не жаргон
- **Стикеры:** Для КАЖДОГО слова — своя картинка. Разные, абсурдные, не медицинские
- **Субтитры:** Слово-за-словом, крупный белый шрифт на чёрном фоне
- **Темп:** 1 слово = ~2 сек. Мимика пациента нарастает с каждым словом
- **CTA:** «Напиши какое слово пугало тебя больше всего» — буст комментариев

---

## Музыка

**Трек:** Без музыки — только речь и эффекты
**Почему:** DXbG8x0DbsK работал без музыки — тишина + нарастающая речь создают напряжение лучше трека.
**Альтернатива:** Очень тихий lo-fi без мелодии, почти неслышимый

---

## Подпись

```
{CAPTION}
```

## Хэштеги

```
{HASHTAGS}
```

---

## Публикация

- **Время:** Вт или Пт, 18:00–21:00
- **Обложка:** Крупный план лица пациента в ужасе или стикер с перфоратором
- **Геометка:** ЭНЖЕ Стоматология, Казань
"""

(OUT / "script.md").write_text(md, encoding="utf-8")
(OUT / "scenario.html").write_text(html, encoding="utf-8")
print(f"[v2] #19 updated → {OUT}")
