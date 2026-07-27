#!/usr/bin/env python3
"""Генерирует scenario.html для 5 сценариев Reels — NOVYE_LYUDI"""
import base64, os, pathlib

ROOT = pathlib.Path(__file__).parent.parent
DRAFTS = ROOT / "projects/NOVYE_LYUDI/posts/drafts"

with open(ROOT / "global/brand/logo.png", "rb") as f:
    LOGO_B64 = base64.b64encode(f.read()).decode()
LOGO_SRC = f"data:image/png;base64,{LOGO_B64}"

CSS = f"""
<style>
@font-face {{
  font-family: 'Nata Sans';
  src: url('{ROOT}/global/brand/NataSans-VariableFont_wght.ttf') format('truetype');
  font-weight: 100 900;
}}
*, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
@page {{ size: A4; margin: 18mm 16mm; }}
body {{
  font-family: 'Nata Sans', -apple-system, sans-serif;
  background: #FEFEFF;
  color: #0B0B0B;
  font-size: 13px;
  line-height: 1.55;
}}
:root {{
  --bg: #FEFEFF; --bg-alt: #F6FAFC; --text: #0B0B0B;
  --accent: #FF1E1E; --accent-orange: #FF6B00;
  --border: rgba(11,11,11,0.09); --muted: rgba(11,11,11,0.42);
  --r: 10px; --r-sm: 5px; --r-pill: 20px;
}}

/* HEADER */
.header {{ display:flex; justify-content:space-between; align-items:center;
  border-bottom: 2px solid var(--accent); padding-bottom: 14px; margin-bottom: 18px; }}
.header-left .label {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.12em; color: var(--muted); margin-bottom:4px; }}
.header-left h1 {{ font-size:22px; font-weight:800; line-height:1.2; }}
.header-left .sub {{ font-size:11px; color: var(--muted); margin-top:4px; }}
.logo {{ height:40px; }}

/* BADGES */
.badges {{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }}
.badge {{ display:inline-block; padding:4px 12px; border-radius:var(--r-pill);
  font-size:11px; font-weight:700; }}
.badge-type {{ background: #0B0B0B; color:#fff; }}
.badge-dur {{ background: var(--bg-alt); border:1px solid var(--border); color:var(--text); }}
.badge-viral {{ background: #FFF3E0; color: var(--accent-orange); border:1px solid #FFD0A0; }}

/* HOOK BLOCK */
.hook-block {{ background: #FFF5F5; border:2px solid var(--accent);
  border-radius: var(--r); padding:16px 18px; margin-bottom:16px;
  page-break-inside: avoid; break-inside: avoid; }}
.hook-block .hook-label {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.1em; color:var(--accent); margin-bottom:8px; }}
.hook-block .hook-text {{ font-size:16px; font-weight:800; line-height:1.3; }}
.hook-block .hook-type {{ font-size:11px; color:var(--muted); margin-top:6px; }}

/* SECTION HEADERS */
.section-title {{ font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.1em; color:var(--muted); margin: 18px 0 8px; }}

/* STORYBOARD TABLE */
.storyboard {{ width:100%; border-collapse:collapse; font-size:11.5px;
  page-break-inside: avoid; break-inside: avoid; }}
.storyboard th {{ background: #0B0B0B; color:#fff; font-weight:700;
  padding:7px 8px; text-align:left; font-size:10.5px; }}
.storyboard td {{ border-bottom:1px solid var(--border);
  padding:7px 8px; vertical-align:top; }}
.storyboard tr:nth-child(even) td {{ background: var(--bg-alt); }}
.num {{ font-weight:800; color:var(--accent); width:24px; }}
.time {{ white-space:nowrap; color:var(--muted); font-weight:700; width:46px; }}

/* INSTRUCTIONS GRID */
.instr-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:10px;
  page-break-inside: avoid; break-inside: avoid; }}
.instr-card {{ background: var(--bg-alt); border:1px solid var(--border);
  border-radius: var(--r-sm); padding:10px 12px; }}
.instr-card .key {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.08em; color:var(--muted); margin-bottom:3px; }}
.instr-card .val {{ font-size:12px; }}

/* MUSIC */
.music-block {{ background: var(--bg-alt); border:1px solid var(--border);
  border-radius:var(--r); padding:14px 16px; margin-bottom:14px;
  page-break-inside: avoid; break-inside: avoid; }}
.music-block .track {{ font-size:15px; font-weight:800; }}
.music-block a {{ color: var(--accent-orange); text-decoration:none; }}
.music-block .why {{ font-size:11.5px; color:var(--muted); margin-top:6px; }}
.music-block .alt {{ font-size:11px; margin-top:8px; color:var(--muted); }}

/* CAPTION + HASHTAGS */
.two-col {{ display:grid; grid-template-columns:3fr 2fr; gap:12px;
  page-break-inside: avoid; break-inside: avoid; }}
.caption-block, .hash-block {{ background: var(--bg-alt); border:1px solid var(--border);
  border-radius:var(--r-sm); padding:12px 14px; }}
.caption-block pre, .hash-block pre {{
  font-family: inherit; font-size:11.5px; white-space:pre-wrap; word-break:break-word; }}

/* PUBLISH */
.publish-grid {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;
  margin-bottom:16px; page-break-inside: avoid; break-inside: avoid; }}
.pub-card {{ background:#FFF3E0; border:1px solid #FFD0A0;
  border-radius:var(--r-sm); padding:10px 12px; }}
.pub-card .key {{ font-size:10px; font-weight:700; color:var(--accent-orange);
  text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }}

/* FOOTER */
.footer {{ border-top:1px solid var(--border); margin-top:20px;
  padding-top:10px; display:flex; justify-content:space-between;
  font-size:10px; color:var(--muted); }}
</style>
"""

