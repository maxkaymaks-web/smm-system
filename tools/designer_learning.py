#!/usr/bin/env python3
"""
Designer Learning Agent — bit&pix
Ежедневно: выбирает стиль → парсит Instagram через Apify →
скачивает топ-фото → анализирует ВИЗУАЛЬНО через fal.ai →
обновляет knowledge/ → шлёт подробный Telegram отчёт.
"""

import json, time, random, re, os, subprocess, tempfile
from datetime import date
from pathlib import Path
import urllib.request

# ── ТОКЕНЫ ───────────────────────────────────────────────────────────────────
APIFY    = 'apify_api_wHEKyiSCmCenuk0blUPLdEJKZXM8j92Zci8f'
GH       = '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'
TG       = '8625487536:AAG0erfiGf1C6btYTAkzVqVfhsa9OGjfH90'
CID      = 1791618146
REPO     = 'maxkaymaks-web/smm-system'
ACTOR    = 'eO62VlcRQs1OfFwHW'   # Fast Instagram Profile Reels Scraper
REPO_URL = f'https://{GH}@github.com/{REPO}.git'

# ── КОРЕНЬ РЕПО ───────────────────────────────────────────────────────────────
def find_repo_root():
    env_root = os.environ.get('REPO_ROOT')
    if env_root and Path(env_root).exists():
        return Path(env_root)
    p = Path(__file__).resolve().parent
    for _ in range(5):
        if (p / 'CLAUDE.md').exists():
            return p
        p = p.parent
    return Path('/tmp/smm-system')

REPO_ROOT = find_repo_root()

# ── СТИЛИ ────────────────────────────────────────────────────────────────────
STYLES = {
    'нежность': {
        'name': 'Нежность и Эстетика',
        'emoji': '🌸',
        'accounts': ['tatcha', 'laneige_us', 'aesopskincare', 'summer_fridays', 'byhumankind'],
        'focus': 'мягкие градиенты, кремово-пудровые тона, тонкий serif, воздух, editorial beauty кроп',
    },
    'технологичность': {
        'name': 'Технологичность и Инновации',
        'emoji': '⚙️',
        'accounts': ['dyson', 'notionhq', 'figma', 'linear_app', 'spacex'],
        'focus': 'строгие сетки, монохром, bold sans-serif, цифры как акцент, инфографика',
    },
    'роскошь': {
        'name': 'Роскошь и Премиум',
        'emoji': '✦',
        'accounts': ['chanelofficial', 'dior', 'bottegaveneta', 'louboutinworld'],
        'focus': 'тёмные фоны, gold accent, крупный serif CAPS, пустое пространство как роскошь',
    },
    'энергия': {
        'name': 'Энергия и Лайфстайл',
        'emoji': '⚡',
        'accounts': ['gymshark', 'oatly', 'frankbody', 'huel'],
        'focus': 'яркие контрастные цвета, oversized type, playful compositions, движение',
    },
}

PROMPT_ENG = {
    'name': 'Промпт-инжиниринг fal.ai',
    'emoji': '🧠',
    'urls': ['https://fal.ai/models', 'https://fal.ai/changelog', 'https://docs.fal.ai'],
    'focus': 'новые модели fal.ai, техники промптинга, style keywords для beauty/tech/luxury',
}

