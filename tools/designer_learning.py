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

STOPWORDS = {'the','a','an','and','or','but','in','on','at','to','for','of','with',
             'is','are','was','were','be','been','have','has','had','do','does','did',
             'not','no','so','if','as','by','up','it','its','we','our','you','your',
             'i','my','me','this','that','they','their','them','from','will','can',
             'just','all','get','got','out','how','what','when','who','new','now',
             'more','one','your','into','also','about','like','use','make','used'}

def top_words(texts, n=15):
    """Самые частые значимые слова в каптайнах."""
    freq = {}
    for t in texts:
        words = re.findall(r'[a-zа-яёÀ-ÿ]{4,}', t.lower())
        for w in words:
            if w not in STOPWORDS:
                freq[w] = freq.get(w, 0) + 1
    return sorted(freq.items(), key=lambda x: -x[1])[:n]

def caption_structure(caption):
    """Тип структуры каптайна."""
    c = caption.strip()
    if len(c) < 80:
        return 'short'
    if c.startswith(('✨','🔥','💡','⚡','🌸','✦','→','•')) or c[0].isupper():
        return 'emoji_hook'
    if '?' in c[:60]:
        return 'question_hook'
    return 'statement'

def suggested_fal_prompts(style_key, top_words_list):
    """Сгенерировать конкретные fal.ai промпты на основе найденных слов."""
    word_set = {w for w, _ in top_words_list}

    base = {
        'нежность': [
            'Extreme close-up of smooth bare female skin, soft golden hour light, film grain texture, warm cream tones, luxury beauty editorial, shot on 35mm film, ultra-detailed pores and texture',
            'Delicate white flower petals on ivory linen fabric, soft diffused light, minimal, editorial beauty aesthetic, no text, warm cream tones',
        ],
        'технологичность': [
            'Precision-engineered metal component, macro studio photography, monochrome, sharp edges, technical detail, clean white background, product photography',
            'Abstract data flow visualization, glowing lines on dark background, deep navy and white, clean geometric, no people, tech aesthetic',
        ],
        'роскошь': [
            'Close-up of black polished marble surface, gold veins, macro, luxury brand aesthetic, studio lighting, no text',
            'Fine silk fabric draped elegantly, deep black, dramatic chiaroscuro lighting, fashion editorial, no people',
        ],
        'энергия': [
            'Dynamic motion blur of human body in athletic movement, vibrant color, energetic, bold graphic composition, editorial sports photography',
            'Bright saturated color background, bold graphic shapes, energetic lifestyle aesthetic, no text, high contrast',
        ],
    }

    prompts = base.get(style_key, [])

    # Адаптируем первый промпт под найденные слова
    if word_set & {'glow', 'radiant', 'luminous'} and style_key == 'нежность':
        prompts.insert(0, 'Glowing skin close-up, radiant complexion, golden light rays, beauty editorial, luxury skincare aesthetic, film photography look')
    if word_set & {'innovation', 'future', 'smart'} and style_key == 'технологичность':
        prompts.insert(0, 'Futuristic technology interface, clean lines, glowing UI elements, dark background, precision engineering aesthetic, macro')
    if word_set & {'bold', 'power', 'energy'} and style_key == 'энергия':
        prompts.insert(0, 'Bold high-energy motion, person in powerful pose, vibrant background, dynamic lighting, lifestyle photography')

    return prompts[:3]