def page(title, sub, badge_type, badge_dur, badge_viral, hook_type, hook_text,
         storyboard_rows, instructions, music_track, music_url, music_why, music_alt,
         caption_text, hashtags_text, pub_time, pub_cover, scenario_n, date="27.07.2026"):
    rows_html = "\n".join(
        f"<tr><td class='num'>{r[0]}</td><td class='time'>{r[1]}</td>"
        f"<td>{r[2]}</td><td>{r[3]}</td><td>{r[4]}</td><td>{r[5]}</td></tr>"
        for r in storyboard_rows
    )
    instr_html = "\n".join(
        f"<div class='instr-card'><div class='key'>{k}</div><div class='val'>{v}</div></div>"
        for k, v in instructions
    )
    return f"""<!doctype html>
<html lang="ru">
<head><meta charset="utf-8"><title>Сценарий Reels #{scenario_n} — Новые люди</title>
{CSS}
</head>
<body>

<div class="header">
  <div class="header-left">
    <div class="label">Сценарий Reels #{scenario_n} &mdash; NOVYE_LYUDI</div>
    <h1>{title}</h1>
    <div class="sub">{date} &nbsp;|&nbsp; {sub}</div>
  </div>
  <img class="logo" src="{LOGO_SRC}" alt="bit&amp;pix">
</div>

<div class="badges">
  <span class="badge badge-type">{badge_type}</span>
  <span class="badge badge-dur">{badge_dur}</span>
  <span class="badge badge-viral">{badge_viral}</span>
</div>

<div class="hook-block">
  <div class="hook-label">ХУК — первые 2 секунды</div>
  <div class="hook-text">{hook_text}</div>
  <div class="hook-type">Тип: {hook_type}</div>
</div>

<div class="section-title">Раскадровка</div>
<table class="storyboard">
  <thead>
    <tr>
      <th>#</th><th>Время</th><th>Что в кадре (AI/стоковое)</th>
      <th>Монтаж</th><th>Текст на экране</th><th>Голос / субтитры</th>
    </tr>
  </thead>
  <tbody>{rows_html}</tbody>
</table>

<div class="section-title">Инструкции по генерации и монтажу</div>
<div class="instr-grid">{instr_html}</div>

<div class="section-title">Музыка</div>
<div class="music-block">
  <div class="track">{music_track}</div>
  <div class="why">{music_why}</div>
  <div class="alt">Альтернатива: {music_alt}</div>
</div>

<div class="section-title">Подпись и хэштеги</div>
<div class="two-col">
  <div class="caption-block"><pre>{caption_text}</pre></div>
  <div class="hash-block"><pre>{hashtags_text}</pre></div>
</div>

<div class="section-title">Публикация</div>
<div class="publish-grid">
  <div class="pub-card"><div class="key">Время</div>{pub_time}</div>
  <div class="pub-card"><div class="key">Обложка</div>{pub_cover}</div>
  <div class="pub-card"><div class="key">Геометка</div>—</div>
</div>

<div class="footer">
  <span>Партия «Новые люди» &nbsp;&middot;&nbsp; Сценарий Reels #{scenario_n} &nbsp;&middot;&nbsp; {date}</span>
  <span>bit&amp;pix агент</span>
</div>

</body></html>"""

