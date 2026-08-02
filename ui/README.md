# AI Context Manager — UI

React + Vite frontend for the **AI Context Manager** monorepo: dual-chat (draft vs audit/verify), workshop/library, session context, and artifact workflows against the local FastAPI backend.

> **Monorepo:** Prefer starting from the repository root (`..\scripts\start-all.ps1` or `docker compose up`). Product framing, setup, ethics, and licenses live in the root [README.md](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

**Stack:** React 19, Tailwind CSS v4, Framer Motion, TypeScript, Vitest

## Concept (short)

Tri-state context UI beyond linear chat:

1. **Context panel** — system prompt, static facts, dynamic project status
2. **Interaction stream** — dual chat with streaming and tool use
3. **Artifacts & library** — drafts, versions, and reusable documents

## Backend integration

The UI always talks to the FastAPI backend (default `http://127.0.0.1:8000`). No `ui/.env` is required for local `start-all`.

Optional: copy `.env.example` to `.env` only if you need a non-default API URL:

```bash
VITE_API_URL=http://127.0.0.1:8000
```

### Development (UI only)

```bash
npm install
npm run dev
```

## Disclaimer

Portfolio / educational project — not production SaaS. See root [DISCLAIMER.md](../DISCLAIMER.md).

## License

Program source: AGPL-3.0 (root [LICENSE](../LICENSE)). Portfolio assets: see [LICENSE-ASSETS.md](../LICENSE-ASSETS.md).
