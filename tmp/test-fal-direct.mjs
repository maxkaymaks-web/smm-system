import { fal } from "@fal-ai/client";
import fs from "fs";
import { ProxyAgent, fetch as undiciFetch } from "undici";

const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
const proxyAgent = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;
const falFetch = proxyAgent
  ? (url, init) => undiciFetch(url, { ...init, dispatcher: proxyAgent })
  : undefined;

const FAL_KEY = fs.readFileSync(".env", "utf8").match(/FAL_KEY=(.+)/)[1].trim();
fal.config({ credentials: FAL_KEY, ...(falFetch ? { fetch: falFetch } : {}) });

try {
  const result = await fal.run("fal-ai/nano-banana-2", {
    input: { prompt: "a red apple on white background", aspect_ratio: "1:1", resolution: "1K", num_images: 1, output_format: "jpeg" },
  });
  console.log("RESULT OK", JSON.stringify(result).slice(0, 150));
} catch (e) {
  console.error("CAUGHT", e.stack);
}
