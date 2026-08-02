"""Chat routers package — send / audit / summary for SoC."""
from fastapi import APIRouter
from src.routers.chat import chat_send as send_mod
from src.routers.chat import chat_audit as audit_mod
from src.routers.chat import chat_summary as summary_mod
from src.routers.chat.common import build_context_from_request

router = APIRouter()
router.include_router(send_mod.router)
router.include_router(audit_mod.router)
router.include_router(summary_mod.router)

__all__ = ["router", "build_context_from_request"]
