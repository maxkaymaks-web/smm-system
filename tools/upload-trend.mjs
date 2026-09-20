#!/usr/bin/env node
/**
 * upload-trend.mjs — загрузка тренда в кабинет app.bitandpix.ru
 *
 * Usage:
 *   node tools/upload-trend.mjs <meta.json> --card <card.mp4> [--origin <origin.mp4>]
 *   node tools/upload-trend.mjs <meta.json> --origin <origin.mp4>
 *
 * Хотя бы один из --card / --origin обязателен.
 * meta.json читается как UTF-8 — не передавать текст через curl inline
 * (Git Bash на Windows шлёт CP866 вместо UTF-8).
 *
 * Без VPN-прокси: app.bitandpix.ru не режется в РФ (в отличие от fal.ai),
 * а форсировать через FAL_PROXY вредно — тот прокси до кабинета не достаёт.
 */
import fs from "fs";
import path from "path";

const API_URL = "https://app.bitandpix.ru/api/v1/trends";
const API_KEY = "NzajJYid8b97MuM5qFTsMfHBOkvmmCog";

const args = process.argv.slice(2);
const metaFile = args[0];

function flag(name) {
  const i = args.indexOf(name);
  return i !== -1 ? args[i + 1] : null;
}

const cardFile   = flag("--card");
const originFile = flag("--origin");

if (!metaFile || (!cardFile && !originFile)) {
  console.error("Usage: node tools/upload-trend.mjs <meta.json> --card <card.mp4> [--origin <origin.mp4>]");
  console.error("       node tools/upload-trend.mjs <meta.json> --origin <origin.mp4>");
  process.exit(1);
}

const meta = JSON.parse(fs.readFileSync(metaFile, "utf-8"));

const form = new FormData();
form.set("meta", JSON.stringify(meta));

if (cardFile) {
  form.set("card", new Blob([fs.readFileSync(cardFile)], { type: "video/mp4" }), path.basename(cardFile));
}
if (originFile) {
  form.set("origin", new Blob([fs.readFileSync(originFile)], { type: "video/mp4" }), path.basename(originFile));
}

console.error(`Uploading trend "${meta.title}"...`);

const res = await fetch(API_URL, {
  method: "POST",
  headers: { "X-Trends-Upload-Key": API_KEY },
  body: form,
});

const body = await res.json();
if (!res.ok || body.error) {
  console.error("ОШИБКА:", JSON.stringify(body, null, 2));
  process.exit(1);
}

console.log(JSON.stringify(body, null, 2));
console.error(`\nНомер тренда: ${body.trend?.id}`);