# ── УТИЛИТЫ ──────────────────────────────────────────────────────────────────
def tg(text):
    if len(text) > 4000:
        text = text[:3980] + '\n…[обрезано]'
    data = json.dumps({'chat_id': CID, 'text': text, 'parse_mode': 'HTML'}).encode()
    r = urllib.request.Request(
        f'https://api.telegram.org/bot{TG}/sendMessage',
        data=data, headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(r) as resp:
        return resp.read()

def ensure_repo():
    global REPO_ROOT
    if (REPO_ROOT / 'CLAUDE.md').exists():
        return
    print(f"  → Клонирую репо в {REPO_ROOT}")
    REPO_ROOT.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git', 'clone', REPO_URL, str(REPO_ROOT)], check=True, capture_output=True)

def git_push(message):
    subprocess.run(['git', '-C', str(REPO_ROOT), 'config', 'user.email', 'bot@bitandpix.ru'], capture_output=True)
    subprocess.run(['git', '-C', str(REPO_ROOT), 'config', 'user.name', 'Designer Learning Bot'], capture_output=True)
    subprocess.run(['git', '-C', str(REPO_ROOT), 'pull', '--rebase', 'origin', 'main'], capture_output=True)
    subprocess.run(['git', '-C', str(REPO_ROOT), 'add', '.'], capture_output=True)
    result = subprocess.run(['git', '-C', str(REPO_ROOT), 'commit', '-m', message], capture_output=True)
    if result.returncode == 0:
        subprocess.run(['git', '-C', str(REPO_ROOT), 'push', 'origin', 'main'], check=True, capture_output=True)
        print("  → git push OK")
    else:
        print("  → Нечего коммитить")

def write_file(rel_path, content):
    full_path = REPO_ROOT / rel_path
    full_path.parent.mkdir(parents=True, exist_ok=True)
    full_path.write_text(content, encoding='utf-8')

def read_file(rel_path):
    full_path = REPO_ROOT / rel_path
    return full_path.read_text(encoding='utf-8') if full_path.exists() else None

# ── APIFY ─────────────────────────────────────────────────────────────────────
def apify_run(usernames, limit=10):
    """Запуск Instagram Reels scraper, возврат постов с image URL."""
    print(f"  → Apify: парсим {usernames}")
    url = f'https://api.apify.com/v2/acts/{ACTOR}/runs?token={APIFY}&waitForFinish=180'
    payload = {'instagramUsernames': usernames, 'maxReels': limit}
    body = json.dumps(payload).encode()
    r = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=200) as resp:
        run = json.loads(resp.read().decode())

    dataset_id = run['data']['defaultDatasetId']
    status     = run['data']['status']
    run_id     = run['data']['id']
    print(f"  → Статус: {status}, dataset: {dataset_id}")

    if status == 'RUNNING':
        for _ in range(12):
            time.sleep(15)
            check_url = f'https://api.apify.com/v2/acts/{ACTOR}/runs/{run_id}?token={APIFY}'
            r2 = urllib.request.Request(check_url)
            with urllib.request.urlopen(r2) as resp2:
                state = json.loads(resp2.read().decode())['data']['status']
            if state == 'SUCCEEDED':
                break

    items_url = f'https://api.apify.com/v2/datasets/{dataset_id}/items?format=json&clean=true&limit=100&token={APIFY}'
    r3 = urllib.request.Request(items_url)
    with urllib.request.urlopen(r3) as resp3:
        return json.loads(resp3.read().decode())

# ── ВИЗУАЛЬНЫЙ АНАЛИЗ ────────────────────────────────────────────────────────
def download_image(url, path):
    """Скачать изображение с Instagram CDN."""
    req = urllib.request.Request(url, headers={
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': 'https://www.instagram.com/',
    })
    with urllib.request.urlopen(req, timeout=20) as resp:
        Path(path).write_bytes(resp.read())

def analyze_image_visually(local_path, style_name, style_focus):
    """Вызвать analyze-image.mjs → получить JSON с визуальным анализом."""
    tool = REPO_ROOT / 'tools' / 'analyze-image.mjs'
    result = subprocess.run(
        ['node', str(tool), local_path, style_name, style_focus],
        capture_output=True, text=True, timeout=60,
        cwd=str(REPO_ROOT)
    )
    stdout = result.stdout.strip()
    if not stdout:
        print(f"    ⚠️  Нет ответа от analyze-image ({result.stderr[:100]})")
        return None
    try:
        return json.loads(stdout)
    except Exception:
        print(f"    ⚠️  JSON parse error: {stdout[:100]}")
        return None

def get_top_posts_with_images(posts, n=6):
    """Выбрать топ N постов по вовлечённости, у которых есть image URL."""
    scored = []
    for p in posts:
        img = p.get('image') or ''
        if not img:
            continue
        likes    = p.get('like_count') or 0
        views    = p.get('view_count') or p.get('play_count') or 0
        comments = p.get('comment_count') or 0
        score    = likes * 2 + comments * 5 + views // 20
        username = p.get('owner', {}).get('username') or p.get('username') or 'unknown'
        scored.append({'img': img, 'score': score, 'likes': likes,
                       'views': views, 'username': username})
    return sorted(scored, key=lambda x: x['score'], reverse=True)[:n]