def analyze_posts(posts, style_data):
    """Глубокий анализ каптайнов, хэштегов, вовлечённости."""
    all_text = []
    all_tags = []
    engagement = []
    structures = {'short': 0, 'emoji_hook': 0, 'question_hook': 0, 'statement': 0}

    for p in posts:
        caption = (p.get('caption') or p.get('text') or '').lower()
        tags = p.get('hashtags') or []
        likes = p.get('like_count') or p.get('diggCount') or 0
        views = p.get('view_count') or p.get('play_count') or 0
        comments = p.get('comment_count') or 0
        username = p.get('ownerUsername') or p.get('username') or ''
        all_text.append(caption)
        all_tags.extend([t.lower().replace('#', '') for t in tags])
        structures[caption_structure(caption)] += 1
        engagement.append({
            'caption_full': caption[:200],
            'caption_short': caption[:100],
            'likes': likes,
            'views': views,
            'comments': comments,
            'username': username,
            'url': p.get('url') or p.get('reel_url') or '',
            'score': likes * 2 + comments * 5 + views // 20,
        })

    # Топ хэштеги
    tag_freq = {}
    for t in all_tags:
        if len(t) > 2:
            tag_freq[t] = tag_freq.get(t, 0) + 1
    top_tags = sorted(tag_freq.items(), key=lambda x: -x[1])[:15]

    # Частые слова
    tw = top_words(all_text)

    # Сигнальные слова стиля
    found_signals = {}
    for word in style_data['signals']:
        count = sum(1 for t in all_text if word in t)
        if count > 0:
            found_signals[word] = count

    # Топ посты по скору
    top_posts = sorted(engagement, key=lambda x: x['score'], reverse=True)[:5]

    # Паттерн длины каптайна
    lengths = [len(t) for t in all_text if t]
    avg_len = sum(lengths) // max(len(lengths), 1)
    median_len = sorted(lengths)[len(lengths)//2] if lengths else 0

    # CTA-паттерны
    cta_patterns = {
        'link_in_bio': sum(1 for t in all_text if 'link in bio' in t or 'link in profile' in t),
        'shop_now': sum(1 for t in all_text if 'shop' in t or 'buy' in t),
        'learn_more': sum(1 for t in all_text if 'learn more' in t or 'find out' in t or 'discover' in t),
        'save_this': sum(1 for t in all_text if 'save' in t),
        'follow': sum(1 for t in all_text if 'follow' in t),
        'comment': sum(1 for t in all_text if 'comment' in t or 'tell us' in t),
    }
    top_cta = sorted(cta_patterns.items(), key=lambda x: -x[1])
    top_cta = [(k, v) for k, v in top_cta if v > 0][:4]

    # Топ аккаунт по среднему вовлечению
    acc_stats = {}
    for p in engagement:
        u = p['username']
        if u:
            if u not in acc_stats:
                acc_stats[u] = {'total': 0, 'count': 0}
            acc_stats[u]['total'] += p['score']
            acc_stats[u]['count'] += 1
    top_accounts = sorted(acc_stats.items(), key=lambda x: -x[1]['total']//max(x[1]['count'],1))[:3]

    return {
        'top_tags': top_tags,
        'top_words': tw,
        'signals_found': found_signals,
        'top_posts': top_posts,
        'avg_len': avg_len,
        'median_len': median_len,
        'structures': structures,
        'cta_patterns': top_cta,
        'top_accounts': top_accounts,
        'total_posts': len(posts),
    }

def generate_insights(style_key, style_data, analysis, accounts_used):
    """Подробная Markdown-запись для knowledge/references.md — используется агентом при работе."""
    today_str = date.today().strftime('%d.%m.%Y')

    tag_str   = ' '.join(f'`#{t}`' for t, _ in analysis['top_tags'][:10])
    word_str  = ' '.join(f'`{w}`({c})' for w, c in analysis['top_words'][:12])
    signal_str = ', '.join(f'**{w}** ×{c}' for w, c in sorted(analysis['signals_found'].items(), key=lambda x: -x[1])[:6])

    struct = analysis['structures']
    total  = max(sum(struct.values()), 1)
    struct_str = (
        f"emoji/hook-открытие {struct['emoji_hook']/total*100:.0f}% | "
        f"вопрос-зацепка {struct['question_hook']/total*100:.0f}% | "
        f"утверждение {struct['statement']/total*100:.0f}% | "
        f"короткий {struct['short']/total*100:.0f}%"
    )

    cta_str = ' | '.join(f'`{k}` ×{v}' for k, v in analysis['cta_patterns']) or '— не обнаружены'

    top_acc_str = ''
    for acc, stat in analysis['top_accounts']:
        avg = stat['total'] // max(stat['count'], 1)
        top_acc_str += f"  - **@{acc}** — avg score {avg:,} по {stat['count']} постам\n"

    top_post_str = ''
    for i, p in enumerate(analysis['top_posts'][:3], 1):
        top_post_str += (
            f"  {i}. **@{p['username']}** — 👍{p['likes']:,} 👁{p['views']:,} 💬{p['comments']:,}\n"
            f"     «{p['caption_short'].strip()[:90]}…»\n"
        )

    fal_prompts = suggested_fal_prompts(style_key, analysis['top_words'])
    fal_str = '\n'.join(f"  - `{p}`" for p in fal_prompts)

    return f"""
### {style_data['name']} — авто-обучение {today_str}
> Аккаунты: {', '.join('@'+a for a in accounts_used)} | Постов: {analysis['total_posts']}

#### Словарь стиля (топ слова в каптайнах)
{word_str}

#### Сигналы стиля в текстах
{signal_str if signal_str else '— сигнальные слова не встречаются'}

#### Топ хэштеги
{tag_str}

#### Структура каптайнов
- Длина: avg {analysis['avg_len']} симв, медиана {analysis['median_len']} симв
- Структуры: {struct_str}
- CTA-паттерны: {cta_str}

#### Самые вовлекающие аккаунты
{top_acc_str}
#### Топ посты по вовлечённости
{top_post_str}
#### Дизайн-фокус: {style_data['focus']}

#### Рекомендуемые fal.ai промпты (выведены из анализа)
{fal_str}

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
    """Направление E: анализ fal.ai, новые модели, техники промптинга."""
    print("  → Режим: промпт-инжиниринг")
    today_str = date.today().strftime('%d.%m.%Y')

    found_models = []
    source_results = []

    for url in PROMPT_ENG['urls'][:3]:
        try:
            r = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(r, timeout=15) as resp:
                html = resp.read().decode(errors='ignore')
            models = list(dict.fromkeys(re.findall(r'fal-ai/[\w\-]+(?:/[\w\-]+)*', html)))[:12]
            found_models.extend(models)
            # Пытаемся найти changelog-заголовки / названия моделей
            titles = re.findall(r'<h[123][^>]*>([^<]{10,80})</h[123]>', html)[:5]
            source_results.append({'url': url, 'models': models[:6], 'titles': titles[:3]})
        except Exception as e:
            source_results.append({'url': url, 'models': [], 'titles': [], 'error': str(e)})

    unique_models = list(dict.fromkeys(found_models))[:15]

    # Группируем модели по задачам
    gen_models   = [m for m in unique_models if any(k in m for k in ['flux','imagen','stable','gen','create'])]
    edit_models  = [m for m in unique_models if any(k in m for k in ['edit','inpaint','outpaint','remove','replace','erase'])]
    video_models = [m for m in unique_models if any(k in m for k in ['video','animate','motion','kling','wan','mochi'])]
    upscale_models = [m for m in unique_models if any(k in m for k in ['upscale','enhance','super','seedvr','esrgan'])]
    other_models = [m for m in unique_models if m not in gen_models+edit_models+video_models+upscale_models]

    def _src_line(s):
        if 'error' in s:
            return f"**{s['url']}** → ошибка: {s['error']}"
        return f"**{s['url']}** → {len(s['models'])} моделей найдено"
    sources_str = '\n'.join(_src_line(s) for s in source_results)
    models_md = ''
    if gen_models:   models_md += f"- Генерация: {', '.join(f'`{m}`' for m in gen_models[:5])}\n"
    if edit_models:  models_md += f"- Редактирование: {', '.join(f'`{m}`' for m in edit_models[:5])}\n"
    if video_models: models_md += f"- Видео/анимация: {', '.join(f'`{m}`' for m in video_models[:4])}\n"
    if upscale_models: models_md += f"- Апскейл/улучшение: {', '.join(f'`{m}`' for m in upscale_models[:4])}\n"
    if other_models: models_md += f"- Прочее: {', '.join(f'`{m}`' for m in other_models[:4])}\n"

    # Telegram-текст
    tg_models_str = ''
    if gen_models:   tg_models_str += f"\n🖼 Генерация: {', '.join(gen_models[:3])}"
    if edit_models:  tg_models_str += f"\n✂️ Редактура: {', '.join(edit_models[:3])}"
    if video_models: tg_models_str += f"\n🎬 Видео: {', '.join(video_models[:2])}"
    if upscale_models: tg_models_str += f"\n🔍 Апскейл: {', '.join(upscale_models[:2])}"

    tg_text = (
        f"🧠 <b>Дизайнер — Промпт-инжиниринг fal.ai</b> | {today_str}\n\n"
        f"<b>Изучил:</b>\n"
        f"• Документацию fal.ai: {len(source_results)} источника\n"
        f"• Всего моделей обнаружено: {len(unique_models)}\n\n"
        f"<b>Карта моделей по задачам:</b>"
        f"{tg_models_str if tg_models_str else chr(10)+'— нет данных'}\n\n"
        f"<b>Что важно для наших задач:</b>\n"
        f"• Для фонов и текстур → flux/imagen модели\n"
        f"• Для обрезки и правок → edit/inpaint модели\n"
        f"• Для улучшения фото клиентов → upscale модели\n\n"
        f"✅ Записано в knowledge/references.md"
    )

    insight = f"""
### Промпт-инжиниринг fal.ai — авто-обучение {today_str}

#### Источники
{sources_str}

#### Найденные модели fal.ai по задачам
{models_md if models_md else '— нет данных'}

#### Все уникальные модели
{', '.join(f'`{m}`' for m in unique_models) if unique_models else '— не найдены'}

#### Фокус для работы дизайнера
{PROMPT_ENG['focus']}

---
"""
    return insight, "Промпт-инжиниринг fal.ai", PROMPT_ENG['emoji'], [], tg_text

def main():
    print(f"\n🎓 Designer Learning — {date.today()}")
    ensure_repo()

    style_key = pick_style()

    if style_key == '__prompt__':
        insight_text, style_name, emoji, accounts_used, tg_report = run_prompt_engineering()
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

        # Строим детальный Telegram-отчёт
        accounts_str = ', '.join('@'+a for a in accounts_used)
        top_words_str = ' '.join(f'{w}({c})' for w, c in analysis['top_words'][:8])
        top_tags_str  = ' '.join(f'#{t}' for t, _ in analysis['top_tags'][:6])
        top_signals   = sorted(analysis['signals_found'].items(), key=lambda x: -x[1])[:4]
        signals_str   = ' | '.join(f'{w} ×{c}' for w, c in top_signals) or '— не найдены'

        struct = analysis['structures']
        dominant_struct = max(struct, key=lambda k: struct[k])
        struct_labels = {
            'emoji_hook': 'открытие с emoji/hook',
            'question_hook': 'вопрос-зацепка в начале',
            'statement': 'утвердительное начало',
            'short': 'короткий (<80 симв)',
        }

        top3 = analysis['top_posts'][:3]
        top3_str = ''
        for i, p in enumerate(top3, 1):
            top3_str += f"\n{i}. @{p['username']} — 👍{p['likes']:,} 👁{p['views']:,}\n   «{p['caption_short'].strip()[:75]}…»"

        fal_prompts = suggested_fal_prompts(style_key, analysis['top_words'])
        fal_str = '\n'.join(f"• {pr[:120]}…" if len(pr) > 120 else f"• {pr}" for pr in fal_prompts[:2])

        cta_str = ' | '.join(f'{k} ×{v}' for k, v in analysis['cta_patterns'][:3]) or '— не обнаружены'

        top_acc_str = ''
        for acc, stat in analysis['top_accounts'][:2]:
            avg = stat['total'] // max(stat['count'], 1)
            top_acc_str += f"\n• @{acc} — avg score {avg:,} ({stat['count']} постов)"

        tg_report = (
            f"{emoji} <b>Дизайнер учился: {style_name}</b> | {date.today().strftime('%d.%m')}\n\n"

            f"📊 <b>Что изучил</b>\n"
            f"Аккаунты: {accounts_str}\n"
            f"Постов разобрано: {analysis['total_posts']}\n"
            f"Длина каптайнов: avg {analysis['avg_len']} / медиана {analysis['median_len']} симв\n\n"

            f"🔤 <b>Ключевые слова стиля</b>\n"
            f"{top_words_str}\n\n"

            f"🎯 <b>Сигналы бренд-голоса</b>\n"
            f"{signals_str}\n\n"

            f"🏷 <b>Топ хэштеги</b>\n"
            f"{top_tags_str}\n\n"

            f"📝 <b>Как строят каптайны</b>\n"
            f"Доминирует: {struct_labels.get(dominant_struct, dominant_struct)}\n"
            f"CTA-паттерны: {cta_str}\n\n"

            f"🏆 <b>Самые вовлекающие аккаунты</b>{top_acc_str}\n\n"

            f"🔥 <b>Топ посты</b>{top3_str}\n\n"

            f"🤖 <b>Выведенные fal.ai промпты</b>\n"
            f"{fal_str}\n\n"

            f"✅ Всё записано → knowledge/references.md\n"
            f"Дизайнер применит при следующей задаче."
        )

    # ── Обновить references.md ─────────────────────────────────────────────
    print("  → Обновляю knowledge/references.md")
    ref_path = 'agents/designer/knowledge/references.md'
    current = read_file(ref_path) or '# References — Designer Knowledge\n\n## Автообучение (новые — сверху)\n\n'
    marker = '## Автообучение (новые — сверху)\n'
    if marker in current:
        updated = current.replace(marker, f'{marker}{insight_text}')
    else:
        # Добавляем секцию если её нет
        updated = current + f'\n\n## Автообучение (новые — сверху)\n{insight_text}'
    write_file(ref_path, updated)

    # ── Обновить log.md ────────────────────────────────────────────────────
    print("  → Обновляю learning/log.md")
    log_path = 'agents/designer/learning/log.md'
    log_entry = f"\n## {date.today()} | {emoji} {style_name}\n{insight_text.strip()}\n"
    log_current = read_file(log_path) or '# Learning Log — Дизайнер\n\n> Автоматически дополняется скриптом `tools/designer_learning.py` каждый день.\n> Формат: дата | стиль | итог\n\n---\n\n<!-- Записи добавляются сверху (новые первые) -->\n'
    log_updated = log_current.replace(
        '<!-- Записи добавляются сверху (новые первые) -->',
        f'<!-- Записи добавляются сверху (новые первые) -->{log_entry}'
    )
    write_file(log_path, log_updated)

    # ── Git push ───────────────────────────────────────────────────────────
    git_push(f'learning: {style_name} — {date.today()}')

    # ── Telegram отчёт ─────────────────────────────────────────────────────
    print("  → Отправляю Telegram")
    tg(tg_report)
    print(f"  ✓ Готово. Стиль: {style_name}")

if __name__ == '__main__':
    main()
