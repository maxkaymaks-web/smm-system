/**
 * net-proxy.mjs — включает глобальный прокси для Node-fetch, если он задан.
 *
 * Зачем: @fal-ai/client ходит через встроенный в Node `fetch` (undici), а он
 * НЕ читает HTTPS_PROXY/ALL_PROXY из окружения сам по себе. Чтобы трафик пошёл
 * через VPN-прокси (иначе из РФ fal.ai режется и валит ECONNRESET на аплоадах),
 * нужно явно поставить ProxyAgent глобальным диспетчером. Это side-effect-модуль:
 * импортируется ради эффекта (`import './net-proxy.mjs'`), сам ничего не экспортит.
 *
 * Прокси берётся (по приоритету): FAL_PROXY → HTTPS_PROXY → ALL_PROXY (env или .env).
 * Если ни один не задан — модуль ничего не делает (прямое соединение, как раньше).
 *
 * Операторам под VPN: в .env добавить строку
 *   FAL_PROXY=http://127.0.0.1:10809      # адрес локального прокси VPN-клиента
 * Подробнее — docs/fal-troubleshooting.md.
 */
import fs from 'node:fs';
import path from 'node:path';

function resolveProxyUrl() {
  const fromEnv =
    process.env.FAL_PROXY ||
    process.env.HTTPS_PROXY || process.env.https_proxy ||
    process.env.ALL_PROXY || process.env.all_proxy;
  if (fromEnv && fromEnv.trim()) return fromEnv.trim();

  // Тулзы часто запускают с голым окружением — подхватываем FAL_PROXY из .env.
  const p = path.join(process.cwd(), '.env');
  if (fs.existsSync(p)) {
    const m = fs.readFileSync(p, 'utf8').match(/^FAL_PROXY=(.+)$/m);
    if (m && m[1].trim()) return m[1].trim();
  }
  return null;
}

const proxyUrl = resolveProxyUrl();
if (proxyUrl) {
  try {
    const { ProxyAgent, setGlobalDispatcher } = await import('undici');
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
    process.stderr.write(`[net-proxy] fal.ai через прокси ${proxyUrl}\n`);
  } catch (e) {
    process.stderr.write(
      `[net-proxy] WARN: не включился прокси ${proxyUrl}: ${e.message}\n` +
      `  → проверь, что установлен undici (npm install undici)\n`
    );
  }
}
