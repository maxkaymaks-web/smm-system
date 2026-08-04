#!/usr/bin/env python3
"""Generate scenario.html for promo scripts #16, #17, #18 (Sofia/ЭНЖЕ)."""

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
.promo-block{{background:#FFF3E0;border-left:3px solid var(--accent-orange);
  border-radius:0 var(--r-sm) var(--r-sm) 0;padding:12px 14px;margin-bottom:14px}}
.promo-label{{font-size:10px;font-weight:700;text-transform:uppercase;
  letter-spacing:.1em;color:var(--accent-orange);margin-bottom:4px}}
.promo-price{{font-size:22px;font-weight:800;color:var(--accent-orange)}}
.promo-text{{font-size:12px;margin-top:4px}}
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
.badge-promo{{background:var(--accent-orange);color:#fff}}
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
    <div class="sub">04.08.2026 &nbsp;|&nbsp; {s['type']} &nbsp;|&nbsp; {s['dur']}</div>
  </div>
  <img class="logo" src="{LOGO_B64}" alt="bit&amp;pix">
</div>

<div class="promo-block">
  <div class="promo-label">&#127881; Акция (одобрена Софией 04.08.2026)</div>
  <div class="promo-price">{s['promo_price']}</div>
  <div class="promo-text">{s['promo_text']}</div>
</div>

<div class="concept-block">
  <div class="concept-label">Концепция формата</div>
  <div class="concept-text">{s['concept']}</div>
</div>

<div class="badges">
  <span class="badge badge-type">{s['type']}</span>
  <span class="badge badge-seg">{s['seg']}</span>
  <span class="badge badge-dur">&#9201; {s['dur']}</span>
  <span class="badge badge-promo">&#127881; Акция</span>
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
  <span>ЭНЖЕ Стоматология (Sofia) &nbsp;&middot;&nbsp; Сценарий Reels #{n} &nbsp;&middot;&nbsp; 04.08.2026</span>
  <span>bit&amp;pix агент</span>
</div>

</body>
</html>"""


SCRIPTS = [

{
"n": 16,
"title": "Вся правда о брекетах",
"seg": "Сегмент 2–3 — Молодёжь + взрослые",
"type": "Образовательный / Антипаттерн",
"analog": "@yourclinic.ru",
"analog_views": "72 000 просмотров · ×3.5 к медиане",
"dur": "28–35 сек",
"promo_price": "110 000 ₽",
"promo_text": "Брекеты с полной установкой — акционная цена",
"concept": "Паттерн «Вся правда о...»: честно о сложностях брекетов → потом разворот к цене акции. Зритель ждёт продажу → получает честный разговор → в конце цена как приятный сюрприз, не давление. Хук — обрезанный текст создаёт интригу.",
"hook_type": "Обрезанный хук / Антипаттерн",
"hook_text": "ВСЯ ПРАВДА О БРЕКЕТАХ",
"hook_vis": "Крупный план брекетов на зубах. Текст: «ВСЯ ПРАВДА» — пауза 0.5 сек — «О БРЕКЕТАХ». Спокойный голос стартует сразу.",
"rows": [
    ("1","0–2с","Крупный план брекетов на зубах. Нейтральный ракурс.","Zoom-in","ВСЯ ПРАВДА О БРЕКЕТАХ","—"),
    ("2","2–10с","Нейтральный кадр кабинета / врач.","Cut","Первые 2 недели — ноют. Это нормально.","«Первые две недели зубы ноют. Не что-то сломалось — так работает давление. Проходит.»"),
    ("3","10–18с","Крупный план: яблоко, орехи — перечёркнуто.","Cut","Твёрдую еду — придётся ограничить.","«Твёрдую еду ограничить. Яблоки режем, орехи убираем. Около двух лет.»"),
    ("4","18–24с","Щётка для брекетов, ёршики.","Cut","Чистить — дольше чем обычно.","«Чистка с брекетами — 5–7 минут вместо двух. Каждый день.»"),
    ("5","24–30с","Пациент улыбается после снятия — красивые ровные зубы.","Cut","Но вот что в итоге.","«Но вот что вы получаете в итоге.»"),
    ("6","30–35с","Врач смотрит в камеру. Спокойно.","Крупный план","Акция: брекеты с установкой — 110 000 ₽. Ставь + хочу подробнее.","«Сейчас акция — брекеты с полной установкой 110 000 рублей. Ставь плюс если хочешь узнать подробнее.»"),
],
"instr": [
    ("Формат", "Закадровый голос + b-roll (брекеты, еда, щётки, результат)"),
    ("Голос", "Спокойный, без давления — честный разговор, не реклама"),
    ("Монтаж", "Умеренный темп, каждый пункт — отдельный cut"),
    ("Финал", "Улыбка после снятия + цена акции — контраст сложно/красиво"),
    ("CTA в видео", "«Ставь + хочу подробнее» — буст комментариев"),
    ("Ориентация", "9:16 вертикальная"),
],
"music_track": "Спокойный нейтральный фон — lo-fi без слов",
"music_why": "Честный разговор о сложностях требует спокойного фона. Агрессивный трек разрушит тональность доверия.",
"music_alt": "Calm lo-fi из Instagram Reels Audio",
"caption": "Честно о брекетах — потому что вы заслуживаете знать всё до, а не в процессе 🦷\n\nНоют? Да, первые две недели. Ограничения? Есть.\nРезультат? Смотрите на последний кадр.\n\nАкция в ЭНЖЕ: брекеты с установкой — 110 000 ₽\n\n📞 +7(843)590-10-00 (Адоратского 4)\n📞 +7(843)564-14-14 (Восстания 42)\n💬 ДИРЕКТ",
"hashtags": "#брекеты #стоматологказань\n#ортодонт #ровныезубы\n#брекетыказань #энже",
"pub_time": "Пн или Чт, 15:00–18:00",
"pub_cover": "Улыбка после снятия брекетов — ровные зубы",
},

{
"n": 17,
"title": "5 вопросов про брекеты — отвечаю честно",
"seg": "Сегмент 2–3 — Молодёжь + взрослые",
"type": "Вирусный / Q&amp;A",
"analog": "@yourclinic.ru",
"analog_views": "137 000 просмотров · ×19 к медиане",
"dur": "25–30 сек",
"promo_price": "110 000 ₽",
"promo_text": "Брекеты с полной установкой — акционная цена",
"concept": "Тир-лист вопросов: врач отвечает на главные вопросы про брекеты одним коротким ответом. Быстро, разговорно, честно. Цена акции — финальный аргумент. Формат провоцирует комментарии «ставишь или нет?».",
"hook_type": "Число / Провокация",
"hook_text": "5 ВОПРОСОВ ПРО БРЕКЕТЫ — ОТВЕЧАЮ ЧЕСТНО",
"hook_vis": "Врач-ортодонт смотрит в камеру. Уверенно. Быстрый разговорный голос стартует сразу.",
"rows": [
    ("1","0–2с","Врач смотрит в камеру — прямо и быстро.","Статика","5 ВОПРОСОВ ПРО БРЕКЕТЫ — ОТВЕЧАЮ ЧЕСТНО","—"),
    ("2","2–7с","Врач отвечает — быстро.","Cut","Больно? — Нет. Дискомфорт — да.","«Больно? Нет. Дискомфорт первые недели — да, это нормально.»"),
    ("3","7–13с","Врач.","Cut","Долго? — Обычно 1,5–2 года.","«Долго? Чаще всего — полтора-два года. Зависит от случая.»"),
    ("4","13–18с","Врач.","Cut","Заметно? — Есть сапфировые. Почти невидимые.","«Заметно? Есть сапфировые брекеты — почти не видны.»"),
    ("5","18–23с","Врач.","Cut","Стоит ли? — Посмотрите на тех кто прошёл.","«Стоит? Посмотрите на тех, кто уже прошёл. Никто не жалеет.»"),
    ("6","23–28с","Врач. Немного торжественно.","Cut","Сколько? — Акция: 110 000 ₽ с установкой.","«Сколько стоит? Акция — брекеты с полной установкой 110 000 рублей.»"),
    ("7","28–30с","Врач смотрит в камеру.","Крупный план","Напиши в комменты: ставишь или нет?","«Напиши в комментарии — ставишь или нет?»"),
],
"instr": [
    ("Формат", "Talking head врача-ортодонта — быстрые Q&A"),
    ("Темп", "Очень быстрый — 1 вопрос/ответ = 5–6 сек. Не растягивать."),
    ("Тон", "Уверенный, немного игривый — разговорный, не рекламный"),
    ("Монтаж", "Cut на каждый вопрос, без пауз"),
    ("CTA в видео", "«Напиши в комменты: ставишь или нет?» — буст комментариев"),
    ("Ориентация", "9:16 вертикальная"),
],
"music_track": "Upbeat быстрый фон — phonk или pop, трендовый",
"music_why": "Быстрый Q&A требует энергичного темпа. Тир-лист DbQJafdOKJn (137K, ×19) работал именно с такой музыкой.",
"music_alt": "Trending phonk из Instagram Reels Audio",
"caption": "5 честных ответов про брекеты — без воды 🦷\n\nИ да, сейчас в ЭНЖЕ акция:\nБрекеты с полной установкой — 110 000 ₽\n\n📞 +7(843)590-10-00 (Адоратского 4)\n📞 +7(843)564-14-14 (Восстания 42)\n💬 ДИРЕКТ",
"hashtags": "#брекеты #ортодонт\n#стоматологказань #ровныезубы\n#брекетыказань #энже",
"pub_time": "Вт или Пт, 17:00–20:00",
"pub_cover": "Врач смотрит в камеру — уверенно, цифра 5 поверх",
},

{
"n": 18,
"title": "3 вещи которые Air Flow сделает с вашими зубами",
"seg": "Все сегменты — носящие брекеты + все",
"type": "Образовательный / 3 вещи",
"analog": "@yourclinic.ru",
"analog_views": "35 000 просмотров · ×2.2 к медиане",
"dur": "25–30 сек",
"promo_price": "4 900 ₽",
"promo_text": "Чистка Air Flow — акционная цена",
"concept": "Паттерн «3 вещи, которые...»: крупный план проблемы в хуке → 3 конкретных результата Air Flow → цена акции → CTA. Не «что такое Air Flow» — а «что сделает с ВАШИМИ зубами». Результат, а не технология.",
"hook_type": "Число + крупный план",
"hook_text": "ТРИ ВЕЩИ, КОТОРЫЕ AIR FLOW СДЕЛАЕТ С ВАШИМИ ЗУБАМИ",
"hook_vis": "Крупный план зубов с пигментацией/налётом. Хук поверх. Голос стартует сразу.",
"rows": [
    ("1","0–2с","Крупный план зубов с налётом — деликатно.","Zoom-in","ТРИ ВЕЩИ, КОТОРЫЕ AIR FLOW СДЕЛАЕТ С ВАШИМИ ЗУБАМИ","—"),
    ("2","2–10с","Гигиенист проводит процедуру Air Flow — поток воды/порошка.","Cut","1. Уберёт налёт который щётка не берёт никогда.","«Первое: уберёт налёт, который щётка не берёт никогда — от кофе, чая, курения.»"),
    ("3","10–18с","До/после — зубы до и после процедуры. Натуральный результат.","Cut","2. Эмаль приобретёт натуральный цвет — без химии.","«Второе: эмаль приобретёт свой натуральный цвет. Это не отбеливание — это уборка того, что накопилось.»"),
    ("4","18–24с","Пациент улыбается после процедуры — довольно и свежо.","Cut","3. Ощущение свежести которое вы заметите сразу.","«Третье: ощущение идеальной чистоты. Как будто зубы другие.»"),
    ("5","24–29с","Гигиенист смотрит в камеру.","Крупный план","Акция: Air Flow — 4 900 ₽. Записаться → директ","«Акция — чистка Air Flow 4 900 рублей. Записывайтесь в директ или по телефону.»"),
],
"instr": [
    ("Формат", "Закадровый голос + b-roll процедуры и результата"),
    ("Голос", "Женский, тёплый, быстрый — закадровый"),
    ("Хук-кадр", "Крупный план зубов с налётом — деликатно, не отталкивающе"),
    ("До/после", "Натуральный результат — не отбеливание, а чистота. Не завышать."),
    ("Монтаж", "Быстрые cuts, нумерация 1/2/3 крупно"),
    ("CTA в видео", "«Акция: Air Flow 4 900 ₽ → директ»"),
],
"music_track": "Upbeat light pop — быстрый и свежий",
"music_why": "DbYQ8oOM-Rs использовал энергичный фон на «3 вещи» — динамичный формат требует такого же темпа.",
"music_alt": "Fresh upbeat pop из Instagram Reels Audio",
"caption": "Air Flow — это не отбеливание. Это глубокая чистка 🦷\n\nПосле неё зубы приобретают СВОЙ натуральный цвет — тот, который скрылся под налётом от кофе и чая.\n\nАкция в ЭНЖЕ: чистка Air Flow — 4 900 ₽\n\n📞 +7(843)590-10-00 (Адоратского 4)\n📞 +7(843)564-14-14 (Восстания 42)\n💬 ДИРЕКТ",
"hashtags": "#airflow #профчистка\n#стоматологказань #гигиенаполостирта\n#чисткузубов #энже",
"pub_time": "Ср или Пт, 10:00–13:00",
"pub_cover": "Улыбка после чистки — свежая, натуральная",
},

]


def main():
    for s in SCRIPTS:
        n = s["n"]
        folder = OUT_BASE / f"2026-08-04-reels-{n}"
        folder.mkdir(parents=True, exist_ok=True)
        (folder / "scenario.html").write_text(make_html(s), encoding="utf-8")
        print(f"✓ Reels #{n}: {s['title']}")


if __name__ == "__main__":
    main()