def synthesize_analyses(analyses, style_data, accounts_used):
    """Вызвать synthesize-visual.mjs → получить JSON с паттернами и fal.ai промптами."""
    tool = REPO_ROOT / 'tools' / 'synthesize-visual.mjs'
    accounts_str = ', '.join('@'+a for a in accounts_used)
    analyses_json = json.dumps(analyses)

    result = subprocess.run(
        ['node', str(tool), analyses_json, style_data['name'], style_data['focus'], accounts_str],
        capture_output=True, text=True, timeout=60,
        cwd=str(REPO_ROOT)
    )
    stdout = result.stdout.strip()
    if not stdout:
        print(f"    ⚠️  Синтез не вернул ответ: {result.stderr[:120]}")
        return None
    try:
        return json.loads(stdout)
    except Exception:
        print(f"    ⚠️  JSON parse error синтеза: {stdout[:120]}")
        return None

def extract_field(text, field):
    m = re.search(rf'^{field}:\s*(.+)$', text, re.MULTILINE)
    return m.group(1).strip() if m else ''

# ── ПРОМПТ-ИНЖИНИРИНГ ────────────────────────────────────────────────────────
def run_prompt_engineering():
    print("  → Режим: промпт-инжиниринг")
    today_str = date.today().strftime('%d.%m.%Y')

    found_models, source_results = [], []
    for url in PROMPT_ENG['urls'][:3]:
        try:
            r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(r, timeout=15) as resp:
                html = resp.read().decode(errors='ignore')
            models = list(dict.fromkeys(re.findall(r'fal-ai/[\w\-]+(?:/[\w\-]+)*', html)))[:12]
            found_models.extend(models)
            source_results.append({'url': url, 'count': len(models)})
        except Exception as e:
            source_results.append({'url': url, 'count': 0, 'error': str(e)})

    unique_models = list(dict.fromkeys(found_models))[:20]

    gen_m    = [m for m in unique_models if any(k in m for k in ['flux','imagen','stable','gen','create','nano'])]
    edit_m   = [m for m in unique_models if any(k in m for k in ['edit','inpaint','remove','replace','erase'])]
    video_m  = [m for m in unique_models if any(k in m for k in ['video','animate','motion','kling','wan','mochi'])]
    up_m     = [m for m in unique_models if any(k in m for k in ['upscale','enhance','super','seedvr','esrgan'])]
    vision_m = [m for m in unique_models if any(k in m for k in ['vision','llava','describe','caption','moondream'])]

    def fmt(lst): return ', '.join(f'`{m}`' for m in lst[:5]) if lst else '—'

    insight = f"""
### Промпт-инжиниринг fal.ai — авто-обучение {today_str}

#### Источники проверены
{chr(10).join(f"- {s['url']} → {'ошибка' if 'error' in s else str(s['count'])+' моделей'}" for s in source_results)}

#### Карта моделей по задачам
- Генерация изображений: {fmt(gen_m)}
- Редактирование/inpaint: {fmt(edit_m)}
- Видео/анимация: {fmt(video_m)}
- Апскейл/улучшение: {fmt(up_m)}
- Vision/анализ: {fmt(vision_m)}

#### Все найденные модели
{', '.join(f'`{m}`' for m in unique_models) or '— нет данных'}

#### Рекомендации для дизайнера
- Основная генерация фонов → `fal-ai/nano-banana-2` (наш дефолт)
- Удаление фона → `fal-ai/bria/background/remove`
- Апскейл → `fal-ai/seedvr/upscale/image`
---
"""
    tg_text = (
        f"🧠 <b>Дизайнер — Промпт-инжиниринг fal.ai</b> | {today_str}\n\n"
        f"<b>Источников проверено:</b> {len(source_results)}\n"
        f"<b>Моделей обнаружено:</b> {len(unique_models)}\n\n"
        f"<b>Генерация:</b> {', '.join(gen_m[:3]) or '—'}\n"
        f"<b>Редактирование:</b> {', '.join(edit_m[:3]) or '—'}\n"
        f"<b>Видео:</b> {', '.join(video_m[:2]) or '—'}\n"
        f"<b>Vision:</b> {', '.join(vision_m[:3]) or '—'}\n\n"
        f"✅ Записано → knowledge/references.md"
    )
    return insight, "Промпт-инжиниринг fal.ai", PROMPT_ENG['emoji'], [], tg_text

# ── ВЫБОР СТИЛЯ ──────────────────────────────────────────────────────────────
def pick_style():
    weights = {'нежность': 25, 'технологичность': 25, 'роскошь': 15, 'энергия': 15, '__prompt__': 20}
    pool = []
    for k, w in weights.items():
        pool.extend([k] * w)
    return random.choice(pool)

