# AI Context Manager — Architecture

Implementation reference for the **AI Context Manager** monorepo (FastAPI backend + React UI). Research framing and setup: [README.md](./README.md). Design trade-offs: [§5](#5-design-decisions--trade-offs). Ethics: [§6](#6-ethics-and-limits). Legal: [DISCLAIMER.md](./DISCLAIMER.md), [LICENSE](./LICENSE), [LICENSE-ASSETS.md](./LICENSE-ASSETS.md).

---

## 1. Monorepo overview

One backend process serves the UI. Persistence is local SQLite plus a co-located Chroma index. Cloud LLMs are called with keys from `backend/.env`.

```
┌──────────────────────────────────────┐
│  ui/  React + Vite  (:5173)          │
└──────────────────┬───────────────────┘
                   │ HTTP /api/v1
                   ▼
┌──────────────────────────────────────┐
│  backend/  FastAPI  (:8000)          │
│  Chat A/B, sessions, drafts, tools   │
│  SQLite (app.db)  +  Chroma (RAG)    │
└──────────────────┬───────────────────┘
                   │ HTTPS
                   ▼
        Gemini / Claude  (+ optional Mistral)
```

| Service | Port | Path |
|---------|------|------|
| Backend API / OpenAPI | 8000 | `backend/` |
| Frontend (Vite) | 5173 | `ui/` |
| Frontend (Docker/nginx) | 80 | `ui/` + root `docker-compose.yml` |

**Full stack:** `scripts/start-all.ps1` / `scripts/start-all.sh` from the monorepo root.

---

## 2. Backend

| Area | Location | Notes |
|------|----------|--------|
| App entry | `backend/src/main.py` | FastAPI, CORS, routers |
| Config | `backend/src/config.py` | Env-driven settings |
| Persistence | `backend/src/database.py`, `models/` | Async SQLAlchemy + SQLite |
| Migrations | `backend/migrations/` | Alembic |
| LLM | `backend/src/services/llm/` | Multi-provider clients |
| Context | `backend/src/services/context_builder.py` | Prompt assembly; live status + status history for LLM |
| RAG | `backend/src/services/vector_store.py`, `embedding_service.py` | Chroma + fastembed |
| Tools | `backend/src/services/tools/` | Orchestrator loop + handlers (see §2.4) |
| Tests | `backend/tests/` | pytest |

### 2.1 Repository layout

```
backend/
├── src/
│   ├── main.py
│   ├── routers/
│   │   ├── chat/         package: chat_send, chat_audit, chat_summary (+ common)
│   │   ├── sessions, audit, drafts, library, status, …
│   ├── models/ / schemas/
│   └── services/         llm, context, vector, tools, status_history, usage
├── migrations/
├── tests/
├── pyproject.toml        uv-managed deps (uv.lock gitignored)
└── Dockerfile
```

### 2.2 Context pipeline (conceptual)

1. **Session + project state** — messages, summaries, status, user facts  
2. **Prompt modules** — system roles / configurable prompt parts  
3. **Optional RAG** — Chroma retrieval over indexed session text (metadata filters such as `project_id` / `session_id` are **application filters**, not security tenants)  
4. **LLM call** — streaming and/or tool-use loops  
5. **Persistence** — messages, usage, draft/artifact updates  

**Status is project-wide**, not session-local: every chat turn injects live status from the DB. Status change history (reason, session meta, previous values / title renames) is also available to the model as an obsolete audit section — separate from per-message Tool Log / turn summaries.

### 2.3 Dual-mode writing

- **Chat A / workshop flows** — drafting and editing artifacts with versioning/history  
- **Chat B / audit–verify** — critique and verification against drafts and context  

Exact route names live under `backend/src/routers/` and the UI hooks in `ui/src/`.

### 2.4 Tool loop (current shape)

Responsibility split (kept intentionally small):

| Module | Role |
|--------|------|
| `tools/orchestrator.py` | Provider tool loop, dedupe/priority, terminal-batch end |
| `tools/executor.py` | Dispatch + format results for the LLM |
| `tools/handlers/*` | Domain mutations (status, draft, …) |
| `tools/turn_summary.py` | Ground-truth TURN SUMMARY for Tool Log / re-anchor |
| `tools/claim_guard.py` | Block invented status/draft success; history sanitize; forced-retry helpers |
| `routers/chat/chat_send.py` | Chat composition root: calls orchestrator, applies claim guard / retries |

Notable product rules already in code:

- Status **no-op** when content/title unchanged (no fake “updated”)  
- `update_status` accepts optional **title and/or content** (at least one)  
- Exact tool-call dedupe by name+args; status writes before terminal draft tools in a round  
- Terminal draft tools: chat body = formatted tool results (SSOT); TURN SUMMARY stays in Tool Log  

---

## 3. Frontend

| Area | Location | Notes |
|------|----------|--------|
| App shell | `ui/src/App.tsx` | Layout / orchestration; composes workspace views |
| Workspace | `ui/src/components/workspace/` | `SessionSidebar`, `ProjectWorkspace` |
| Components | `ui/src/components/` | chat, workshop, library, context, status, settings, modals |
| Status history | `ui/src/components/modals/StatusHistoryModal.tsx` | Project-wide chronological audit (UI) |
| Hooks / services | `ui/src/hooks/`, `ui/src/services/` | API clients, chat/artifact / session logic |
| Tests | `ui/src/**/__tests__` | Vitest |

The UI always uses the backend API (default `http://127.0.0.1:8000`). Optional `ui/.env` may set `VITE_API_URL` for non-default hosts (see `ui/.env.example`).

UI copy is **English**. Soft size limits below are guidance, not hard CI gates.

### 3.1 Soft size limits (guidance, not hard CI gates)

| Unit | Soft limit | Typical next split |
|------|------------|--------------------|
| UI component | ~400 lines | Extract panel / subview under `components/{domain}/` |
| Hook | ~300 lines | Extract focused hook (`useXState`, `useXOrchestration`) |
| FastAPI router module | ~500 lines | Package by verb/domain (e.g. `chat_send` / `chat_audit` / `chat_summary`) |

Orchestrators (`App.tsx`) may stay larger if they only wire state + handlers and keep JSX in child components. Today `App.tsx`, `context_builder.py`, and `chat_send.py` are still above those soft ceilings in places — acceptable for portfolio v1, not a claim of perfect SoC everywhere.

---

## 4. Trust model and persistence (A1)

**Locked decision (portfolio v1): single-operator install, no authentication.**

| Store | Role | Process |
|-------|------|---------|
| SQLite `app.db` | Source of truth for projects, sessions, chats, drafts, library, settings, usage | Same backend process |
| Chroma | Derived semantic index over session/summary text | Same backend process |
| `.env` | API keys and config | Server-side only; never in the DB |

**What this is not:** Capstone-style **multi-service database separation** (game DB vs agent DB vs Chroma in separate processes). That pattern protects an agent/game trust boundary. Context Manager has one app boundary.

**What we claim:** Local demo security via network exposure control, CORS, keys in env, disclaimer/accept, optional moderation, and output sanitization — **not** multi-tenant isolation.

**If multi-user were added later:** shared DB + `user_id` on rows + always-scoped Chroma queries (and real AuthN/AuthZ) would be the compromise; DB-per-user would be stronger; Postgres/pgvector remains an optional scale path — all are **follow-ups**, not v1.

---

## 5. Design decisions & trade-offs

| Decision | Choice | Why |
|----------|--------|-----|
| Trust model | Single-operator, no auth (A1) | Honest scope for a local portfolio demo; avoids fake multi-tenant claims |
| Primary DB | SQLite | Zero-ops local install; Alembic for schema evolution |
| Vectors | Chroma + fastembed | Local RAG without Postgres/pgvector for v1 |
| Python tooling | `uv` + `pyproject.toml` | Capstone lesson; `uv.lock` gitignored |
| Monorepo | `backend/` + `ui/` + `docs/` | One clone for recruiters; legacy tri-repo frozen |
| Dual license | AGPL-3.0 + CC BY-NC-ND 4.0 | Same bar as Capstone portfolio project |
| Hosting | Repo-only (no public hosted multi-user app in v1) | Lower operational/privacy surface |
| Tool honesty | Claim guard + turn summary SSOT | Models invent success; ground truth stays in tools / Tool Log |

### Done in v1 (honest snapshot)

- English product UI, backend user-facing strings, docs, and test fixtures  
- Status title rename via tools; project-wide status history in LLM context **and** UI modal  
- Claim guard / history sanitize / forced tool retry; turn summary in Tool Log  
- Tool module split (`claim_guard`, `turn_summary`, `tool_kinds`)  

### Follow-ups (documented, not v1)

- UX polish: error toasts, optional PDF library path, batch session API if needed  
- Overview PDF screenshot edition (diagram PDF exists; richer screenshot walkthrough optional)  
- Soft-limit SoC splits for `App.tsx` / `context_builder.py` / provider adapters in orchestrator  
- Auth + tenant-scoped Chroma; Postgres/pgvector; observability  
- Local-first defaults in `backend/.env.example` vs Docker/Tailscale comments (publish hygiene)  

### Output rendering / XSS

Chat and artifact panels currently render model output as **React text nodes** / `<pre>` (no `dangerouslySetInnerHTML`, no Markdown→HTML pipeline). That is the primary XSS control today. If HTML/Markdown rendering is added later, sanitize with a dedicated library (e.g. DOMPurify or rehype-sanitize) before trusting markup.

---

## 6. Ethics and limits

- **Privacy:** No accounts; data stays in local SQLite/Chroma unless you expose the API.  
- **Transparency:** LLM calls cost money; see [DISCLAIMER.md](DISCLAIMER.md).  
- **Safety:** Moderation is best-effort when enabled; humans must review drafts and tool effects.  
- **Fair claims:** Do not describe this repo as a multi-tenant production platform.

---

## 7. Testing & config (snapshot)

| Area | Notes |
|------|-------|
| Backend | pytest under `backend/tests/` (`uv run pytest`) |
| Frontend | Vitest under `ui/` |
| Config | `backend/.env.example`, `ui/.env.example` |
| Ignore | `.env`, `*.db`, `chroma_data/`, `.venv/`, `node_modules/`, `uv.lock` |
