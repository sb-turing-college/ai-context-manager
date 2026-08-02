# AI Context Manager - Backend

FastAPI-based backend for AI-powered context management and chat completion.

> Monorepo note: run the stack from the **repository root** via `.\scripts\start-all.ps1` or `docker compose up` (root `docker-compose.yml`). Do not expect a sibling UI repository folder outside this monorepo.

## Features

- FastAPI with async SQLAlchemy
- SQLite database (PostgreSQL ready)
- Alembic migrations
- Multi-provider LLM support (Google Gemini + Anthropic Claude)
- Streaming responses (SSE)
- Tool-use / Function Calling
- Cross-session summaries
- Google Style docstrings

## Status

Feature-complete FastAPI backend in this monorepo (projects, sessions, chat/SSE, tools, RAG, artifacts, disclaimer gate). For stack overview and trust model, see the root [README.md](../README.md) and [ARCHITECTURE.md](../ARCHITECTURE.md).

## Quick Start

Prefer the monorepo root script: `..\scripts\start-all.ps1` (uses `uv`).

### Setup (backend only)

```bash
# Requires: https://docs.astral.sh/uv/
uv sync --dev

cp .env.example .env
# Edit .env with your API keys (local SQLite/Chroma paths - see comments in .env.example)

uv run alembic upgrade head
```

### Development

```bash
uv run uvicorn src.main:app --reload

uv run pytest

uv run alembic revision --autogenerate -m "description"
uv run alembic upgrade head
```

`uv.lock` may appear locally after `uv sync`; it is **gitignored** (same policy as the Capstone portfolio project).

### API Documentation

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc
- **Health Check:** http://localhost:8000/api/v1/health

## Project Structure

```
src/
├── models/          # SQLAlchemy models
├── schemas/         # Pydantic schemas (request/response)
├── routers/         # API endpoints
├── services/        # Business logic (LLM, tools, etc.)
├── config.py        # Settings (Pydantic)
├── database.py      # DB engine + session
└── main.py          # FastAPI app

migrations/          # Alembic migrations
tests/              # Pytest tests
```

## Tech Stack

- **Framework:** FastAPI 0.115+
- **Database:** SQLAlchemy 2.0 (async) + SQLite/PostgreSQL
- **Migrations:** Alembic
- **LLM Providers:** Google Gemini 3, Anthropic Claude 4.5
- **Testing:** Pytest + pytest-asyncio
- **Python:** 3.12+

## Environment Variables

See `.env.example` for all available configuration options.

Required for LLM integration:
- `GOOGLE_API_KEY` - Google Gemini API key
- `ANTHROPIC_API_KEY` - Anthropic Claude API key

## Development Guidelines

See [CONTRIBUTING.md](./CONTRIBUTING.md) for:
- Code style (Google Style docstrings)
- Type hints
- Testing
- Commit format

## License

AGPL-3.0 - see the repository root [LICENSE](../LICENSE).
