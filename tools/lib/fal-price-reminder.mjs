#!/usr/bin/env node
/**
 * fal-price-reminder.mjs — напоминалка раз в месяц проверить актуальность fal-prices.json.
 *
 * fal.ai цены иногда меняются без громких анонсов. Авто-скрейпинг fragile
 * (Next.js, динамические цены), поэтому раз в месяц шлём в «Бабки» список
 * ссылок на используемые модели — Pavel пробегает глазами за 2 минуты и
 * обновляет fal-prices.json + _last_updated если что.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PRICES = JSON.parse(fs.readFileSync(path.join(HERE, 'fal-prices.json'), 'utf8'));

const lastUpdated = PRICES._last_updated;
const daysSince = Math.floor((Date.now() - new Date(lastUpdated).getTime()) / 86400_000);

const lines = [
  `🛠 Проверка прайс-листа fal.ai`,
  ``,
  `Последнее обновление tools/lib/fal-prices.json: ${lastUpdated} (${daysSince} дн назад)`,
  ``,
  `Открой каждую страницу, сверь цену с fal-prices.json. Если расходится — обнови файл и `,
  `подними _last_updated. Цена обычно в шапке модели или в разделе "Pricing".`,
  ``,
];

for (const [id, info] of Object.entries(PRICES.models)) {
  const url = `https://fal.ai/models/${id}`;
  const ourPrice = info.unit === 'per_image_variant'
    ? `variants ${JSON.stringify(info.variants)}`
    : `${info.price_usd} (${info.unit})`;
  lines.push(`• ${id}`);
  lines.push(`  у нас: ${ourPrice}`);
  lines.push(`  ${url}`);
  lines.push('');
}

const text = lines.join('\n');

const sendProc = spawnSync('node', ['tools/tg-send.mjs', 'finance', '--text', text], {
  cwd: REPO_ROOT, encoding: 'utf8', stdio: 'inherit',
});
process.exit(sendProc.status ?? 0);
