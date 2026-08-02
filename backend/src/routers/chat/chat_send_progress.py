"""SSE progress endpoint for chat turns (tools/stages without token streaming)."""

import asyncio
import json

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Session
from src.schemas.chat import ChatSendRequest
from src.services.llm.factory import create_provider
from src.services.moderation import require_text_allowed
from src.disclaimer_acceptance import require_disclaimer_accepted
from src.routers.chat.chat_send_core import run_chat_turn
from src.routers.chat.common import resolve_attached_summary_ids


router = APIRouter()


@router.post("/chat/send/progress")
async def send_chat_message_progress(
    request: ChatSendRequest,
    db: AsyncSession = Depends(get_db),
    _: None = Depends(require_disclaimer_accepted),
):
    """Run a chat turn and stream progress events via SSE.

    Events:
      - {"type":"stage","stage":"thinking"|"generating"}
      - {"type":"tool","tool":name,"status":"running"|"done"|"failed",...}
      - {"type":"done","response": <ChatResponse JSON>}
      - {"type":"error","message": "..."}
    """
    await require_text_allowed(request.message)

    result = await db.execute(select(Session).where(Session.id == request.session_id))
    session = result.scalar_one_or_none()

    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Session {request.session_id} not found",
        )

    summary_ids = resolve_attached_summary_ids(session, request.include_summaries)
    provider = create_provider(request.model)

    queue: asyncio.Queue = asyncio.Queue()

    async def _run_turn() -> None:
        try:
            chat_response = await run_chat_turn(
                request,
                session,
                db,
                provider,
                summary_ids,
                on_event=queue.put,
            )
            await queue.put({
                "type": "done",
                "response": chat_response.model_dump(mode="json"),
            })
        except Exception as e:
            await queue.put({"type": "error", "message": str(e)})
        finally:
            await queue.put(None)

    async def event_generator():
        task = asyncio.create_task(_run_turn())
        try:
            while True:
                event = await queue.get()
                if event is None:
                    break
                yield f"data: {json.dumps(event, ensure_ascii=False)}\n\n"
        finally:
            if not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
