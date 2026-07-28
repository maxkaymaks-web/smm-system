#!/usr/bin/env python3
"""Генерирует scenario.html для 5 сценариев Reels — NOVYE_LYUDI (v2, новые концепции)"""
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
.header {{ display:flex; justify-content:space-between; align-items:center;
  border-bottom: 2px solid var(--accent); padding-bottom: 14px; margin-bottom: 18px; }}
.header-left .label {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.12em; color: var(--muted); margin-bottom:4px; }}
.header-left h1 {{ font-size:22px; font-weight:800; line-height:1.2; }}
.header-left .sub {{ font-size:11px; color: var(--muted); margin-top:4px; }}
.logo {{ height:40px; }}
.concept-block {{ background: #FFF8F0; border:1px solid #FFD0A0;
  border-radius: var(--r); padding:14px 16px; margin-bottom:16px;
  page-break-inside: avoid; break-inside: avoid; }}
.concept-block .concept-label {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.1em; color: var(--accent-orange); margin-bottom:6px; }}
.concept-block .concept-text {{ font-size:12.5px; line-height:1.6; }}
.badges {{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }}
.badge {{ display:inline-block; padding:4px 12px; border-radius:var(--r-pill);
  font-size:11px; font-weight:700; }}
.badge-type {{ background: #0B0B0B; color:#fff; }}
.badge-dur {{ background: var(--bg-alt); border:1px solid var(--border); color:var(--text); }}
.badge-viral {{ background: #FFF3E0; color: var(--accent-orange); border:1px solid #FFD0A0; }}
.hook-block {{ background: #FFF5F5; border:2px solid var(--accent);
  border-radius: var(--r); padding:16px 18px; margin-bottom:16px;
  page-break-inside: avoid; break-inside: avoid; }}
.hook-block .hook-label {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.1em; color:var(--accent); margin-bottom:8px; }}
.hook-block .hook-text {{ font-size:16px; font-weight:800; line-height:1.3; }}
.hook-block .hook-type {{ font-size:11px; color:var(--muted); margin-top:6px; }}
.section-title {{ font-size:11px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.1em; color:var(--muted); margin: 18px 0 8px; }}
.storyboard {{ width:100%; border-collapse:collapse; font-size:11.5px;
  page-break-inside: avoid; break-inside: avoid; }}
.storyboard th {{ background: #0B0B0B; color:#fff; font-weight:700;
  padding:7px 8px; text-align:left; font-size:10.5px; }}
.storyboard td {{ border-bottom:1px solid var(--border);
  padding:7px 8px; vertical-align:top; }}
.storyboard tr:nth-child(even) td {{ background: var(--bg-alt); }}
.num {{ font-weight:800; color:var(--accent); width:24px; }}
.time {{ white-space:nowrap; color:var(--muted); font-weight:700; width:46px; }}
.instr-grid {{ display:grid; grid-template-columns:1fr 1fr; gap:10px;
  page-break-inside: avoid; break-inside: avoid; }}
.instr-card {{ background: var(--bg-alt); border:1px solid var(--border);
  border-radius: var(--r-sm); padding:10px 12px; }}
.instr-card .key {{ font-size:10px; font-weight:700; text-transform:uppercase;
  letter-spacing:0.08em; color:var(--muted); margin-bottom:3px; }}
.instr-card .val {{ font-size:12px; }}
.music-block {{ background: var(--bg-alt); border:1px solid var(--border);
  border-radius:var(--r); padding:14px 16px; margin-bottom:14px;
  page-break-inside: avoid; break-inside: avoid; }}
.music-block .track {{ font-size:15px; font-weight:800; }}
.music-block .why {{ font-size:11.5px; color:var(--muted); margin-top:6px; }}
.music-block .alt {{ font-size:11px; margin-top:8px; color:var(--muted); }}
.two-col {{ display:grid; grid-template-columns:3fr 2fr; gap:12px;
  page-break-inside: avoid; break-inside: avoid; }}
.caption-block, .hash-block {{ background: var(--bg-alt); border:1px solid var(--border);
  border-radius:var(--r-sm); padding:12px 14px; }}
.caption-block pre, .hash-block pre {{
  font-family: inherit; font-size:11.5px; white-space:pre-wrap; word-break:break-word; }}
.publish-grid {{ display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px;
  margin-bottom:16px; page-break-inside: avoid; break-inside: avoid; }}
.pub-card {{ background:#FFF3E0; border:1px solid #FFD0A0;
  border-radius:var(--r-sm); padding:10px 12px; }}
.pub-card .key {{ font-size:10px; font-weight:700; color:var(--accent-orange);
  text-transform:uppercase; letter-spacing:0.08em; margin-bottom:3px; }}
.footer {{ border-top:1px solid var(--border); margin-top:20px;
  padding-top:10px; display:flex; justify-content:space-between;
  font-size:10px; color:var(--muted); }}
</style>
"""

def page(title, sub, badge_type, badge_dur, badge_viral,
         concept_text, hook_type, hook_text,
         storyboard_rows, instructions, music_track, music_why, music_alt,
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

<div class="concept-block">
  <div class="concept-label">Концепция формата</div>
  <div class="concept-text">{concept_text}</div>
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

# ─── #1: КАНДИДАТ — нейросериал ──────────────────────────────────────────────
s1 = page(
    title="«КАНДИДАТ» — нейросериал, эп. 1: МФЦ",
    sub="Relatable · 25–30 сек · Даванков в обычной жизни",
    badge_type="Relatable", badge_dur="25–30 сек", badge_viral="Узнаваемость · теплота",
    concept_text="<b>«КАНДИДАТ»</b> — нейросериал. Даванков / Нечаев как персонаж в обычных бытовых ситуациях.<br>Без политической повестки. Просто человек рядом с нами.<br><b>Правило:</b> никаких лозунгов — только поведение персонажа.<br><b>Масштабирование:</b> каждый эпизод = новая ситуация (метро, кофейня, рынок, почта).",
    hook_type="Число + узнаваемость",
    hook_text="Талончик № 347. На табло — № 12.",
    storyboard_rows=[
        ("1","0–2с","Крупный план: талончик МФЦ № 347. Рядом табло «Ваш номер: 12»","статика","Талончик № 347. На табло — № 12.","—"),
        ("2","2–6с","Средний план: Даванков (нейро, портретное сходство) сидит в пластиковом кресле МФЦ","pull-back","Это Владимир Даванков. Зампред ГД. Сегодня он в МФЦ.","—"),
        ("3","6–12с","Двойной план: рядом бабушка с авоськой. Смотрит на него.","—","—","Бабушка: «Молодой человек, вы за справкой?»"),
        ("4","12–18с","Крупный план лица Даванкова: чуть улыбается","—","—","Даванков: «Да. Уже третий раз.»"),
        ("5","18–22с","Бабушка кивает, смотрит на табло","—","—","Бабушка: «Ничего. Я четвёртый.»"),
        ("6","22–26с","На табло: № 13. Оба смотрят. Пауза.","slow","№ 13","—"),
        ("7","26–29с","Даванков смотрит в камеру. Лёгкая улыбка.","крупный план","Новые люди. Обычные очереди.","—"),
    ],
    instructions=[
        ("Персонаж", "Нейро-реалистичный, портретное сходство (reference image из открытых источников)"),
        ("Инструмент", "fal.ai flux-realism + HeyGen для lip-sync"),
        ("Среда", "Типичный МФЦ: серые кресла, табло, стенды. Без карикатуры."),
        ("Тон", "Тёплый, без сатиры — комедия узнавания, не издёвка"),
        ("Музыка", "Почти тихо — разговор и тишина = ощущение присутствия"),
        ("CTA", "—"),
    ],
    music_track="Тихий ambient / почти тишина",
    music_why="Разговор + тишина = ощущение присутствия. Музыка убьёт интимность сцены.",
    music_alt="Brock Berrigan — «Waiting» (lo-fi, ненавязчивый)",
    caption_text="Эпизод 1.",
    hashtags_text="#новыелюди\n#даванков\n#мфц\n#нейросериал",
    pub_time="Будний, 12:00–14:00 МСК",
    pub_cover="Кадр с талончиком № 347",
    scenario_n=1,
)

# ─── #2: РЕПОРТАЖ ИЗ 2040 ────────────────────────────────────────────────────
s2 = page(
    title="«РЕПОРТАЖ ИЗ 2040» — будущее смотрит назад",
    sub="Образовательный · 30–35 сек · ретроспектива из будущего",
    badge_type="Образовательный", badge_dur="30–35 сек", badge_viral="Любопытство · чёрный юмор",
    concept_text="<b>«Репортаж из 2040»</b> — AI-журналист из будущего оглядывается на 2026 как на исторический момент.<br>Партия — историческая деталь, уже случившееся. Не агитация — констатация.<br><b>Правило:</b> всё в прошедшем времени. «Именно тогда...»<br><b>Масштабирование:</b> серия репортажей — разные темы (медицина, технологии, образование).",
    hook_type="Временной прыжок",
    hook_text="Студия «Россия», 2040 год.",
    storyboard_rows=[
        ("1","0–2с","Нейро-студия 2040: минимализм, голографика. Ведущая за столом.","статика","Студия «Россия», 2040 год.","—"),
        ("2","2–8с","Ведущая смотрит в камеру, нейтральный тон","—","—","«Добрый вечер. Сегодня — ровно 14 лет с момента выборов в ГД 2026 года.»"),
        ("3","8–14с","«Архивные кадры 2026» — нейро-хроника с зерном","cut","Архивные кадры. 2026.","«Именно тогда в Думу впервые пришли люди, которых называли слишком молодыми.»"),
        ("4","14–20с","Ведущая снова, чуть улыбается","cut","—","«Сейчас смешно вспоминать, насколько это казалось невозможным.»"),
        ("5","20–26с","«Архивные кадры»: нейро-Даванков / Нечаев в 2026 — обычные, не пафосные","—","—","«Они не говорили про революцию. Просто приходили и работали.»"),
        ("6","26–32с","Ведущая закрывает папку. Пауза.","—","—","«Хорошее было время. Ну, в итоге.»"),
        ("7","32–35с","Нейро-лого «Новые люди» в стиле «исторический архив»","fade","Новые люди. 2026.","—"),
    ],
    instructions=[
        ("Студия 2040", "Минимализм, холодный свет, мягкая голографика — не sci-fi перегруз"),
        ("Ведущая", "Нейро-реализм, деловой стиль, нейтральный облик (не реальный человек)"),
        ("Архивные кадры", "Эффект «старого видео» (зерно, артефакты) — контраст со студией"),
        ("Тон голоса", "Ровный репортёрский, лёгкая теплота только в финале"),
        ("Промпт студии", "futuristic minimalist news studio 2040, holographic display, 9:16"),
        ("CTA", "—"),
    ],
    music_track="Nils Frahm — «Says»",
    music_why="Ambient piano с нарастанием. Кинематографичный, 0 слов, создаёт ощущение масштаба времени.",
    music_alt="Max Richter — «On the Nature of Daylight» (классика ностальгии)",
    caption_text="А как вы думаете,\nчто скажут про нас в 2040?",
    hashtags_text="#новыелюди\n#нейросериал\n#2040\n#политика\n#репортаж",
    pub_time="Выходной, 20:00–22:00 МСК",
    pub_cover="Студия 2040 с ведущей (необычный визуал = клик)",
    scenario_n=2,
)

# ─── #3: АУДИТ ───────────────────────────────────────────────────────────────
s3 = page(
    title="«АУДИТ» — команда проверяет кафетерий поликлиники",
    sub="Юмор · 25–30 сек · корпоративный абсурд в советском быту",
    badge_type="Юмор", badge_dur="25–30 сек", badge_viral="Узнаваемость · «перешли врачу»",
    concept_text="<b>«Аудит»</b> — команда «Новые люди» приходит проверить привычное российское явление. Не политика — быт.<br>Стиль: McKinsey пришёл в поликлинику. Язык KPI и дедлайнов о борще и очереди.<br><b>Правило:</b> абсолютно серьёзные лица. Юмор из несоответствия среды и языка, не из гримас.<br><b>Масштабирование:</b> каждый ролик = новый объект (МФЦ, лифт, стройка, буфет).",
    hook_type="Неожиданная ситуация",
    hook_text="Аудит кафетерия поликлиники №7. Понедельник, 11:34.",
    storyboard_rows=[
        ("1","0–2с","Советский кафетерий. Два человека в строгих костюмах с планшетами — не вписываются","статика","Аудит кафетерия. Поликлиника №7. 11:34.","—"),
        ("2","2–7с","Аудитор #1 фиксирует в планшете","крупный план","—","Аудитор #1: «Борщ. Температура подачи — 52°C. Норматив — 75°C. Отклонение критическое.»"),
        ("3","7–12с","Аудитор #2 осматривает зал","медленный обход","—","Аудитор #2: «Кофе-машина. Статус: отсутствует. KPI по удовлетворённости: не достигнут.»"),
        ("4","12–17с","Крупный план: очередь у кассы (3 бабушки)","—","Среднее время ожидания: 18 мин.","Аудитор #1: «Пропускная способность — ниже нормы на 340%.»"),
        ("5","17–22с","Кассирша смотрит с подозрением","cut","—","Кассирша: «Вы из санэпида?» Аудитор #2: «Мы из будущего.»"),
        ("6","22–27с","Аудиторы уходят. На столе — флаер «Новые люди».","fade","Новые люди. Проверяем. Предлагаем. Меняем.","—"),
    ],
    instructions=[
        ("Среда", "Типичный советский кафетерий: пластиковые подносы, металл, линолеум. Промпт: soviet hospital cafeteria, realistic, 9:16"),
        ("Аудиторы", "Нейтральные AI-персонажи, деловые костюмы, абсолютно серьёзные лица — юмор в несоответствии"),
        ("Тон", "НИКАКИХ улыбок у аудиторов. Комедия = контраст среды и языка"),
        ("CTA", "«Перешли своему врачу» мелко в финальном кадре"),
        ("Инструмент", "fal.ai + Adobe Express для персонажей"),
        ("Комментарии", "Пин в комментах: что ещё проверить — вовлечение аудитории"),
    ],
    music_track="Советская инструментальная классика (Чайковский / Штраус марш)",
    music_why="Официоз советской эпохи + корпоративный язык о борще = двойной комический эффект.",
    music_alt="«Entry of the Gladiators» — P. Fucik (цирковая тема, классика для комедии)",
    caption_text="Что ещё проверить?\nПишите в комменты — едем с аудитом.",
    hashtags_text="#новыелюди\n#аудит\n#поликлиника\n#юмор\n#политика",
    pub_time="Будний, 13:00–15:00 МСК",
    pub_cover="Аудиторы в костюмах на фоне советского кафетерия",
    scenario_n=3,
)

# ─── #4: НАМ ОБЕЩАЛИ ─────────────────────────────────────────────────────────
s4 = page(
    title="«НАМ ОБЕЩАЛИ» — ретрофутуризм, выпуск: умные города",
    sub="Ностальгия · 30–35 сек · прогнозы 2003 vs реальность 2026",
    badge_type="Ностальгия", badge_dur="30–35 сек", badge_viral="«Я помню» · лёгкая грусть",
    concept_text="<b>«Нам обещали»</b> — сравнение прогнозов прошлого с реальностью 2026. Не политика — разрыв мечты и реальности.<br>Нейро-ретрофутуризм (советский / нулевые) + нейро-реалистичный 2026.<br><b>Правило:</b> без злости. Ностальгия + надежда, не обвинения.<br><b>Масштабирование:</b> серия по темам — медицина, образование, дороги, космос.",
    hook_type="Факт из прошлого",
    hook_text="2003 год. Нам обещали умные города к 2025.",
    storyboard_rows=[
        ("1","0–3с","Нейро-обложка журнала в стиле нулевых: «Москва-2025» с летающими машинами","статика","2003 год. Нам обещали умные города к 2025.","—"),
        ("2","3–8с","Нейро-иллюстрация «обещанного»: роботы, автопилоты, зелёные крыши","fade","Автономный транспорт. Роботы в ЖКХ. Цифровые больницы.","—"),
        ("3","8–14с","Резкий cut: нейро-реалистичная Москва 2026 — пробка, стройка, лужа","жёсткий cut","2026.","—"),
        ("4","14–18с","Крупный план: лужа у подъезда, кабель на асфальте","—","—","«Что-то пошло не так.»"),
        ("5","18–23с","Нейро: более реалистичное достижимое будущее — молодые люди, технологии","мягкий fade","Часть этого — ещё возможна.","—"),
        ("6","23–28с","Нейро-кадр: светлый офис, технологии, реалистичное будущее","—","—","«Если делать конкретные вещи, а не обещать.»"),
        ("7","28–33с","Оранжевый фон, логотип «Новые люди»","fade","Новые люди. Конкретные шаги.","—"),
    ],
    instructions=[
        ("Ретрофутуризм", "Стиль советских иллюстраций 1970–80-х и журналов нулевых. Промпт: Soviet retro-futurism city 2025, magazine cover, optimistic, 9:16"),
        ("Реальность 2026", "Нейтральный гиперреализм — не карикатура. Просто обычный город."),
        ("Переход", "Резкий cut между мечтой и реальностью = визуальный удар. Ключевой момент."),
        ("Тон голоса", "Меланхоличный, не злой — как старый друг: «ну ты помнишь»"),
        ("CTA", "«Сохрани, чтобы показать оптимисту» — мелко в финале"),
        ("Инструмент", "Midjourney или fal.ai для ретрофутуристических иллюстраций"),
    ],
    music_track="«Полёт на дельтаплане» — Юрий Антонов (инструментальная)",
    music_why="Мгновенная ностальгия, узнаваемость. Без иронии — тепло и слегка грустно. Именно нужное настроение.",
    music_alt="Hans Zimmer — «Time» (кинематографичнее, без советского флёра)",
    caption_text="В 2003 году нам обещали умные города к 2025.\n\nПрошло 22 года.\nКое-что из этого всё ещё возможно.\nЕсли перестать обещать и начать делать.",
    hashtags_text="#новыелюди\n#ностальгия\n#умныегорода\n#технологии\n#россия",
    pub_time="Выходной, 12:00–14:00 МСК",
    pub_cover="Нейро-обложка журнала «Москва 2025» (яркий, необычный)",
    scenario_n=4,
)

# ─── #5: ПЕРВЫЙ ДЕНЬ ─────────────────────────────────────────────────────────
s5 = page(
    title="«ПЕРВЫЙ ДЕНЬ» — POV: ты новый депутат",
    sub="Иммерсия · 25–30 сек · от первого лица в Думе",
    badge_type="Иммерсия / POV", badge_dur="25–30 сек", badge_viral="«Я там» · досмотры до конца",
    concept_text="<b>«Первый день»</b> — POV от первого лица. Ты — новый депутат. Без нарратива, только среда.<br>Камера = твои глаза. Зритель проживает опыт, а не смотрит на него.<br><b>Правило:</b> никаких объяснений. Только происходящее вокруг.<br><b>Масштабирование:</b> серия сцен «первого дня» — разные моменты, разные эмоции.",
    hook_type="Обещание + интрига",
    hook_text="POV: твой первый день в Государственной Думе.",
    storyboard_rows=[
        ("1","0–2с","POV: двери Думы открываются. Охранник смотрит.","статика","POV: твой первый день в Государственной Думе.","Звук дверей"),
        ("2","2–6с","POV: рука достаёт пропуск из кармана. Охранник кивает.","slow","—","—"),
        ("3","6–10с","POV: длинный коридор. Люди в костюмах, никто не смотрит.","медленная ходьба","—","Звук шагов"),
        ("4","10–14с","POV: находишь место. На столе: «Повестка дня. 247 пунктов.»","—","Повестка: 247 пунктов.","—"),
        ("5","14–18с","POV: смотришь налево — сосед спит. Направо — листает телефон.","медленный pan","—","—"),
        ("6","18–22с","POV: на трибуне кто-то говорит. Зал почти пустой.","—","Кворум.","Приглушённый голос с трибуны"),
        ("7","22–26с","POV: открываешь папку. Пункт 1 из 247.","крупный план","Пункт 1 из 247.","—"),
        ("8","26–29с","Экран темнеет. Текст.","fade","Новые люди. Те, кто всё-таки читает.","—"),
    ],
    instructions=[
        ("Стиль", "Реалистичный POV, плавная камера от первого лица (как GoPro но плавно)"),
        ("Среда", "Нейро-реалистичный зал ГД: деревянные столы, микрофоны. Без карикатуры. Промпт: realistic Russian parliament hall, POV perspective, 9:16"),
        ("Рука в кадре", "Иногда в кадре (пропуск, папка) — POV-деталь, ключ к иммерсии"),
        ("Звуки", "Шаги, двери, бумага, приглушённый голос. Без музыки в основной части."),
        ("Финал", "Логотип без фанфар — тихо"),
        ("CTA", "—"),
    ],
    music_track="Только ambient звуки среды — без музыки",
    music_why="POV без музыки = максимальная иммерсия. Любой трек разрушает ощущение «я там».",
    music_alt="Если нужен трек — только в последние 5 сек: короткое нарастание (Hans Zimmer style)",
    caption_text="Ты бы открыл эту папку?",
    hashtags_text="#новыелюди\n#госдума\n#POV\n#политика\n#первыйдень",
    pub_time="Будний вечер, 19:00–21:00 МСК",
    pub_cover="Кадр: двери Думы открываются (POV-перспектива)",
    scenario_n=5,
)

for n, content in [(1,s1),(2,s2),(3,s3),(4,s4),(5,s5)]:
    out = DRAFTS / f"2026-07-27-reels-{n}" / "scenario.html"
    out.write_text(content, encoding="utf-8")
    print(f"✓ scenario {n}: {out}")

print("Done.")