# ─── СЦЕНАРИЙ 1: 450 vs 1 ────────────────────────────────────────────────────
s1 = page(
    title="«450 VS 1» — Инфо-удар",
    sub="Вирусный · 18–22 секунды · блокировки + имя",
    badge_type="Вирусный", badge_dur="18–22 сек", badge_viral="Шок · досмотр до финала",
    hook_type="Число-провокация",
    hook_text="450 депутатов. 1 голосовал против.",
    storyboard_rows=[
        ("1","0–2с","Чёрный фон → цифра 450 (белая)","резкая смена на «1» (красная)","450 депутатов. 1 голосовал против.","—"),
        ("2","2–5с","Стоковый кадр: заблокированный экран Instagram","быстрый cut","Заблокировали Instagram","—"),
        ("3","5–8с","AI-графика: замок на сети VPN","cut","Запретили VPN","—"),
        ("4","8–11с","Уведомление «доступ запрещён»","cut","Замедлили YouTube","—"),
        ("5","11–14с","AI-инфографика: шкала штрафов растёт","cut","Подняли штрафы за «дискредитацию»","—"),
        ("6","14–17с","Чёрный фон","cut резкий","Каждый раз — 450 «за»","—"),
        ("7","17–22с","Оранжевая вспышка → лого «Новые люди»","замедление","Один из 450 говорил: нет.<br>Владимир Даванков. Новые люди.","—"),
    ],
    instructions=[
        ("Темп", "1 факт = 3 секунды, без пауз, ритм phonk/drum"),
        ("Цвет", "ч/б с красным → финал оранжевый (цвет партии #FF6B00)"),
        ("Шрифт", "Bold Sans, UPPER CASE, центр экрана"),
        ("Источники кадров", "Pexels / Unsplash (телефоны, экраны) + AI-инфографика"),
        ("AI-генерация", "fal.ai / Midjourney: замок на сети, инфографика"),
        ("CTA в видео", "Последний кадр: «Найди своего депутата» 3 сек"),
    ],
    music_track="Kreepa — «Oh No» (instrumental)",
    music_url="https://open.spotify.com/track/3bidbhpOYeV4knp8AIu8Xz",
    music_why="Вирусный звук TikTok с эффектом «что-то пошло не так» — идеально под нарастающий список. Использован в 100 000+ Reels.",
    music_alt="100 gecs — «Money Machine» (более агрессивно)",
    caption_text="Ты знал, что всё это принимали единогласно?",
    hashtags_text="#новыелюди\n#даванков\n#госдума\n#свободныйинтернет\n#блокировки\n#политика",
    pub_time="Будний, 18:00–21:00 МСК",
    pub_cover="Кадр «450 / 1» (контраст — читается в ленте)",
    scenario_n=1,
)

