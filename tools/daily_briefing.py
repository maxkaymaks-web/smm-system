#!/usr/bin/env python3
"""Daily SMM briefing — bit&pix. Uses only stdlib (no pip needed)."""

import json, urllib.request, urllib.parse, os
from datetime import date
from pathlib import Path

def _load_env():
    env_path = Path(__file__).parent.parent / '.env'
    result = {}
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if '=' in line and not line.startswith('#'):
                k, v = line.split('=', 1)
                result[k.strip()] = v.strip()
    return result

_env = _load_env()
GH    = _env.get('GITHUB_PAT', '')
REPO  = 'maxkaymaks-web/smm-system'
TG    = '8625487536:AAG0erfiGf1C6btYTAkzVqVfhsa9OGjfH90'
CID   = 1791618146
today = date.today()

MO = {1:'января',2:'февраля',3:'марта',4:'апреля',5:'мая',6:'июня',
      7:'июля',8:'августа',9:'сентября',10:'октября',11:'ноября',12:'декабря'}

def gh_get(url):
    req = urllib.request.Request(url, headers={
        'Authorization': 'token ' + GH,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'smm-briefing'
    })
    with urllib.request.urlopen(req) as r:
        return r.read().decode()

def tg_send(text):
    data = json.dumps({'chat_id': CID, 'text': text}).encode()
    req = urllib.request.Request(
        f'https://api.telegram.org/bot{TG}/sendMessage',
        data=data,
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())

def days_to(ds):
    try:
        d, m = int(ds.split('.')[0]), int(ds.split('.')[1])
        pub = date(today.year, m, d)
        if pub < today:
            pub = date(today.year + 1, m, d)
        return (pub - today).days
    except:
        return 999

def mst(s):
    s = s.lower()
    if 'опубликовано' in s: return 'pub'
    if 'готово' in s: return 'ready'
    if 'на согласовании' in s: return 'rev'
    if 'ждём' in s or 'ждем' in s: return 'wait'
    return 'draft'

# Get project list
raw = gh_get(f'https://api.github.com/repos/{REPO}/contents/projects')
projs = [i['name'] for i in json.loads(raw) if isinstance(i, dict) and i.get('type') == 'dir']

fire, work, mat, rev, stat = [], [], [], [], {}

for pr in projs:
    try:
        txt = gh_get(f'https://raw.githubusercontent.com/{REPO}/main/projects/{pr}/content-plan.md')
    except:
        continue
    posts = []
    for line in txt.splitlines():
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        if len(cells) >= 6 and cells[0].strip().isdigit():
            posts.append({'n': cells[0], 'dt': cells[1], 'th': cells[4], 'st': mst(cells[-1])})

    c = {'tot': len(posts), 'pub': 0, 'draft': 0, 'wait': 0, 'rev': 0, 'ready': 0}
    for p in posts:
        c[p['st']] = c.get(p['st'], 0) + 1
        dl = days_to(p['dt'])
        lb = f"{pr} #{p['n']} — {p['th']} — {p['dt']}"
        if p['st'] in ('draft', 'wait') and dl <= 3:
            fire.append(lb + (' (ПРОСРОЧЕН)' if dl < 0 else f' (через {dl} дн)'))
        elif p['st'] == 'draft' and 4 <= dl <= 7:
            work.append(lb + f' (через {dl} дн)')
        if p['st'] == 'wait' and dl <= 7:
            mat.append(lb + f' (через {dl} дн)')
        if p['st'] == 'rev':
            rev.append(lb)
    stat[pr] = c

# Build message
out = [f'📅 Брифинг {today.day} {MO[today.month]} {today.year}']
if fire:
    out.append('\n🔥 ГОРИТ')
    out += ['• ' + x for x in fire]
if work:
    out.append('\n📋 В РАБОТЕ (4–7 дней)')
    out += ['• ' + x for x in work]
if mat:
    out.append('\n📦 ЗАПРОСИТЬ МАТЕРИАЛЫ')
    out += ['• ' + x for x in mat]
if rev:
    out.append('\n⏳ НА СОГЛАСОВАНИИ')
    out += ['• ' + x for x in rev]
if not fire and not work and not mat:
    out.append('✅ Всё в порядке, срочных задач нет.')
out.append('\n📊 Статистика')
for pr, c in stat.items():
    out.append(f"{pr}: {c['tot']} постов | опубл. {c['pub']} | готово {c['ready']} | draft {c['draft']} | ждём {c['wait']} | согл. {c['rev']}")

txt = '\n'.join(out)
print(txt)
result = tg_send(txt)
print('Telegram:', result.get('ok'))
