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
fal.config({ credentials: FAL_KEY, ...(falFetch ? { fetch: falFetch } : {}) });

function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);
}

try {
  const result = await meter(
    { tool: "test", model: "fal-ai/nano-banana-2", params: {} },
    () => withTimeout(fal.run("fal-ai/nano-banana-2", {
      input: { prompt: "a red apple on white background", aspect_ratio: "1:1", resolution: "1K", output_format: "jpeg", num_images: 1 },
    }), 120000)
  );
  console.log("RESULT OK", JSON.stringify(result).slice(0, 150));
} catch (e) {
  console.error("CAUGHT", e.stack);
}