# ─── СЦЕНАРИЙ 2: А что если бы ───────────────────────────────────────────────
s2 = page(
    title="«А что если бы...» — Нейро-альтернатива",
    sub="Эстетика · 30–35 секунды · ностальгия по Instagram",
    badge_type="Эстетика", badge_dur="30–35 сек", badge_viral="Ностальгия · сохранения",
    hook_type="«А что если...»",
    hook_text="Представь, что в 2022 не заблокировали Instagram.",
    storyboard_rows=[
        ("1","0–3с","Нейро-кадр: девушка снимает Reels, Москва, лето (тёплое боке)","появление","Представь, что в 2022 не заблокировали Instagram.","—"),
        ("2","3–8с","Нейро: малый бизнес — кофейня, хозяйка снимает товар","мягкий переход","Малый бизнес продолжал расти там, где его знали.","—"),
        ("3","8–13с","Нейро: молодые IT-специалисты, светлый офис","fade","IT-компании не уезжали туда, где был интернет.","—"),
        ("4","13–18с","Нейро: художник публикует работу, растут подписки","cut","Творческие люди оставались здесь.","—"),
        ("5","18–23с","Экран гаснет → серый → иконка «заблокировано»","резкий контраст","Но это случилось.","—"),
        ("6","23–28с","Тёплый нейро-кадр снова","возврат к цвету","Другое решение — возможно.","—"),
        ("7","28–33с","Логотип «Новые люди», оранжевый фон","тихий fade","Новые люди. За свободный интернет.","—"),
    ],
    instructions=[
        ("Стиль AI", "Реалистичный, тёплый, кинематографичный (не мультяшный)"),
        ("Промпт-база", "cinematic still, warm tones, Moscow street, young people, 9:16"),
        ("Переходы", "Кросс-фейд 0.3 сек, без резких cut (кроме «это случилось»)"),
        ("Цветокоррекция", "Тёплая → холодная серая (блокировка) → снова тёплая"),
        ("Текст", "Строчные буквы, нижняя треть, белый с тенью"),
        ("CTA в видео", "«Сохрани, если помнишь» — последний кадр"),
    ],
    music_track="Izzamuzzic — «Between the Shores»",
    music_url="https://open.spotify.com/track/3v6SKaS6s3UKbBKDCSTRwO",
    music_why="Инструментал с нарастанием, кинематографичный, широко используется в ностальгических монтажах.",
    music_alt="Ludovico Einaudi — «Experience» (классика ностальгии)",
    caption_text="В марте 2022 в России заблокировали Instagram.\nВместе с ним — 500 000 малых бизнесов\nпотеряли свою аудиторию.\n\nЭто было решением. Как и любое другое —\nего можно было принять иначе.",
    hashtags_text="#новыелюди\n#instagram\n#блокировки\n#свободныйинтернет\n#альтернатива",
    pub_time="Выходной, 12:00–14:00 МСК",
    pub_cover="Первый нейро-кадр (девушка с телефоном)",
    scenario_n=2,
)

# ─── СЦЕНАРИЙ 3: Читаем законопроект ─────────────────────────────────────────
s3 = page(
    title="«Читаем законопроект» — Скетч",
    sub="Relatable · 25–30 секунд · абсурд реального текста ст. 20.3.3 КоАП",
    badge_type="Relatable", badge_dur="25–30 сек", badge_viral="Юмор · репосты",
    hook_type="Узнай себя / абсурд",
    hook_text="Так, что там в новом законопроекте...",
    storyboard_rows=[
        ("1","0–2с","AI-персонаж #1 открывает документ «Статья 20.3.3 КоАП»","статика","Так, что там в новом законопроекте...","—"),
        ("2","2–8с","Персонаж #1 читает, поднимает бровь","крупный план","—","«Публичные действия, направленные на дискредитацию использования Вооружённых Сил...»"),
        ("3","8–12с","Персонаж #2 смотрит в экран","реакция","—","«Подождите. Это значит — нельзя репостнуть мем?»"),
        ("4","12–16с","Персонаж #1 листает дальше, хуже","cringe-гримаса","—","«...штраф гражданам от 30 000 до 50 000 рублей или...»"),
        ("5","16–20с","Персонаж #2 смеётся, потом серьёзнеет","microcut","—","«Стоп. Это не шутка?»"),
        ("6","20–24с","Оба смотрят в камеру. Пауза.","статика","«Принят. 450–0.»","—"),
        ("7","24–28с","Затемнение. Текст.","fade","Кто-то мог сказать нет.<br>Новые люди — говорят.","—"),
    ],
    instructions=[
        ("Персонажи", "2 AI-персонажа без реальных прототипов, 20–27 лет, Pixar-like или полуреализм"),
        ("Голос", "Нейро-TTS (ElevenLabs): два голоса, один чуть выше (удивление), другой сухой"),
        ("Текст закона", "Реальный текст — sozd.duma.gov.ru / consultant.ru (не придумывать цитаты!)"),
        ("Инструмент", "HeyGen AI + Adobe Express или D-ID для lip-sync"),
        ("CTA в видео", "«Сохрани» — мелким текстом в финальном кадре"),
        ("Важно", "Выбрать реальный законопроект → редактор вставляет конкретный текст"),
    ],
    music_track="Monkeys Spinning Monkeys — Kevin MacLeod",
    music_url="https://incompetech.com/music/royalty-free/index.html?isrc=USUAN1100256",
    music_why="Ироничный лёгкий инструментал, CC0 — никаких авторских прав. Идеально для абсурдного скетча.",
    music_alt="«Giorno's Theme» instrumental (мем-формат, максимальная виральность)",
    caption_text="Читаешь законопроекты? Нет? Вот зря.\n\nСтатья 20.3.3 КоАП:\nштраф 30 000–50 000 ₽ за «публичные\nдействия, направленные на дискредитацию...»\n\nКонкретный законопроект — в комментах 👇",
    hashtags_text="#законопроект\n#госдума\n#новыелюди\n#политика\n#мем\n#коап",
    pub_time="Будний, 12:00–14:00 МСК (обед)",
    pub_cover="Гримаса персонажа #1 (эмоция = клик)",
    scenario_n=3,
)

