"""Shared tool-name sets for orchestrator, turn summary, and claim guard."""

DRAFT_TOOLS = frozenset({"create_draft", "edit_draft"})
STATUS_TOOLS = frozenset({"create_status", "update_status", "delete_status"})
TERMINAL_TOOLS = DRAFT_TOOLS  # end outer loop only after the full round
