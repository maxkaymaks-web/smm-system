#!/usr/bin/env python3
"""
Designer Learning Agent — bit&pix
Ежедневно: выбирает стиль → парсит Instagram через Apify →
анализирует паттерны → обновляет knowledge/ → шлёт Telegram отчёт.
"""

import json, time, random, re, base64, os, subprocess
from datetime import date, datetime
from pathlib import Path
import urllib.request, urllib.parse

# ── ТОКЕНЫ ───────────────────────────────────────────────────────────────────
APIFY  = 'apify_api_wHEKyiSCmCenuk0blUPLdEJKZXM8j92Zci8f'
GH     = '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'
TG     = '8625487536:AAG0erfiGf1C6btYTAkzVqVfhsa9OGjfH90'
CID    = 1791618146
REPO   = 'maxkaymaks-web/smm-system'
ACTOR  = 'eO62VlcRQs1OfFwHW'  # Fast Instagram Profile Reels Scraper
REPO_URL = f'https://{GH}@github.com/{REPO}.git'

# Корень репо: либо передан через env REPO_ROOT, либо ищем по маркеру
def find_repo_root():
    env_root = os.environ.get('REPO_ROOT')
    if env_root and Path(env_root).exists():
        return Path(env_root)
    # Ищем от текущего файла вверх
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
        'signals': ['soft','glow','minimal','natural','gentle','cream','silk','bloom','tender','warm','nourish','calm'],
        'focus': 'мягкие градиенты, кремово-пудровые тона, тонкий serif, воздух, editorial beauty кроп',
    },
    'технологичность': {
        'name': 'Технологичность и Инновации',
        'emoji': '⚙️',
        'accounts': ['dyson', 'notionhq', 'figma', 'linear_app', 'spacex'],
        'signals': ['precision','engineered','innovation','tech','data','system','performance','efficiency','clean','sharp'],
        'focus': 'строгие сетки, монохром, bold sans-serif, цифры как акцент, инфографика',
    },
    'роскошь': {
        'name': 'Роскошь и Премиум',
        'emoji': '✦',
        'accounts': ['chanelofficial', 'dior', 'bottegaveneta', 'louboutinworld'],
        'signals': ['luxury','premium','exclusive','heritage','artisan','crafted','bespoke','timeless','refined'],
        'focus': 'тёмные фоны, gold accent, крупный serif CAPS, пустое пространство как роскошь',
    },
    'энергия': {
        'name': 'Энергия и Лайфстайл',
        'emoji': '⚡',
        'accounts': ['gymshark', 'oatly', 'frankbody', 'huel'],
        'signals': ['bold','vibrant','fresh','power','fuel','move','energy','alive','bright','dynamic'],
        'focus': 'яркие контрастные цвета, oversized type, playful compositions, движение',
    },
}

PROMPT_ENG = {
    'name': 'Промпт-инжиниринг fal.ai',
    'emoji': '🧠',
    'urls': [
        'https://fal.ai/models',
        'https://fal.ai/changelog',
        'https://docs.fal.ai',
        'https://prompthero.com/flux-prompts',
    ],
    'focus': 'новые модели fal.ai, техники промптинга, style keywords для beauty/tech/luxury',
}

# ── УТИЛИТЫ ──────────────────────────────────────────────────────────────────
def req(method, url, data=None, headers=None):
    h = {'Content-Type': 'application/json', 'User-Agent': 'smm-designer-learning/1.0'}
    if headers:
        h.update(headers)
    body = json.dumps(data).encode() if data else None
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode())

def ensure_repo():
    """Клонирует репо если запускаемся вне него (CCR-контекст)."""
    global REPO_ROOT
    if (REPO_ROOT / 'CLAUDE.md').exists():
        return  # уже в репо
    print(f"  → Клонирую репо в {REPO_ROOT}")
    REPO_ROOT.mkdir(parents=True, exist_ok=True)
    subprocess.run(['git', 'clone', REPO_URL, str(REPO_ROOT)], check=True, capture_output=True)

def git_push(message):
    """git add → commit → push из REPO_ROOT."""
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
    if full_path.exists():
        return full_path.read_text(encoding='utf-8')
    return None

