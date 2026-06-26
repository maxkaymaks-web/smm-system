import { fal } from "@fal-ai/client";
import fs from "fs";
import https from "https";
import path from "path";
import { meter } from "../tools/lib/fal-meter.mjs";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
const falFetch = proxyAgent
  ? (url, init) => undiciFetch(url, { ...init, dispatcher: proxyAgent })
  : undefined;

const envPath = path.join(process.cwd(), ".env");
let FAL_KEY = process.env.FAL_KEY;
if (!FAL_KEY && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  FAL_KEY = envContent.match(/FAL_KEY=(.+)/)?.[1]?.trim();
}
if (!FAL_KEY) {
  console.error("FAL_KEY not found.");
  process.exit(1);
}

fal.config({ credentials: FAL_KEY, ...(falFetch ? { fetch: falFetch } : {}) });

async function downloadFile(url, outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(outputPath);
    https.get(url, (r) => {
      r.pipe(file);
      file.on("finish", () => { file.close(); resolve(outputPath); });
    }).on("error", reject);
  });
}

const ALLOWED_MODELS = new Set(["nano-banana-2", "gpt-image-2"]);

const rawArgs = process.argv.slice(2);
const positional = [];
const flags = {};
for (const a of rawArgs) {
  const m = a.match(/^--([^=]+)=(.*)$/);
  if (m) flags[m[1]] = m[2];
  else positional.push(a);
}

const [prompt, outputPath, aspectRatio = "3:4", resolution = "1K"] = positional;
const model = flags.model ?? "nano-banana-2";

console.log("DEBUG prompt=", prompt, "outputPath=", outputPath, "aspectRatio=", aspectRatio, "resolution=", resolution, "model=", model);

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);
}

let imageUrls;

try {
  let result;
  if (model === "nano-banana-2") {
    result = await meter(
      { tool: "generate-image", model: "fal-ai/nano-banana-2", params: { resolution, aspect_ratio: aspectRatio, num_images: 1, has_refs: !!imageUrls } },
      () => withTimeout(fal.run("fal-ai/nano-banana-2", {
        input: {
          prompt,
          aspect_ratio: aspectRatio,
          resolution,
          output_format: "jpeg",
          num_images: 1,
          ...(imageUrls ? { image_urls: imageUrls } : {}),
        },
      }), 120000)
    );
  }
  console.log("RESULT OK", JSON.stringify(result).slice(0, 150));
} catch (err) {
  console.error("CAUGHT", err.stack);
}