# ── MAIN ─────────────────────────────────────────────────────────────────────
def main():
    print(f"\n🎓 Designer Learning — {date.today()}")
    ensure_repo()

    style_key = pick_style()

    if style_key == '__prompt__':
        insight_text, style_name, emoji, accounts_used, tg_report = run_prompt_engineering()

    else:
        style_data   = STYLES[style_key]
        style_name   = style_data['name']
        emoji        = style_data['emoji']
        accounts_used = random.sample(style_data['accounts'], min(3, len(style_data['accounts'])))
        print(f"  → Стиль: {style_name}")

        # 1. Получить посты
        posts = apify_run(accounts_used, limit=10)
        print(f"  → Получено постов: {len(posts)}")
        if not posts:
            tg(f"⚠️ Designer Learning: нет данных от Apify ({style_name})")
            return

        # 2. Выбрать топ по вовлечённости с изображениями
        top_posts = get_top_posts_with_images(posts, n=6)
        print(f"  → Изображений для анализа: {len(top_posts)}")
        if not top_posts:
            tg(f"⚠️ Designer Learning: нет изображений в постах ({style_name})")
            return

        # 3. Скачать + визуально проанализировать каждое
        analyses = []
        with tempfile.TemporaryDirectory() as tmpdir:
            for i, p in enumerate(top_posts):
                img_path = f"{tmpdir}/img_{i}.jpg"
                try:
                    download_image(p['img'], img_path)
                    print(f"  → [{i+1}/{len(top_posts)}] @{p['username']} — анализирую визуально...")
                    result = analyze_image_visually(img_path, style_name, style_data['focus'])
                    if result and not result.get('error'):
                        result['username'] = p['username']
                        result['likes']    = p['likes']
                        result['views']    = p.get('views', 0)
                        analyses.append(result)
                        print(f"      ✓ style={result.get('style','')} | colors={result.get('colors','')[:50]}")
                    else:
                        print(f"      ⚠️  Ошибка анализа: {(result or {}).get('error','')[:80]}")
                except Exception as e:
                    print(f"    ⚠️  [{i+1}] ошибка: {e}")

        print(f"  → Проанализировано изображений: {len(analyses)}")
        if not analyses:
            tg(f"⚠️ Designer Learning: не удалось проанализировать ни одного изображения ({style_name})")
            return

        # 4. Синтез паттернов через fal.ai LLM
        print("  → Синтезирую визуальные паттерны...")
        synthesis = synthesize_analyses(analyses, style_data, accounts_used)

        # 5. Формируем записи для knowledge/
        today_str = date.today().strftime('%d.%m.%Y')

        # Собираем fal.ai промпты из индивидуальных анализов
        individual_prompts = []
        for a in analyses:
            if a.get('fal_prompt_1'): individual_prompts.append(a['fal_prompt_1'])
            if a.get('fal_prompt_2'): individual_prompts.append(a['fal_prompt_2'])
        unique_prompts = list(dict.fromkeys(individual_prompts))[:6]

        # Синтезированные поля (synthesis — уже распарсенный JSON)
        synth_patterns = []
        synth_fal      = []
        color_palette  = ''
        comp_rules     = ''
        texture_sig    = ''

        if synthesis and not synthesis.get('error'):
            synth_patterns = synthesis.get('patterns', [])
            synth_fal      = synthesis.get('fal_prompts', [])
            color_palette  = synthesis.get('color_palette', '')
            comp_rules     = synthesis.get('composition_rules', '')
            texture_sig    = synthesis.get('texture_lighting', '')

        # Фолбэк промпты из индивидуальных анализов если синтез не дал
        all_fal_prompts = (synth_fal or unique_prompts[:3])

        # Топ посты по вовлечённости
        top3 = sorted(analyses, key=lambda x: x.get('likes', 0), reverse=True)[:3]

        # Markdown запись для references.md
        ind_analyses_md = ''
        for a in analyses:
            ind_analyses_md += (
                f"  - **@{a.get('username','')}** ({a.get('likes',0):,} likes) — "
                f"{a.get('style','')} | {a.get('colors','')[:60]} | {a.get('composition','')[:60]}\n"
            )

        fal_md = '\n'.join(f"  - `{p}`" for p in all_fal_prompts if p)

        insight_text = f"""
### {style_name} — авто-обучение {today_str}
> Аккаунты: {', '.join('@'+a for a in accounts_used)} | Проанализировано изображений: {len(analyses)}

#### Изученные посты
{ind_analyses_md}
#### Визуальные паттерны (синтез)
{chr(10).join(f'{i+1}. {p}' for i,p in enumerate(synth_patterns)) if synth_patterns else '— синтез не выполнен'}

#### Цветовая палитра стиля
{color_palette or '— не определена'}

#### Правила композиции
{comp_rules or '— не определены'}

#### Текстура и свет
{texture_sig or '— не определены'}

#### fal.ai промпты для стиля (применять при генерации)
{fal_md or '— нет промптов'}

#### Дизайн-фокус
{style_data['focus']}
---
"""

        # 6. Telegram отчёт
        top3_str = ''
        for i, a in enumerate(top3, 1):
            top3_str += (
                f"\n{i}. @{a.get('username','')} 👍{a.get('likes',0):,}\n"
                f"   Стиль: {a.get('style','')} | {a.get('colors','')[:50]}\n"
                f"   Свет: {a.get('lighting','')[:50]}\n"
                f"   Композиция: {a.get('composition','')[:55]}"
            )

        patterns_str = ''
        for i, p in enumerate(synth_patterns[:3], 1):
            patterns_str += f"\n{i}. {p[:90]}"

        fal_tg = '\n'.join(f"• {p[:100]}" for p in all_fal_prompts[:2] if p)

        tg_report = (
            f"{emoji} <b>Дизайнер учился: {style_name}</b> | {date.today().strftime('%d.%m')}\n\n"

            f"📸 <b>Что изучил</b>\n"
            f"Аккаунты: {', '.join('@'+a for a in accounts_used)}\n"
            f"Изображений разобрано: {len(analyses)}\n\n"

            f"🎨 <b>Визуальные паттерны стиля</b>"
            f"{patterns_str if patterns_str else chr(10)+'— синтез недоступен'}\n\n"

            f"🖼 <b>Топ посты — что увидел</b>"
            f"{top3_str}\n\n"

            f"🎨 <b>Палитра:</b> {(color_palette or '—')[:100]}\n"
            f"📐 <b>Композиция:</b> {(comp_rules or '—')[:100]}\n"
            f"💡 <b>Свет/текстура:</b> {(texture_sig or '—')[:100]}\n\n"

            f"🤖 <b>Новые fal.ai промпты для стиля</b>\n"
            f"{fal_tg if fal_tg else '— нет'}\n\n"

            f"✅ Записано → knowledge/references.md\n"
            f"Дизайнер применит при следующей задаче."
        )

    # ── Обновить references.md ─────────────────────────────────────────────
    print("  → Обновляю knowledge/references.md")
    ref_path = 'agents/designer/knowledge/references.md'
    current  = read_file(ref_path) or '# References — Designer Knowledge\n\n## Автообучение (новые — сверху)\n\n'
    marker   = '## Автообучение (новые — сверху)\n'
    if marker in current:
        updated = current.replace(marker, f'{marker}{insight_text}')
    else:
        updated = current + f'\n\n## Автообучение (новые — сверху)\n{insight_text}'
    write_file(ref_path, updated)

    # ── Обновить log.md ────────────────────────────────────────────────────
    print("  → Обновляю learning/log.md")
    log_path    = 'agents/designer/learning/log.md'
    log_entry   = f"\n## {date.today()} | {emoji} {style_name}\n{insight_text.strip()}\n"
    log_current = read_file(log_path) or (
        '# Learning Log — Дизайнер\n\n'
        '> Автоматически дополняется скриптом `tools/designer_learning.py` каждый день.\n\n---\n\n'
        '<!-- Записи добавляются сверху (новые первые) -->\n'
    )
    log_updated = log_current.replace(
        '<!-- Записи добавляются сверху (новые первые) -->',
        f'<!-- Записи добавляются сверху (новые первые) -->{log_entry}'
    )
    write_file(log_path, log_updated)

    # ── Git push ───────────────────────────────────────────────────────────
    git_push(f'learning: {style_name} — {date.today()}')

    # ── Telegram ───────────────────────────────────────────────────────────
    print("  → Отправляю Telegram")
    tg(tg_report)
    print(f"  ✓ Готово. Стиль: {style_name}")

if __name__ == '__main__':
    main()
