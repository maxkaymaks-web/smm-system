#!/usr/bin/env python3
"""
Apify scraper — unified runner for Instagram, TikTok, VK.

Usage:
  python3 tools/apify/scraper.py --platform instagram --handle @username --limit 50
  python3 tools/apify/scraper.py --platform tiktok --handle @username --limit 50
  python3 tools/apify/scraper.py --platform vk --handle username_or_id --limit 50

Output: JSON printed to stdout + saved to tools/apify/output/{platform}_{handle}_{date}.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent.parent / ".env")

TOKEN = os.getenv("APIFY_TOKEN")
if not TOKEN:
    sys.exit("APIFY_TOKEN not set in .env")

BASE_URL = "https://api.apify.com/v2"
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

ACTORS = {
    "instagram": "shu8hvrXbJbY3Eb9W",       # Apify Instagram Scraper
    "tiktok":    "clockworks/tiktok-scraper", # TikTok Scraper
    "vk":        "rL41xti0ZWnH2cWkU",         # VK Posts Scraper
}

def build_input(platform: str, handle: str, limit: int) -> dict:
    handle_clean = handle.lstrip("@")
    if platform == "instagram":
        return {
            "directUrls": [f"https://www.instagram.com/{handle_clean}/"],
            "resultsType": "posts",
            "resultsLimit": limit,
        }
    if platform == "tiktok":
        return {
            "profiles": [handle_clean],
            "profileScrapeSections": ["videos"],
            "profileSorting": "latest",
            "resultsPerPage": limit,
        }
    if platform == "vk":
        return {
            "startUrls": [{"url": f"https://vk.com/{handle_clean}"}],
            "maxPostCount": limit,
        }
    raise ValueError(f"Unknown platform: {platform}")


def run_actor(actor_id: str, actor_input: dict, timeout: int = 300) -> list:
    # Start run
    resp = requests.post(
        f"{BASE_URL}/acts/{actor_id}/runs",
        headers=HEADERS,
        json=actor_input,
        params={"waitForFinish": min(timeout, 300)},
    )
    resp.raise_for_status()
    run = resp.json()["data"]
    run_id = run["id"]
    dataset_id = run["defaultDatasetId"]
    status = run["status"]

    print(f"[apify] run {run_id} — status: {status}", file=sys.stderr)

    # Poll if not finished yet
    if status not in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
        for _ in range(60):
            time.sleep(5)
            r = requests.get(f"{BASE_URL}/acts/{actor_id}/runs/{run_id}", headers=HEADERS)
            r.raise_for_status()
            status = r.json()["data"]["status"]
            print(f"[apify] polling... {status}", file=sys.stderr)
            if status in ("SUCCEEDED", "FAILED", "ABORTED", "TIMED-OUT"):
                break

    if status != "SUCCEEDED":
        sys.exit(f"Actor run ended with status: {status}")

    # Fetch dataset
    items_resp = requests.get(
        f"{BASE_URL}/datasets/{dataset_id}/items",
        headers=HEADERS,
        params={"format": "json", "clean": "true"},
    )
    items_resp.raise_for_status()
    return items_resp.json()


def normalize(platform: str, items: list) -> list:
    """Normalize raw Apify output to unified format."""
    out = []
    for item in items:
        if platform == "instagram":
            out.append({
                "platform": "instagram",
                "id": item.get("id"),
                "url": item.get("url"),
                "type": item.get("type"),               # Image / Video / Sidecar
                "timestamp": item.get("timestamp"),
                "likes": item.get("likesCount", 0),
                "comments": item.get("commentsCount", 0),
                "views": item.get("videoViewCount"),
                "caption": item.get("caption", ""),
                "hashtags": item.get("hashtags", []),
                "owner": item.get("ownerUsername"),
            })
        elif platform == "tiktok":
            out.append({
                "platform": "tiktok",
                "id": item.get("id"),
                "url": item.get("webVideoUrl"),
                "type": "video",
                "timestamp": item.get("createTimeISO"),
                "likes": item.get("diggCount", 0),
                "comments": item.get("commentCount", 0),
                "views": item.get("playCount", 0),
                "shares": item.get("shareCount", 0),
                "saves": item.get("collectCount", 0),
                "caption": item.get("text", ""),
                "hashtags": [h.get("name") for h in item.get("hashtags", [])],
                "owner": item.get("authorMeta", {}).get("name"),
            })
        elif platform == "vk":
            out.append({
                "platform": "vk",
                "id": item.get("id"),
                "url": item.get("url"),
                "type": item.get("type", "post"),
                "timestamp": item.get("date"),
                "likes": item.get("likes", {}).get("count", 0),
                "comments": item.get("comments", {}).get("count", 0),
                "views": item.get("views", {}).get("count", 0),
                "reposts": item.get("reposts", {}).get("count", 0),
                "caption": item.get("text", ""),
                "hashtags": [],
                "owner": item.get("ownerId"),
            })
    return out


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--platform", required=True, choices=["instagram", "tiktok", "vk"])
    parser.add_argument("--handle", required=True, help="@username or username")
    parser.add_argument("--limit", type=int, default=50)
    parser.add_argument("--raw", action="store_true", help="Skip normalization, dump raw JSON")
    args = parser.parse_args()

    actor_id = ACTORS[args.platform]
    actor_input = build_input(args.platform, args.handle, args.limit)

    print(f"[apify] starting {args.platform} scrape for {args.handle} (limit={args.limit})", file=sys.stderr)
    items = run_actor(actor_id, actor_input)

    result = items if args.raw else normalize(args.platform, items)

    # Save to file
    out_dir = Path(__file__).parent / "output"
    out_dir.mkdir(exist_ok=True)
    handle_slug = args.handle.lstrip("@").replace("/", "_")
    date_str = datetime.now().strftime("%Y-%m-%d")
    out_path = out_dir / f"{args.platform}_{handle_slug}_{date_str}.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2))

    print(f"[apify] {len(result)} items saved to {out_path}", file=sys.stderr)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