def tg(text):
    data = json.dumps({'chat_id': CID, 'text': text, 'parse_mode': 'HTML'}).encode()
    r = urllib.request.Request(
        f'https://api.telegram.org/bot{TG}/sendMessage',
        data=data, headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(r) as resp:
        return resp.read()

# ── APIFY ─────────────────────────────────────────────────────────────────────
def apify_run(usernames, limit=8):
    """Запуск Instagram Reels scraper, возврат постов."""
    print(f"  → Apify: парсим {usernames}")
    url = f'https://api.apify.com/v2/acts/{ACTOR}/runs?token={APIFY}&waitForFinish=180'
    payload = {'instagramUsernames': usernames, 'maxReels': limit}
    body = json.dumps(payload).encode()
    r = urllib.request.Request(url, data=body, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(r, timeout=200) as resp:
        run = json.loads(resp.read().decode())

    dataset_id = run['data']['defaultDatasetId']
    status = run['data']['status']
    print(f"  → Статус: {status}, dataset: {dataset_id}")

    if status not in ('SUCCEEDED', 'RUNNING'):
        return []

    # Если RUNNING — допольнительный polling
    if status == 'RUNNING':
        for _ in range(12):
            time.sleep(15)
            check_url = f'https://api.apify.com/v2/acts/{ACTOR}/runs/{run["data"]["id"]}?token={APIFY}'
            r2 = urllib.request.Request(check_url)
            with urllib.request.urlopen(r2) as resp2:
                state = json.loads(resp2.read().decode())['data']['status']
            if state == 'SUCCEEDED':
                break

    items_url = f'https://api.apify.com/v2/datasets/{dataset_id}/items?format=json&clean=true&limit=100&token={APIFY}'
    r3 = urllib.request.Request(items_url)
    with urllib.request.urlopen(r3) as resp3:
        return json.loads(resp3.read().decode())

# ── АНАЛИЗ ПАТТЕРНОВ ──────────────────────────────────────────────────────────
def analyze_posts(posts, style_data):
    """Извлечь паттерны из каптайнов и хэштегов."""
    all_text = []
    all_tags = []
    engagement = []

    for p in posts:
        caption = (p.get('caption') or p.get('text') or '').lower()
        tags = p.get('hashtags') or []
        likes = p.get('like_count') or p.get('diggCount') or 0
        views = p.get('view_count') or p.get('play_count') or 0
        all_text.append(caption)
        all_tags.extend([t.lower().replace('#','') for t in tags])
        engagement.append({'caption': caption[:120], 'likes': likes, 'views': views,
                           'url': p.get('reel_url') or p.get('url') or ''})

    # Топ хэштеги
    tag_freq = {}
    for t in all_tags:
        if len(t) > 2:
            tag_freq[t] = tag_freq.get(t, 0) + 1
    top_tags = sorted(tag_freq.items(), key=lambda x: -x[1])[:15]

    # Сигнальные слова стиля в текстах
    found_signals = {}
    for word in style_data['signals']:
        count = sum(1 for t in all_text if word in t)
        if count > 0:
            found_signals[word] = count

    # Топ посты по вовлечённости
    top_posts = sorted(engagement, key=lambda x: x['likes'] + x['views']//10, reverse=True)[:3]

    # Язык и тон (простой анализ)
    avg_caption_len = sum(len(t) for t in all_text) // max(len(all_text), 1)
    has_questions = sum(1 for t in all_text if '?' in t)
    has_cta = sum(1 for t in all_text if any(w in t for w in ['shop','link','get','swipe','click','buy','order']))

    return {
        'top_tags': top_tags,
        'signals_found': found_signals,
        'top_posts': top_posts,
        'avg_caption_len': avg_caption_len,
        'questions_pct': round(has_questions / max(len(all_text),1) * 100),
        'cta_pct': round(has_cta / max(len(all_text),1) * 100),
        'total_posts': len(posts),
    }

def generate_insights(style_key, style_data, analysis, accounts_used):
    """Сформировать Markdown-запись для knowledge/references.md"""
    today_str = date.today().strftime('%d.%m.%Y')
    tag_str = ', '.join(f'#{t}' for t,_ in analysis['top_tags'][:8])
    signal_str = ', '.join(f'{w}({c})' for w,c in sorted(analysis['signals_found'].items(), key=lambda x:-x[1])[:5])

    top_post_str = ''
    for i, p in enumerate(analysis['top_posts'], 1):
        top_post_str += f'  {i}. "{p["caption"][:80]}..." — 👍{p["likes"]:,}\n'

    return f"""
### {style_data['name']} — авто-обучение {today_str}
**Аккаунты:** {', '.join('@'+a for a in accounts_used)}
**Постов проанализировано:** {analysis['total_posts']}

**Топ хэштеги:**
{tag_str}

**Сигнальные слова стиля:**
{signal_str if signal_str else '— не найдены в текстах'}

**Паттерны каптайнов:**
- Средняя длина: {analysis['avg_caption_len']} символов
- Вопросы в постах: {analysis['questions_pct']}%
- CTA-слова: {analysis['cta_pct']}%

**Топ посты по вовлечённости:**
{top_post_str}
**Фокус для дизайна:** {style_data['focus']}
---
"""

# ── ГЛАВНАЯ ЛОГИКА ────────────────────────────────────────────────────────────
def pick_style():
    """Случайный выбор с весами: A/B по 25%, C/D по 15%, E (промпты) 20%."""
    weights = {
        'нежность': 25,
        'технологичность': 25,
        'роскошь': 15,
        'энергия': 15,
        '__prompt__': 20,
    }
    pool = []
    for k, w in weights.items():
        pool.extend([k] * w)
    return random.choice(pool)

def run_prompt_engineering():
    """Направление E: анализ fal.ai и промпт-инжиниринг из открытых источников."""
    print("  → Режим: промпт-инжиниринг")
    # Скачиваем страницы fal.ai и ищем новые модели
    insights_lines = []
    for url in PROMPT_ENG['urls'][:2]:
        try:
            r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(r, timeout=15) as resp:
                html = resp.read().decode(errors='ignore')
            # Ищем упоминания моделей
            models = re.findall(r'fal-ai/[\w\-/]+', html)
            unique_models = list(dict.fromkeys(models))[:10]
            if unique_models:
                insights_lines.append(f"**{url}** → модели: {', '.join(unique_models)}")
        except Exception as e:
            insights_lines.append(f"**{url}** → ошибка: {e}")

    today_str = date.today().strftime('%d.%m.%Y')
    insight = f"""
### Промпт-инжиниринг fal.ai — авто-обучение {today_str}
**Источники:** {', '.join(PROMPT_ENG['urls'][:2])}

**Найденные модели:**
{chr(10).join(insights_lines) if insights_lines else '— нет данных'}

**Фокус:** {PROMPT_ENG['focus']}
---
"""
    return insight, "Промпт-инжиниринг fal.ai", PROMPT_ENG['emoji'], []

def main():
    print(f"\n🎓 Designer Learning — {date.today()}")
    ensure_repo()

    style_key = pick_style()

    if style_key == '__prompt__':
        insight_text, style_name, emoji, accounts_used = run_prompt_engineering()
        analysis = None
    else:
        style_data = STYLES[style_key]
        style_name = style_data['name']
        emoji = style_data['emoji']
        accounts_list = style_data['accounts']
        accounts_used = random.sample(accounts_list, min(3, len(accounts_list)))
        print(f"  → Стиль: {style_name}")

        posts = apify_run(accounts_used, limit=8)
        print(f"  → Получено постов: {len(posts)}")

        if not posts:
            print("  ⚠️  Нет данных от Apify")
            tg(f"🎓 Обучение дизайнера: нет данных от Apify для стиля {style_name}")
            return

        analysis = analyze_posts(posts, style_data)
        insight_text = generate_insights(style_key, style_data, analysis, accounts_used)

    # ── Обновить references.md ─────────────────────────────────────────────
    print("  → Обновляю knowledge/references.md")
    ref_path = 'agents/designer/knowledge/references.md'
    current = read_file(ref_path) or '# References — Designer Knowledge\n\n## Визуальные референсы и разборы\n\n'
    if '## Визуальные референсы и разборы\n' in current:
        updated = current.replace(
            '## Визуальные референсы и разборы\n',
            f'## Визуальные референсы и разборы\n{insight_text}'
        )
    else:
        updated = current + '\n' + insight_text
    write_file(ref_path, updated)

    # ── Обновить log.md ────────────────────────────────────────────────────
    print("  → Обновляю learning/log.md")
    log_path = 'agents/designer/learning/log.md'
    log_entry = f"## {date.today()} | {emoji} {style_name}\n{insight_text.strip()[:400]}...\n\n"
    log_current = read_file(log_path) or '# Learning Log\n\n<!-- записи -->\n'
    log_updated = log_current.replace('<!-- записи -->', f'<!-- записи -->\n{log_entry}')
    write_file(log_path, log_updated)

    # ── Git push ───────────────────────────────────────────────────────────
    git_push(f'learning: {style_name} — {date.today()}')

    # ── Telegram отчёт ─────────────────────────────────────────────────────
    print("  → Отправляю Telegram")
    accounts_str = ', '.join('@'+a for a in accounts_used) if accounts_used else 'веб-источники'

    if style_key == '__prompt__':
        tg_text = (
            f"🧠 <b>Обучение дизайнера — {date.today().strftime('%d.%m')}</b>\n\n"
            f"Направление: <b>Промпт-инжиниринг fal.ai</b>\n\n"
            f"Изучал: документация fal.ai, новые модели, техники промптинга\n\n"
            f"Паттерны записаны → agents/designer/knowledge/references.md"
        )
    else:
        top_tags_str = ' '.join(f'#{t}' for t,_ in analysis['top_tags'][:6])
        tg_text = (
            f"{emoji} <b>Обучение дизайнера — {date.today().strftime('%d.%m')}</b>\n\n"
            f"Стиль: <b>{style_name}</b>\n"
            f"Аккаунты: {accounts_str}\n"
            f"Постов изучено: {analysis['total_posts']}\n\n"
            f"<b>Топ хэштеги стиля:</b>\n{top_tags_str}\n\n"
            f"<b>Фокус на дизайн:</b>\n{style_data['focus']}\n\n"
            f"Паттерны → agents/designer/knowledge/references.md"
        )

    tg(tg_text)
    print(f"  ✓ Готово. Стиль: {style_name}")

if __name__ == '__main__':
    main()