# ─── СЦЕНАРИЙ 4: Открытое письмо ─────────────────────────────────────────────
s4 = page(
    title="«Открытое письмо» — Монолог",
    sub="Мотивация · 35–40 секунд · IT-специалисты + цензура",
    badge_type="Мотивация", badge_dur="35–40 сек", badge_viral="Идентификация · «отправь другу»",
    hook_type="Провокация-обращение",
    hook_text="Открытое письмо людям, которые за нас всё решают.",
    storyboard_rows=[
        ("1","0–2с","AI-персонаж: крупный план лица, прямо в камеру, тёмный фон","статика","Открытое письмо людям, которые за нас всё решают.","—"),
        ("2","2–8с","Тот же кадр / небольшое движение","—","—","«Вы заблокировали Instagram. Потом LinkedIn. Потом VPN. Потом начали блокировать друг друга.»"),
        ("3","8–14с","Слегка иной ракурс","soft cut","—","«За это время из России уехало больше 100 000 IT-специалистов.»"),
        ("4","14–20с","Айпад на столе, пустой стул → снова лицо","cut","—","«Они не хотели уезжать. Они просто хотели работать без ограничений.»"),
        ("5","20–26с","Крупный план: взгляд прямо в камеру","статика","—","«Вы называете это безопасностью. Мы называем это потерей страны.»"),
        ("6","26–32с","Тот же кадр. Пауза.","—","—","«Но есть те, кто в Думе с нами не согласен.»"),
        ("7","32–38с","Чёрный фон, лого «Новые люди»","fade","Новые люди. Слышат.","—"),
    ],
    instructions=[
        ("Персонаж", "Нейро-реалист, мужчина 25–28 лет, обычная внешность, тёмная одежда"),
        ("Фон", "Тёмный нейтральный, лёгкое боке — не отвлекает"),
        ("Голос", "Нейро-TTS мужской, спокойный — без перепадов: сила в сдержанности"),
        ("Субтитры", "Авто поверх видео, белый Bold, нижняя треть"),
        ("Инструмент", "fal.ai + HeyGen lip-sync"),
        ("CTA в видео", "«Сохрани и отправь тому, кто говорит: один голос ничего не решает»"),
    ],
    music_track="Без музыки (или тихий ambient)",
    music_url="https://open.spotify.com/track/2pVfCX4s7f1dXFVUUoYCr7",
    music_why="Монолог работает в тишине — тишина = вес слов. Музыка перебивает и снижает доверие к говорящему.",
    music_alt="Jon Hopkins — «Immunity» (ambient, под слова не давит)",
    caption_text="С 2022 года из России уехало\nоколо 100 000 IT-специалистов.\n\nЭто не цифра. Это люди.",
    hashtags_text="#новыелюди\n#политика\n#itспециалисты\n#блокировки\n#открытоеписьмо",
    pub_time="Будний вечер, 20:00–22:00 МСК",
    pub_cover="Крупный план лица (взгляд в камеру — макс. CTR)",
    scenario_n=4,
)

