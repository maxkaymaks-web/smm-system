/**
 * fal-meter.mjs — обёртка для вызовов fal.ai с логированием расхода.
 *
 * Использование:
 *   import { meter } from './lib/fal-meter.mjs';
 *   const result = await meter({ tool: 'generate-image', model: 'fal-ai/nano-banana-2', params: { resolution: '1K' } },
 *     () => fal.run('fal-ai/nano-banana-2', { input: ... }));
 *
 * Пишет в state/fal-spend.jsonl по строке JSON на каждый вызов:
 *   {"ts": "2026-05-12T13:45:00.000Z", "tool": "...", "model": "...", "params": {...}, "estimated_usd": 0.08, "ok": true}
 *
 * Прайс берётся из tools/lib/fal-prices.json. Неизвестная модель → estimated_usd=null + warning в stderr.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const PRICES_PATH = path.join(HERE, 'fal-prices.json');
const SPEND_LOG = path.join(REPO_ROOT, 'state', 'fal-spend.jsonl');

let _prices = null;
function loadPrices() {
  if (_prices) return _prices;
  _prices = JSON.parse(fs.readFileSync(PRICES_PATH, 'utf8'));
  return _prices;
}

function estimate(model, params, result) {
  const prices = loadPrices();
  const m = prices.models[model];
  if (!m) {
    process.stderr.write(`[fal-meter] WARN: нет цены для модели "${model}" в fal-prices.json\n`);
    return null;
  }
  switch (m.unit) {
    case 'per_image': {
      const n = result?.data?.images?.length ?? params?.num_images ?? 1;
      return +(m.price_usd * n).toFixed(6);
    }
    case 'per_image_variant': {
      const v = params?.[m.variant_field] ?? m.default_variant;
      const price = m.variants[v] ?? m.variants[m.default_variant];
      const n = result?.data?.images?.length ?? params?.num_images ?? 1;
      return +(price * n).toFixed(6);
    }
    case 'per_output_megapixel': {
      const img = result?.data?.image ?? result?.data?.images?.[0];
      if (img?.width && img?.height) {
        const mp = (img.width * img.height) / 1_000_000;
        return +(m.price_usd * mp).toFixed(6);
      }
      return m.fallback_per_image_usd ?? null;
    }
    case 'per_image_estimate':
    case 'per_request':
      return m.price_usd;
    default:
      process.stderr.write(`[fal-meter] WARN: неизвестный unit "${m.unit}" для модели "${model}"\n`);
      return null;
  }
}

function appendLog(entry) {
  fs.mkdirSync(path.dirname(SPEND_LOG), { recursive: true });
  fs.appendFileSync(SPEND_LOG, JSON.stringify(entry) + '\n');
}

/**
 * Запустить fal-вызов и записать стоимость в state/fal-spend.jsonl.
 * @param {object} ctx — { tool, model, params }
 * @param {Function} runFn — async function без аргументов, возвращающая fal result
 */
export async function meter(ctx, runFn) {
  const ts = new Date().toISOString();
  try {
    const result = await runFn();
    const estimated_usd = estimate(ctx.model, ctx.params ?? {}, result);
    appendLog({
      ts,
      tool: ctx.tool,
      model: ctx.model,
      params: ctx.params ?? {},
      estimated_usd,
      ok: true,
    });
    return result;
  } catch (err) {
    appendLog({
      ts,
      tool: ctx.tool,
      model: ctx.model,
      params: ctx.params ?? {},
      estimated_usd: 0,
      ok: false,
      error: String(err?.message ?? err).slice(0, 200),
    });
    throw err;
  }
}
