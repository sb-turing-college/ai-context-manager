# AI Context Manager

A local **context manager**: dual-chat (draft vs audit/verify), session-aware prompting, artifact versioning, tool use, and **local RAG** (ChromaDB) — packaged as a fullstack monorepo for portfolio demonstration.

**Problem:** LLM chats lose project state across sessions; drafts drift from requirements; “just paste more context” does not scale. Teams need explicit context layers (profile, status, summaries, retrieval) and inspectable artifact workflows.

**Project goal:** Show a practical architecture for:

1. **Session-wide context** — user facts, project status, summaries feeding the prompt  
2. **Local semantic search** — Chroma embeddings over session material  
3. **Dual writing modes** — create/edit artifacts with history/diffs alongside critique flows  
4. **Tool use** — structured function calling to update drafts / project state  

**What was built:** A FastAPI backend (SQLite + Chroma + multi-provider LLMs) and a React UI for projects, sessions, workshop/library, and dual-chat — runnable locally with one start script.

**How it works:** The UI talks to `/api/v1`. The backend assembles prompts from stored context modules and optional RAG hits, calls Gemini and/or Claude, streams responses, and persists messages, usage, and artifacts. Keys stay in `backend/.env`; data stays on your machine.

> **Information for Recruiters & Hiring Managers**  
> This monorepo is a **personal portfolio project** (not a commercial SaaS, **not** a Turing College assignment). Clone it, run it locally, and explore the implementation.  
> Start with this README and [ARCHITECTURE.md](ARCHITECTURE.md) (context flow, optional RAG, dual-chat, artifacts). An overview PDF may be added later.  
> Source code is **AGPL-3.0**; marked portfolio docs/assets are **CC BY-NC-ND 4.0** (see [LICENSE-ASSETS.md](LICENSE-ASSETS.md)).  
> Companion flagship (Turing College capstone, separate repo): [turing-capstone-escape-room-agent](https://github.com/sb-turing-college/turing-capstone-escape-room-agent).

Architecture (incl. A1 trust model and trade-offs): [ARCHITECTURE.md](ARCHITECTURE.md#5-design-decisions--trade-offs) · Disclaimer: [DISCLAIMER.md](DISCLAIMER.md)

## What's inside

| Folder | Description | Details |
|--------|-------------|---------|
| [`backend/`](backend/) | FastAPI, SQLite, Chroma, LLM + tools | [backend/README.md](backend/README.md) |
| [`ui/`](ui/) | React + Vite dual-chat / workshop UI | [ui/README.md](ui/README.md) |
| [`docs/`](docs/) | Curated public docs (overview PDF optional later) | [docs/README.md](docs/README.md) |
| [`scripts/`](scripts/) | `start-all` helpers | — |

## Evaluation (automated)

| Area | Notes |
|------|--------|
| Backend | pytest suite under `backend/tests/` (`uv run pytest`) |
| Frontend | Vitest under `ui/` |
| Manual | Dual-chat, draft tools, library, and search against a local `.env` with provider keys |

Live quality depends on chosen models and prompts — treat demos as illustrative, not a fixed benchmark score.

## Ethical considerations

- **Privacy:** No accounts; local SQLite/Chroma only ([ARCHITECTURE.md](ARCHITECTURE.md#6-ethics-and-limits) §6).  
- **Honesty:** Single-operator trust model — **not** multi-tenant security.  
- **Safety:** Disclaimer/API-terms accept gate before LLM routes; optional Mistral moderation when `MISTRAL_API_KEY` is set (best-effort); keys only in `.env`.  
- **Cost & transparency:** Paid provider APIs; see [DISCLAIMER.md](DISCLAIMER.md).

After cloning, open the UI once and accept the disclaimer modal before LLM calls (or set `DISCLAIMER_ACCEPTED=1` in `backend/.env` for CI).

## Prerequisites

- Python 3.12+ with [uv](https://docs.astral.sh/uv/)
- Node.js 18+
- Provider API keys in `backend/.env` (see `backend/.env.example`) — e.g. Google and/or Anthropic

## First-time setup (clone or zip)

This repository ships **source only**. Not included (see `.gitignore`):

- Python envs (`.venv/`) — created by `uv sync`
- `node_modules/` — installed by the start script or `npm install` in `ui/`
- Local data (`*.db`, `chroma_data/`, acceptance markers)
- `uv.lock` (may exist locally; **gitignored**, same policy as Capstone)

```powershell
copy backend\.env.example backend\.env   # set provider API keys (required)
.\scripts\start-all.ps1
```

```bash
cp backend/.env.example backend/.env   # set provider API keys (required)
./scripts/start-all.sh
```

Only `backend/.env` is required. The UI talks to the API by default (`http://127.0.0.1:8000`); optional `ui/.env` can override `VITE_API_URL` (see `ui/.env.example`). On first UI load, accept the disclaimer modal before LLM calls.

## Quick start

| Service | URL |
|---------|-----|
| Frontend | http://127.0.0.1:5173 |
| Backend OpenAPI | http://127.0.0.1:8000/docs |

### Docker

```bash
# from repo root, with backend/.env present
docker compose up --build
```

## License

| Material | License |
|----------|---------|
| Program source code | [AGPL-3.0](LICENSE) |
| Marked portfolio docs / assets (when present) | [CC BY-NC-ND 4.0](LICENSE-ASSETS.md) |

## Legacy split repos

Earlier separate backend, UI, and docs repositories are **frozen** historical sources. New work happens only in this monorepo.
