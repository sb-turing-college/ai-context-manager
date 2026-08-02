# Contributing Guidelines

## Code Style

### Docstrings: Google Style

All modules, classes, and functions must use **Google Style Docstrings**.

**Example:**

```python
def build_chat_context(
    session_id: str,
    include_summaries: list[str] | None = None,
    mode: Literal["chat", "audit", "verify"] = "chat"
) -> ChatContext:
    """Build context for chat completion request.
    
    Assembles the full context including system prompt, documents, 
    summaries, and status topics based on the selected mode.
    
    Args:
        session_id: UUID of the current session
        include_summaries: Optional list of session IDs whose summaries to include
        mode: Context mode - 'chat' (full), 'audit' (sparse), or 'verify' (full)
        
    Returns:
        ChatContext object with all assembled context parts
        
    Raises:
        ValueError: If session_id not found in database
        
    Example:
        >>> context = build_chat_context(
        ...     session_id="abc-123",
        ...     include_summaries=["def-456"],
        ...     mode="verify"
        ... )
    """
    pass
```

**Referenz:** [Google Python Style Guide - Docstrings](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)

---

## Type Hints

- Always use type hints for function parameters and return values
- Use `|` for unions (Python 3.10+ syntax): `str | None`
- Use built-in generics: `list[str]`, `dict[str, int]`

---

## Imports

- Group imports: stdlib, third-party, local
- Sort alphabetically within groups
- Use absolute imports

```python
# Standard library
from typing import Literal
import json

# Third-party
from fastapi import APIRouter
from sqlalchemy import select

# Local
from src.models import Session
from src.schemas import ChatRequest
```

---

## Testing

- Write tests for all endpoints
- Use `pytest` and `pytest-asyncio`
- Test files: `tests/test_<module>.py`

---

## Commit Messages

Follow the same commit-message format as the frontend:

```
type: subject (max 50 chars)

optional body (max 72 chars per line)
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

---

## Development Workflow

1. Install tooling: [uv](https://docs.astral.sh/uv/) (Python 3.12+)
2. Install dependencies: `uv sync --dev` (from `backend/`)
3. Run migrations: `uv run alembic upgrade head`
4. Start server: `uv run uvicorn src.main:app --reload`
5. Run tests: `uv run pytest`
