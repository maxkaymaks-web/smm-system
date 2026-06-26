// Ручная замена upload-session.mjs для Windows.
// Заливает summary.md + raw.jsonl + meta.json (минимальный) + pointer.json
// по той же S3-структуре, которую ожидает finalize procedure.

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

const ROOT = process.cwd();

// .env
for (const line of fs.readFileSync(path.join(ROOT, ".env"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.+)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const BUCKET = process.env.S3_BUCKET;
const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: process.env.S3_REGION ?? "ru-1",
  forcePathStyle: true,
  credentials: { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY },
});

const PROJECT_ID = "Bioprintex_Limatex";
const SESSION_ID = "28603891-db45-4544-9f2e-e7f357956e1c";
const SUMMARY_PATH = path.join(ROOT, "tmp", "session-summary.md");
const JSONL_PATH = path.join(os.homedir(), ".claude", "projects", "C--Users--------------Claude", `${SESSION_ID}.jsonl`);

// parse JSONL → meta
const events = [];
for (const line of fs.readFileSync(JSONL_PATH, "utf8").split("\n")) {
  if (!line.trim()) continue;
  try { events.push(JSON.parse(line)); } catch {}
}

function pickFirstTs() { for (const e of events) if (e.timestamp) return e.timestamp; return null; }
function pickLastTs()  { for (let i = events.length - 1; i >= 0; i--) if (events[i].timestamp) return events[i].timestamp; return null; }

const startedAt = pickFirstTs();
const endedAt = pickLastTs();
const durationMs = startedAt && endedAt ? (new Date(endedAt) - new Date(startedAt)) : null;

// первое user-сообщение
let firstUserPrompt = null;
for (const e of events) {
  if (e.type === "user" && e.message?.content) {
    const c = typeof e.message.content === "string" ? e.message.content : JSON.stringify(e.message.content);
    if (c && !c.startsWith("[") && c.length > 5) { firstUserPrompt = c.slice(0, 500); break; }
  }
}

// usage
let inputTokens = 0, outputTokens = 0, cacheRead = 0, cacheCreate = 0;
const toolUses = {};
for (const e of events) {
  const u = e.message?.usage;
  if (u) {
    inputTokens   += u.input_tokens ?? 0;
    outputTokens  += u.output_tokens ?? 0;
    cacheRead     += u.cache_read_input_tokens ?? 0;
    cacheCreate   += u.cache_creation_input_tokens ?? 0;
  }
  const content = e.message?.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block.type === "tool_use" && block.name) toolUses[block.name] = (toolUses[block.name] ?? 0) + 1;
    }
  }
}

const meta = {
  session_id: SESSION_ID,
  project_id: PROJECT_ID,
  started_at: startedAt,
  ended_at: endedAt,
  duration_ms: durationMs,
  event_count: events.length,
  first_user_prompt: firstUserPrompt,
  usage: {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cache_read_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreate,
  },
  tool_uses: toolUses,
  title: "Bioprintex пост #05 — карусель «Учёный в поле» (фоторепортаж + ESG, 4 слайда, 6 итераций дизайна)",
  upload_note: "manual upload via tmp/upload-session-manual.mjs (Windows; upload-session.mjs не работает на Win-путях)",
};

const dateStr = endedAt ? endedAt.slice(0, 10) : new Date().toISOString().slice(0, 10);
const [yyyy, mm, dd] = dateStr.split("-");
const projectPrefix = `logs/claude-code/by-project/${PROJECT_ID}/${dateStr}/${SESSION_ID}`;
const datePrefix = `logs/claude-code/by-date/${yyyy}/${mm}/${dd}`;

async function put(key, body, contentType) {
  await s3.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
  console.log(`✓ ${key}`);
}

await put(`${projectPrefix}/summary.md`, fs.readFileSync(SUMMARY_PATH), "text/markdown");
await put(`${projectPrefix}/raw.jsonl`, fs.readFileSync(JSONL_PATH), "application/jsonl");
await put(`${projectPrefix}/meta.json`, JSON.stringify(meta, null, 2), "application/json");

const pointer = {
  path: `by-project/${PROJECT_ID}/${dateStr}/${SESSION_ID}`,
  project_id: PROJECT_ID,
  title: meta.title,
  ended_at: endedAt,
};
await put(`${datePrefix}/${SESSION_ID}.pointer.json`, JSON.stringify(pointer, null, 2), "application/json");

// update _index/all-sessions.jsonl (read-modify-write)
const indexKey = `logs/claude-code/_index/all-sessions.jsonl`;
let existingIndex = "";
try {
  const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: indexKey }));
  existingIndex = await new Promise((resolve) => {
    const chunks = [];
    r.Body.on("data", c => chunks.push(c));
    r.Body.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  });
} catch (e) {
  if (e.name !== "NoSuchKey") throw e;
}
const indexEntry = JSON.stringify({
  session_id: SESSION_ID, project_id: PROJECT_ID, ended_at: endedAt, title: meta.title,
  duration_ms: durationMs, event_count: events.length,
});
const lines = existingIndex.split("\n").filter(l => l.trim() && !l.includes(`"session_id":"${SESSION_ID}"`));
lines.push(indexEntry);
await put(indexKey, lines.join("\n") + "\n", "application/jsonl");

console.log("\n=== Финализация завершена ===");
console.log(`Title:     ${meta.title}`);
console.log(`Duration:  ${durationMs ? Math.round(durationMs / 1000) + "s" : "?"} (${events.length} событий)`);
console.log(`Tokens:    in ${inputTokens.toLocaleString()} · out ${outputTokens.toLocaleString()} · cache_read ${cacheRead.toLocaleString()}`);
console.log(`Tools:     ${Object.entries(toolUses).sort((a,b)=>b[1]-a[1]).map(([n,c])=>`${n}×${c}`).join(", ")}`);
console.log(`S3 path:   s3://${BUCKET}/${projectPrefix}/`);
