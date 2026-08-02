"""Optional Mistral moderation for user-provided text (best-effort)."""

from __future__ import annotations

import httpx
from fastapi import HTTPException

from src.config import settings

MISTRAL_MODERATION_URL = "https://api.mistral.ai/v1/moderations"

# Enforce categories that indicate misuse of the LLM itself.
# Ignore adventure/violence-style categories that are noisy for general writing.
ENFORCED_CATEGORIES = {
    "hate_and_discrimination",
    "sexual",
    "selfharm",
    "pii",
    "jailbreaking",
}


async def moderate_text(text: str) -> tuple[bool, str | None]:
    """Return (allowed, reason). If no MISTRAL_API_KEY, always allow."""
    api_key = (settings.mistral_api_key or "").strip()
    if not api_key:
        return True, None

    content = (text or "").strip()
    if not content:
        return True, None

    payload = {
        "model": "mistral-moderation-latest",
        "input": content,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.post(
            MISTRAL_MODERATION_URL, json=payload, headers=headers
        )
        response.raise_for_status()
        data = response.json()

    results = data.get("results", [])
    if not results:
        return True, None

    categories = results[0].get("categories", {})
    blocked = [
        name
        for name, flagged in categories.items()
        if flagged and name in ENFORCED_CATEGORIES
    ]
    if blocked:
        return False, f"Blocked categories: {', '.join(blocked)}"
    return True, None


async def require_text_allowed(text: str) -> None:
    """Raise HTTP 400 if moderation blocks the text."""
    allowed, reason = await moderate_text(text)
    if allowed:
        return
    raise HTTPException(
        status_code=400,
        detail=f"Content blocked by moderation ({reason}). Best-effort safety filter only.",
    )
