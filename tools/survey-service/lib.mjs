// Чистые хелперы survey-service (юнит-тестируемые, без сайд-эффектов).

const TRANSLIT = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
  и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
  с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
};

// Бренд → безопасный кусок имени файла: транслит, латиница, без пробелов.
export function slugify(input) {
  const s = String(input ?? '').toLowerCase().trim();
  let out = '';
  for (const ch of s) out += TRANSLIT[ch] ?? ch;
  out = out.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return out.slice(0, 40) || 'client';
}

// Ключ заявки в S3: префикс + дата + слаг бренда + случайный хвост (без коллизий).
export function buildIntakeKey(prefix, brand, now, rand) {
  const date = now.toISOString().slice(0, 10);
  const p = prefix.endsWith('/') ? prefix : prefix + '/';
  return `${p}${date}-${slugify(brand)}-${rand}.json`;
}

// Развернуть ответы в читаемые пары «вопрос → ответ» по описанию формы survey.json.
// Берёт title вопроса (или name, если title нет), пропускает пустые и служебные.
export function flattenAnswers(surveyDef, answers) {
  const titles = {};
  for (const page of surveyDef.pages ?? []) {
    for (const el of page.elements ?? []) {
      if (el.name) titles[el.name] = el.title || el.name;
    }
  }
  const fmt = (v) => (Array.isArray(v) ? v.join(', ') : String(v));
  const out = [];
  for (const [name, value] of Object.entries(answers ?? {})) {
    if (name.startsWith('_')) continue; // служебные (honeypot и т.п.)
    if (value === '' || value == null) continue;
    out.push({ name, title: titles[name] || name, answer: fmt(value) });
  }
  return out;
}
