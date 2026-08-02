# Stage 1: Builder — install deps with uv into a virtualenv
FROM python:3.12-slim AS builder

COPY --from=ghcr.io/astral-sh/uv:0.11.16 /uv /usr/local/bin/uv

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Lockfile is intentionally not committed (same policy as Capstone).
# Resolve from pyproject.toml at build time.
COPY pyproject.toml ./
RUN uv sync --no-dev --no-install-project

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

RUN useradd -m -u 1000 appuser

COPY --from=builder /app/.venv /app/.venv
COPY src/ ./src/

RUN mkdir -p /data/sqlite /data/chroma /data/fastembed \
    && chown -R appuser:appuser /data /app

USER appuser

ENV PATH=/app/.venv/bin:$PATH
ENV PYTHONPATH=/app
ENV FASTEMBED_CACHE_DIR=/data/fastembed
ENV VIRTUAL_ENV=/app/.venv

EXPOSE 8000

CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8000"]
