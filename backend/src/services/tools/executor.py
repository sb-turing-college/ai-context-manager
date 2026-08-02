"""Tool executor for AI function calling.

Routes tool calls to appropriate handlers and manages execution flow.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from src.services.tools.handlers import status, documents, draft, user_facts, search


async def execute_tool(
    tool_name: str,
    parameters: dict,
    db: AsyncSession,
    project_id: str,
    session_id: str | None = None,
    search_scope: str = "project_only",
    current_draft: str | None = None,
) -> dict:
    """Execute a tool call.
    
    Args:
        tool_name: Name of the tool to execute
        parameters: Tool parameters
        db: Database session
        project_id: Current project ID
        
    Returns:
        Tool execution result
        
    Raises:
        ValueError: If tool not found or parameters invalid
        
    Example:
        >>> result = await execute_tool(
        ...     "create_status",
        ...     {"title": "Credits", "content": "1000"},
        ...     db,
        ...     "proj-123"
        ... )
        >>> result["success"]
        True
    """
    # Status Tools
    if tool_name == "create_status":
        return await status.handle_create_status(
            db=db,
            project_id=project_id,
            title=parameters.get("title"),
            content=parameters.get("content"),
            reason=parameters.get("reason"),
            session_id=session_id,
        )
    
    # Note: read_status removed - Status is always in context
    
    elif tool_name == "update_status":
        return await status.handle_update_status(
            db=db,
            topic_id=parameters.get("topic_id"),
            content=parameters.get("content"),
            title=parameters.get("title"),
            reason=parameters.get("reason"),
            session_id=session_id,
        )
    
    elif tool_name == "delete_status":
        return await status.handle_delete_status(
            db=db,
            topic_id=parameters.get("topic_id")
        )
    
    # User Profile Tools
    elif tool_name == "upsert_user_fact":
        return await user_facts.handle_upsert_user_fact(
            db=db,
            title=parameters.get("title"),
            content=parameters.get("content"),
            category=parameters.get("category", "preference"),
            reason=parameters.get("reason")
        )

    elif tool_name == "delete_user_fact":
        return await user_facts.handle_delete_user_fact(
            db=db,
            fact_id=parameters.get("fact_id")
        )

    # Session Search
    elif tool_name == "search_past_sessions":
        return await search.handle_search_past_sessions(
            db=db,
            project_id=project_id,
            query=parameters.get("query", ""),
            limit=parameters.get("limit", 5),
            scope=search_scope,
            session_id=session_id,
        )

    # Document Tools
    elif tool_name == "search_documents":
        return await documents.handle_search_documents(
            db=db,
            project_id=project_id,
            query=parameters.get("query"),
            limit=parameters.get("limit", 5)
        )
    
    elif tool_name == "read_document":
        return await documents.handle_read_document(
            db=db,
            document_id=parameters.get("document_id")
        )
    
    # Workshop Tools
    elif tool_name == "create_draft":
        return await draft.handle_create_draft(
            title=parameters.get("title"),
            content=parameters.get("content"),
            reason=parameters.get("reason")
        )
    
    elif tool_name == "edit_draft":
        return await draft.handle_edit_draft(
            edits=parameters.get("edits", []),
            reason=parameters.get("reason"),
            current_content=current_draft,
        )
    
    else:
        raise ValueError(f"Unknown tool: {tool_name}")


def format_tool_result_for_llm(tool_name: str, result: dict) -> str:
    """Format tool result for LLM consumption.
    
    Converts the tool result dict into a human-readable string
    that the LLM can understand and use in its response.
    
    Args:
        tool_name: Name of the executed tool
        result: Tool execution result
        
    Returns:
        Formatted result string
        
    Example:
        >>> result = {"success": True, "topic_id": "abc", "title": "Credits"}
        >>> formatted = format_tool_result_for_llm("create_status", result)
        >>> "successfully" in formatted or "Credits" in formatted
        True
    """
    if not result.get("success"):
        return (
            f"❌ Tool error: "
            f"{result.get('message') or result.get('error', 'Unknown error')}"
        )
    
    # Status Tools
    if tool_name == "create_status":
        return f"✅ {result['message']}\n- ID: {result['topic_id']}\n- Title: {result['title']}\n- Content: {result['content']}"
    
    # Note: read_status removed - Status is always in context
    
    elif tool_name == "update_status":
        if result.get("noop"):
            lines = [
                f"ℹ️ {result['message']}",
                f"- Current value unchanged: {result.get('old_content', '')}",
            ]
            if result.get("old_title") is not None:
                lines.append(
                    f"- Current title unchanged: {result.get('old_title', '')}"
                )
            return "\n".join(lines)
        lines = [f"✅ {result['message']}"]
        old_title = result.get("old_title")
        new_title = result.get("new_title")
        title_changed = (
            old_title is not None
            and new_title is not None
            and old_title != new_title
        )
        content_changed = result.get("old_content") != result.get("new_content")
        if title_changed:
            lines.append(f"- Old title: {old_title}")
            lines.append(f"- New title: {new_title}")
        # Content-only results (and dual updates) always show values so the
        # model sees the live content; title-only skips unchanged content.
        if content_changed or not title_changed:
            lines.append(f"- Old value: {result['old_content']}")
            lines.append(f"- New value: {result['new_content']}")
        return "\n".join(lines)
    
    elif tool_name == "delete_status":
        return f"✅ {result['message']}"
    
    # User Profile Tools
    elif tool_name == "upsert_user_fact":
        return (
            f"✅ {result['message']}\n"
            f"- Action: {result.get('action', 'unknown')}\n"
            f"- ID: {result['fact_id']}\n"
            f"- Category: {result['category']}\n"
            f"- Title: {result['title']}\n"
            f"- Content: {result['content']}"
        )

    elif tool_name == "delete_user_fact":
        return f"✅ {result['message']}"

    # Session Search
    elif tool_name == "search_past_sessions":
        if not result.get("hits"):
            return f"ℹ️ {result.get('message', 'No hits found.')}"
        lines = [f"✅ {result['message']}\n"]
        for hit in result["hits"]:
            ts = f"[{hit['created_at'][:16].replace('T', ' ')} UTC]" if hit.get("created_at") else ""
            role_label = {"user": "User", "assistant": "AI", "summary": "Summary"}.get(
                hit.get("role", ""), hit.get("role", "")
            )
            lines.append(
                f"**{hit['session_title']}** {ts} ({role_label}, "
                f"relevance: {hit.get('relevance', 0):.0%}):\n"
                f"> {hit['text'][:400]}{'...' if len(hit['text']) > 400 else ''}"
            )
        return "\n\n".join(lines)

    # Document Tools
    elif tool_name == "search_documents":
        if result['count'] == 0:
            query = result.get('query', 'unknown')
            return f"ℹ️ No documents found for search '{query}'."
        docs_list = "\n".join([
            f"  - **{d['title']}** ({d['type']}) - ID: {d['id']}\n    {d['preview']}"
            for d in result['documents']
        ])
        return f"✅ {result['message']}\n{docs_list}"
    
    elif tool_name == "read_document":
        doc = result['document']
        return f"✅ {result['message']}\n\n**{doc['title']}** ({doc['type']})\n\n{doc['content']}"
    
    # Workshop Tools — per-tool FACT lines removed; orchestrator emits
    # one consolidated [TURN SUMMARY] for status vs draft grounding.
    elif tool_name == "create_draft":
        return f"✅ {result['message']}"
    
    elif tool_name == "edit_draft":
        edit_count = result.get('edit_count', 0)
        return (
            f"✅ {edit_count} change{'s' if edit_count != 1 else ''} will be applied "
            "to the Workshop draft."
        )
    
    return result.get("message", "Tool executed successfully.")