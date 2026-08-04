#!/usr/bin/env python3
"""Patch: regenerate scenario.html for scripts #1, #5, #15 (v2 after Sofia feedback)."""

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
.os-block{{background:#FFF3E0;border-left:3px solid var(--accent-orange);
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:12px 14px;margin-bottom:14px;
  font-size:12px}}
.os-label{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--accent-orange);margin-bottom:4px}}
.concept-block{{background:var(--bg-alt);border-left:3px solid var(--accent-orange);
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:12px 14px;margin-bottom:14px}}
.concept-label{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--accent-orange);margin-bottom:4px}}
.concept-text{{font-size:12.5px}}
.badges{{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px}}
.badge{{font-size:10.5px;font-weight:700;border-radius:var(--r-pill);padding:3px 10px}}
.badge-type{{background:#1a1a1a;color:#fff}}
.badge-seg{{background:#e8f4fd;color:#1565c0}}
.badge-dur{{background:#e8f5e9;color:#2e7d32}}
.badge-ref{{background:#fff3e0;color:#e65100;font-size:10px}}
.badge-v2{{background:#FF1E1E;color:#fff}}
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
</style>"""


def make_html(s):
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
    os_block = f"""
<div class="os-block">
  <div class="os-label">&#9888; Правка по ОС Софии</div>
  <strong>Было:</strong> {s['os_bylo']}<br>
  <strong>Стало:</strong> {s['os_stalo']}
</div>""" if "os_bylo" in s else ""

    return f"""<!doctype html>
<html lang="ru">
<head><meta charset="utf-8">
<title>Сценарий Reels #{n} v2 — ЭНЖЕ | bit&amp;pix</title>
{CSS}
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="label">Сценарий Reels #{n} &mdash; Sofia / ЭНЖЕ Стоматология</div>
    <h1>{s['title']}</h1>
    <div class="sub">04.08.2026 &nbsp;|&nbsp; {s['type']} &nbsp;|&nbsp; {s['dur']}</div>
  </div>
  <img class="logo" src="{LOGO_B64}" alt="bit&amp;pix">
</div>

{os_block}

<div class="concept-block">
  <div class="concept-label">Концепция формата</div>
  <div class="concept-text">{s['concept']}</div>
</div>

<div class="badges">
  <span class="badge badge-type">{s['type']}</span>
  <span class="badge badge-seg">{s['seg']}</span>
  <span class="badge badge-dur">&#9201; {s['dur']}</span>
  <span class="badge badge-v2">v2 &mdash; правка по ОС</span>
  <span class="badge badge-ref">Аналог: {s['analog']} &middot; {s['analog_views']}</span>
</div>

<div class="hook-block">
  <div class="hook-label">ХУК &mdash; первые 2 секунды</div>
  <div class="hook-text">{s['hook_text']}</div>
  <div class="hook-type">Тип: {s['hook_type']}</div>
  <div class="hook-vis">{s['hook_vis']}</div>
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
  <span>ЭНЖЕ Стоматология (Sofia) &nbsp;&middot;&nbsp; Сценарий Reels #{n} v2 &nbsp;&middot;&nbsp; 04.08.2026</span>
  <span>bit&amp;pix агент</span>
</div>

</body>
</html>"""


SCRIPTS_V2 = [

{
"n": 1,
"title": "Вот что я делаю перед каждым лечением ребёнка",
"seg": "Сегмент 1 — Родители",
"type": "Образовательный / Talking head врача",
"analog": "@yourclinic.ru",
"analog_views": "72 000 просмотров · ×3.5 к медиане",
"dur": "25–32 сек",
"os_bylo": "POV ребёнка с субтитрами от первого лица",
"os_stalo": "Talking head детского врача — 3 конкретных приёма убирающих страх",
"concept": "Детский стоматолог говорит прямо в камеру: «Вот что я делаю прямо перед тем как начать лечение». Три конкретных приёма — не абстрактные слова, а реальные действия. Одновременно образовательный контент для родителей и демонстрация экспертизы врача ЭНЖЕ.",
"hook_type": "Провокация-факт / Интрига",
"hook_text": "ВОТ ЧТО Я ДЕЛАЮ ПЕРЕД КАЖДЫМ ЛЕЧЕНИЕМ РЕБЁНКА",
"hook_vis": "Врач смотрит в камеру прямо, кабинет за спиной. Голос стартует сразу — без паузы.",
"rows": [
    ("1","0–2с","Врач смотрит в камеру прямо. Начинает без паузы.","Статика","ВОТ ЧТО Я ДЕЛАЮ ПЕРЕД КАЖДЫМ ЛЕЧЕНИЕМ РЕБЁНКА","—"),
    ("2","2–10с","Вставка: врач даёт ребёнку потрогать зеркало — ребёнок смотрит, улыбается.","Cut","1. Даю потрогать все инструменты. Руками.","«Первое — даю ребёнку потрогать каждый инструмент. Зеркало, слюноотсос, наконечник. Это убирает 80% страха.»"),
    ("3","10–18с","Вставка: врач на корточках разговаривает с ребёнком — смотрит ему в глаза, не маме.","Cut","2. Разговариваю с ребёнком. Не с мамой.","«Второе — разговариваю с ребёнком, а не через него. Он в кресле — значит он главный.»"),
    ("4","18–26с","Врач возвращается в кадр — говорит финальный пункт. Спокойно.","Cut","3. Объясняю что будет. До. Честно.","«Третье — объясняю что произойдёт до того как начать. Дети боятся неизвестного, не боли.»"),
    ("5","26–31с","Врач смотрит в камеру. Уверенно.","Крупный план","Сохрани — пригодится перед первым визитом","«Сохраните — пригодится перед первым визитом ребёнка.»"),
],
"instr": [
    ("Формат", "Talking head врача + вставки из кабинета"),
    ("Ракурс", "Уровень глаз, крупный план. Вставки — уровень ребёнка"),
    ("Монтаж", "Cuts на каждый пункт, умеренный темп"),
    ("Субтитры", "Нумерованные пункты 1/2/3 — крупно"),
    ("Свет", "Студийный клиники, белый халат в кадре"),
    ("CTA в видео", "«Сохрани — пригодится перед первым визитом»"),
],
"music_track": "Спокойный нейтральный фон — lo-fi или ambient",
"music_why": "Врач говорит — музыка не должна конкурировать. Тихий фон держит внимание на словах.",
"music_alt": "Calm soft из Instagram Reels Audio: «doctor advice background»",
"caption": "Три вещи которые детский стоматолог делает до того как начать лечение 🦷\n\nСохраните — пригодится перед первым визитом ребёнка.\n\nЗаписаться к нашему детскому врачу → директ 💬",
"hashtags": "#детскийстоматолог #стоматологказань\n#ребёнокустоматолога #детскаястоматология\n#советыстоматолога #энже",
"pub_time": "Вт или Чт, 10:00–12:00",
"pub_cover": "Врач смотрит в камеру — уверенно, в белом халате",
},

{
"n": 5,
"title": "Моя дочь сама просит к стоматологу",
"seg": "Сегмент 1 — Родители",
"type": "Мотивация / Talking head мамы",
"analog": "@yourclinic.ru",
"analog_views": "137 000 просмотров · ×19 к медиане",
"dur": "25–32 сек",
"os_bylo": "«Я ДУМАЛА ЭТО БУДЕТ УЖАСНО» — линейная история от страха к облегчению",
"os_stalo": "Открываем с контринтуитивным фактом: «МОЯ ДОЧЬ САМА ПРОСИТ К СТОМАТОЛОГУ». История рассказывается назад.",
"concept": "Мама говорит в камеру, открывает с самого неожиданного факта. Зритель не верит → мама объясняет что произошло → конкретный момент который изменил всё → CTA. Крючок — контринтуитивное утверждение в первые 2 секунды, не предсказуемая история.",
"hook_type": "Провокация / Контринтуитивный факт",
"hook_text": "МОЯ ДОЧЬ САМА ПРОСИТ К СТОМАТОЛОГУ",
"hook_vis": "Мама смотрит в камеру. Немного смущённая улыбка — как будто сама не верит что говорит.",
"rows": [
    ("1","0–2с","Мама смотрит в камеру. Лёгкая улыбка — немного недоумевающая.","Статика","МОЯ ДОЧЬ САМА ПРОСИТ К СТОМАТОЛОГУ","—"),
    ("2","2–8с","Мама говорит — быстро, немного удивлённо сама собой.","Cut","Она боялась. Реально боялась.","«Она боялась стоматолога. Плакала ещё в машине.»"),
    ("3","8–16с","Мама рассказывает конкретный момент — оживлённо.","Cut","Врач сказал ей: &laquo;Ты самая смелая пациентка сегодня&raquo;","«В ЭНЖЕ врач сказал ей в конце: Ты самая смелая пациентка сегодня. Всё. С этого момента она хочет обратно.»"),
    ("4","16–24с","Мама говорит финальную деталь — искренне, без пафоса.","Cut","Она коллекционирует наклейки от каждого визита","«Теперь она коллекционирует наклейки с каждого визита. Штук восемь уже.»"),
    ("5","24–30с","Мама смотрит в камеру. Прямо.","Крупный план","Ваши дети заслуживают такого же опыта → директ","«Запишите ребёнка — пишите в директ.»"),
],
"instr": [
    ("Формат", "Talking head — мама снимает себя на смартфон"),
    ("Тон", "Живой, разговорный — не читать. Лёгкая насмешка над собой"),
    ("Свет", "Естественный у окна или кольцевая лампа"),
    ("Монтаж", "Умеренный темп, cuts без пауз"),
    ("Субтитры", "Крупные снизу, ключевые фразы выделены"),
    ("CTA в видео", "Финальный кадр: «Запишите ребёнка → директ 💬»"),
],
"music_track": "Лёгкий upbeat background — воздушный, не мешает",
"music_why": "История рассказывается быстро и с лёгкостью — тяжёлая эмоциональная музыка не подходит.",
"music_alt": "Light pop acoustic из Instagram Reels Audio",
"caption": "Ребёнок который боялся — теперь коллекционирует наклейки с каждого визита 🦷\n\nПравильный первый опыт меняет всё.\n\nЗапишите ребёнка в ЭНЖЕ → директ 💬",
"hashtags": "#детскийстоматолог #стоматологказань\n#первыйвизит #детскаястоматология\n#ребёнокустоматолога #энже",
"pub_time": "Чт, 10:00–12:00",
"pub_cover": "Мама с улыбкой-удивлением, субтитр «МОЯ ДОЧЬ САМА ПРОСИТ К СТОМАТОЛОГУ»",
},

{
"n": 15,
"title": "Пришли вчетвером. Каждый к своему врачу.",
"seg": "Все сегменты — Семейный",
"type": "Социальное доказательство / B-roll + войсовер",
"analog": "@inwhite.medical",
"analog_views": "49 000 просмотров · ×9.4 к медиане",
"dur": "25–30 сек",
"os_bylo": "Три talking head (мама/папа/ребёнок) по очереди — классическая рекламная структура",
"os_stalo": "B-roll живой съёмки семьи в клинике + войсовер одной мамы. Конкретные детали вместо восторгов.",
"concept": "Семья пришла в ЭНЖЕ в один день — снято живой камерой, без постановки. Войсовер: мама говорит короткими конкретными фразами — не «очень довольны», а детали: «папа наконец пошёл сам», «дочь спрашивает когда снова», «нас помнят по именам». Детали создают правдоподобие.",
"hook_type": "Факт / Социальное доказательство",
"hook_text": "ПРИШЛИ ВЧЕТВЕРОМ. КАЖДЫЙ К СВОЕМУ ВРАЧУ.",
"hook_vis": "Широкий план: семья заходит в клинику — живая съёмка, немного со стороны. Естественное движение.",
"rows": [
    ("1","0–2с","Семья входит в клинику. Ресепшн встречает. Живая съёмка.","Широкий план","ПРИШЛИ ВЧЕТВЕРОМ. КАЖДЫЙ К СВОЕМУ ВРАЧУ.","—"),
    ("2","2–8с","Папа идёт к кабинету — немного неуверенно. Ребёнок бежит к игровой зоне.","Cut","«Папа боялся стоматолога 15 лет»","«Муж боялся стоматолога 15 лет. Сюда пошёл сам.»"),
    ("3","8–14с","Дочь в детском кабинете — врач показывает что-то, ребёнок смеётся.","Cut","«Дочь спрашивает: а когда снова?»","«Дочь спрашивает когда снова. Раньше в машине плакала.»"),
    ("4","14–20с","Администратор здоровается с мамой по имени, улыбается.","Cut","«Нас здесь помнят по именам»","«Нас помнят по именам. Не нужно каждый раз объяснять кто мы.»"),
    ("5","20–28с","Семья выходит вместе. Не улыбаются для камеры — просто идут.","Широкий + freeze","Четыре человека. Один стоматолог. Три года. → директ","«Четыре человека, один стоматолог, три года. Пишите в директ.»"),
],
"instr": [
    ("Формат", "B-roll живой съёмки + войсовер мамы (пишется отдельно)"),
    ("Ракурс", "Немного со стороны — не в лицо. Как снимает свой"),
    ("Монтаж", "Быстрые cuts. Войсовер — короткие фразы, как мысли вслух"),
    ("Тон войсовера", "Разговорный, не рекламный. Конкретные детали, не восторги"),
    ("Постановка", "Минимальная — попросить прийти, снимать как есть"),
    ("CTA в видео", "Финальный freeze + «Записаться всей семьёй → директ»"),
],
"music_track": "Тихий тёплый фон — acoustic или lo-fi. Едва слышно",
"music_why": "Войсовер главный — музыка только как атмосфера, не конкурирует.",
"music_alt": "Warm minimal background из Instagram Reels Audio",
"caption": "Четыре человека. Один стоматолог. Три года.\n\nСемейный формат — это когда вас помнят по именам и знают историю каждого зуба 🤍\n\nЗапишитесь всей семьёй → директ 💬",
"hashtags": "#семейнаястоматология #стоматологказань\n#детскийстоматолог #энже\n#лечимвсюсемью #казань",
"pub_time": "Сб, 11:00–14:00",
"pub_cover": "Семья входит в клинику — живой кадр, не постановочный",
},

]


def main():
    for s in SCRIPTS_V2:
        n = s["n"]
        folder = OUT_BASE / f"2026-08-04-reels-{n}"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "scenario.html").write_text(make_html(s), encoding="utf-8")
        print(f"✓ Reels #{n} v2: {s['title']}")
    print("Готово. Запусти html-to-pdf отдельно.")


if __name__ == "__main__":
    main()