# ─── СЦЕНАРИЙ 5: Дело №X ─────────────────────────────────────────────────────
s5 = page(
    title="«Дело №X» — Расследование",
    sub="Образовательный · 40–50 секунд · история блокировки 14.03.2022",
    badge_type="Образовательный", badge_dur="40–50 сек", badge_viral="«Я не знал» · факты",
    hook_type="Факт-провокация",
    hook_text="14 марта 2022. Россия заблокировала Instagram. Вот что об этом не говорят.",
    storyboard_rows=[
        ("1","0–3с","Чёрный фон, белый шрифт (документальное кино)","—","14 марта 2022. Россия заблокировала Instagram.","—"),
        ("2","3–8с","Скриншот/архив: заголовки СМИ той даты","cut","Вот что об этом не говорят.","«Роскомнадзор заблокировал Instagram за 48 часов. Без суда. Без обсуждения.»"),
        ("3","8–14с","AI-инфографика: 80 млн пользователей → 0","нарастание","—","«В России было 80 миллионов пользователей. Малый бизнес строил продажи там годами.»"),
        ("4","14–20с","Архив/стоковое: закрытые вывески, «мы переехали в TG»","—","—","«Потери от блокировок интернета в 2022 — $21,6 млрд. По оценке РБК Тренды.»"),
        ("5","20–28с","AI-инфографика: таймлайн голосований ГД 2019–2022","—","«За» — 448. «Против» — 2.","«Дума голосовала единогласно. Почти.»"),
        ("6","28–35с","Стилизованная инфографика протокола: одна строка «против»","slow zoom","В протоколе — одна строка «против».","«Кто-то попросил объяснить — зачем. В ответ — тишина.»"),
        ("7","35–43с","Оранжевый фон. Лого «Новые люди».","fade","Новые люди. Против цензуры — с 2020 года.","—"),
        ("8","43–48с","Текст на тёмном фоне","статика","Проверь сам: sozd.duma.gov.ru","—"),
    ],
    instructions=[
        ("Архивные кадры", "YouTube по дате, стоковые скриншоты СМИ (не живые лица)"),
        ("Данные", "Проверить перед выпуском: Mediascope, РБК Тренды, Роскомнадзор"),
        ("Голос", "Нейро-TTS нейтральный, документальный — только факты без эмоций"),
        ("Темп", "5–7 сек на факт (документальное расследование — не быстро)"),
        ("Шрифт", "Courier New или моноширинный (документальная эстетика)"),
        ("Важно по протоколу", "Не делать реалистичный фейк документа — стилизованная инфографика"),
    ],
    music_track="Hans Zimmer — «Time» (Inception OST)",
    music_url="https://open.spotify.com/track/6ZFbXIJkuI1dVNWvzJzown",
    music_why="Нарастающий, документальный, 0 слов. Мгновенная ассоциация с серьёзным контентом. Использован в тысячах расследовательских видео.",
    music_alt="Clint Mansell — «Lux Aeterna» (более тревожная)",
    caption_text="В марте 2022 за 48 часов заблокировали\nплощадку, на которой малый бизнес\nзарабатывал годами.\n\nБез суда. Без компенсации. Без объяснений.\n\nПолный протокол: sozd.duma.gov.ru",
    hashtags_text="#госдума\n#instagram\n#блокировки\n#новыелюди\n#политика\n#расследование",
    pub_time="Будний вечер, 19:00–21:00 МСК",
    pub_cover="Инфографика «80 000 000 → 0» (цифра = клик)",
    scenario_n=5,
)

for n, content in [(1,s1),(2,s2),(3,s3),(4,s4),(5,s5)]:
    out = DRAFTS / f"2026-07-27-reels-{n}" / "scenario.html"
    out.write_text(content, encoding="utf-8")
    print(f"✓ scenario {n}: {out}")

print("Done.")
