# SMM Agent System — Design Spec
Date: 2026-04-19
Status: Approved

## Overview

Automated SMM system for small business clients. Claude Code = brain + agents. SMM girl handles client communication, post review, and manual publishing. Architecture: Variant B (universal executor agents + per-project orchestrators + global rules layer).

---

## Architecture

### Three-layer context model

Every agent loads context in this order:
1. `global/rules.md` — formatting rules, taboos, trends (all agents, all projects)
2. `agents/{role}/skill.md` — role-specific rules
3. `projects/{client}/context.md` — client-specific brand, tone, audience
4. Task TZ from orchestrator — specific task instructions

Updating `global/rules.md` propagates to all agents across all projects on next run.

### Agent roster (build priority order)

| Priority | Agent | Role |
|----------|-------|------|
| P0 | **Copywriter** | Writes posts for VK (primary), adaptable for TG/MAX |
| P0 | **Designer** | HTML/CSS post layout → PNG via Puppeteer |
| P0 | **Girl skills** | review-post, apply-feedback, export-post |
| P1 | **Orchestrator** | Dispatches agents, quality control, reads feedback |
| P1 | **Content Planner** | Generates weekly/monthly plan from strategy |
| P2 | **Analytics** | Reads metrics, updates strategy and global rules |
| skip | ~~Brief agent~~ | Deferred |

### Token optimization
- Brand voice + strategy cached in agent system prompt
- Each agent loads only its context slice (not full project)
- Haiku for formatting/export tasks, Sonnet for copywriting, Sonnet/Opus for strategy (rare)
- Stateless executors: get full TZ, return result, no memory needed between runs

---

## File Structure

```
smm-system/
  global/
    rules.md              ← formatting, taboos, trends — shared by all
    standards.md          ← post quality criteria

  agents/
    orchestrator/
      skill.md            ← main: dispatch, quality control
    copywriter/
      skill.md            ← writes posts (VK-first)
    designer/
      skill.md            ← HTML/CSS layout + image API prompt
    content-planner/
      skill.md            ← generates content plan from strategy
    analytics/
      skill.md            ← reads metrics, updates strategy

  tools/
    render-html.js        ← HTML → PNG via Puppeteer (pixel-perfect)
    sync.sh               ← girl's one-command git sync

  projects/
    {client-slug}/
      context.md          ← brand, tone, audience, forbidden topics
      strategy.md         ← content strategy
      content-plan.md     ← current plan (week/month)
      orchestrator.md     ← project orchestrator (knows client, dispatches executors)
      posts/
        drafts/           ← agent output (html + png pairs)
        inbox/            ← ready for girl's review
        approved/         ← girl approved
        published/        ← published
      feedback/           ← client feedback files
      assets/
        images/           ← generated photos
      analytics/          ← metrics files

  girl-workspace/
    README.md             ← girl's instruction
    skills/
      review-post.md
      apply-feedback.md
      export-post.md

  docs/
    dev-guide.md          ← how to build and train agents
    superpowers/specs/    ← design docs
```

---

## Post Production Pipeline

```
Orchestrator reads content-plan.md
  → dispatches Copywriter with TZ (global/rules + client context + task)
  → Copywriter writes post-NN.md to posts/drafts/

  → dispatches Designer with post text
  → Designer writes post-NN.html to posts/drafts/
  → tools/render-html.js → post-NN.png (pixel-perfect)

  → Orchestrator quality check (against global/standards.md)
  → moves post-NN.md + post-NN.html + post-NN.png to posts/inbox/

Girl pulls from GitHub (girl branch)
  → opens CC girl-workspace
  → uses review-post skill: reads post, edits, approves
  → moves to posts/approved/
  → pushes to GitHub

Developer merges girl → main

Client gives feedback → girl writes feedback/fb-NN.md → pushes
Orchestrator reads feedback/ on next run → dispatches revision
```

---

## HTML → PNG Conversion

- Tool: `tools/render-html.js` using Puppeteer (headless Chromium)
- Pixel-perfect: same fonts, CSS, layout as HTML
- Output: PNG at 2x resolution for crisp display
- Both HTML and PNG travel together through the pipeline
- Girl sees PNG; HTML available for edits if needed

---

## GitHub Workflow

```
repo: smm-system
  main   ← dev branch (agents, global/, development)
  girl   ← girl's branch (posts/, feedback/ only)
```

Girl's daily workflow — single script `./sync.sh`:
```bash
# Morning: get new tasks
git pull origin girl

# After work: send back
git add posts/ feedback/
git commit -m "done"
git push origin girl
```

Developer merges `girl → main` after reviewing approved posts.

---

## Development Phases

### Phase 0 — Foundation
- Create full folder structure
- Write `global/rules.md` and `global/standards.md`
- Set up `tools/render-html.js` (Puppeteer, HTML → PNG)
- Create first client project folder + context.md
- Initialize GitHub repo, create `girl` branch
- Create `sync.sh` for girl

### Phase 1 — Post Machine (priority)
- `agents/copywriter/skill.md` — VK-first post writing
- `agents/designer/skill.md` — HTML/CSS post design
- Test full cycle: draft → inbox → girl review → approved
- `girl-workspace/skills/review-post.md`
- `girl-workspace/skills/apply-feedback.md`
- `girl-workspace/skills/export-post.md`
- `girl-workspace/README.md` — girl's instruction

### Phase 2 — Orchestration
- `agents/orchestrator/skill.md`
- `agents/content-planner/skill.md`
- Per-client `orchestrator.md`
- Scheduled task: auto-run on schedule
- Dev guide: how to build and train agents

### Phase 3 — Analytics & Self-improvement
- `agents/analytics/skill.md`
- Mechanism: analytics output → updates global/rules.md
- Self-improvement loop documented

---

## Instructions Needed (deliverables)

1. **Dev guide** (`docs/dev-guide.md`) — how to create, configure, and train agents
2. **Girl guide** (`girl-workspace/README.md`) — daily workflow, how to review posts, apply feedback, use sync.sh

---

## Out of Scope (this spec)

- Brief agent (deferred)
- Telegram bot interface (future V3 upgrade)
- Direct social media API publishing (manual for now)
- Video editing agent (future)
