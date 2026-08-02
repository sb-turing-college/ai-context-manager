"""Local disclaimer / API-terms acceptance before LLM-costing actions."""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from src.config import settings

# backend/src/disclaimer_acceptance.py -> backend/
BACKEND_ROOT = Path(__file__).resolve().parent.parent
# monorepo root (DISCLAIMER.md)
REPO_ROOT = BACKEND_ROOT.parent
DISCLAIMER_MARKER = BACKEND_ROOT / ".disclaimer_accepted"
DISCLAIMER_FILE = REPO_ROOT / "DISCLAIMER.md"

DISCLAIMER_DOC = "DISCLAIMER.md (repository root)"
DISCLAIMER_REJECT_DETAIL = (
    f"Disclaimer / API terms not accepted. Read {DISCLAIMER_DOC}, then accept via "
    "the UI or POST /api/v1/disclaimer/accept. For CI set DISCLAIMER_ACCEPTED=1."
)


def _env_disclaimer_accepted() -> bool:
    return bool(settings.disclaimer_accepted)


def is_disclaimer_accepted() -> bool:
    if _env_disclaimer_accepted():
        return True
    return DISCLAIMER_MARKER.is_file()


def accept_disclaimer() -> None:
    DISCLAIMER_MARKER.parent.mkdir(parents=True, exist_ok=True)
    DISCLAIMER_MARKER.touch(exist_ok=True)


def require_disclaimer_accepted() -> None:
    """FastAPI dependency: block LLM routes until accepted (or CI env bypass)."""
    if is_disclaimer_accepted():
        return
    raise HTTPException(status_code=403, detail=DISCLAIMER_REJECT_DETAIL)
