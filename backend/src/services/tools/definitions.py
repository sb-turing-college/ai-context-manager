"""Tool definitions for AI function calling.

Defines all available tools that the AI can use, including:
- Status topic management (CRUD)
- User profile fact management (CRUD, project-independent)
- Document operations (search, read)
- Session search (semantic vector search over past sessions)
- Draft creation (workshop integration)
"""

from typing import TypedDict


class ToolParameter(TypedDict):
    """Tool parameter definition.
    
    Attributes:
        name: Parameter name
        type: Parameter type (string, integer, boolean, etc.)
        description: Parameter description
        required: Whether parameter is required
        enum: Optional list of allowed values
    """
    
    name: str
    type: str
    description: str
    required: bool
    enum: list[str] | None


class ToolDefinition(TypedDict):
    """Tool definition.
    
    Attributes:
        name: Tool name (used for routing)
        display_name: Human-readable name
        description: What the tool does
        category: Tool category (status, documents, workshop)
        parameters: List of parameters
    """
    
    name: str
    display_name: str
    description: str
    category: str
    parameters: list[ToolParameter]


# All available tools
TOOL_DEFINITIONS: dict[str, ToolDefinition] = {
    # Status Topic Tools
    "create_status": {
        "name": "create_status",
        "display_name": "Create status topic",
        "description": (
            "Creates a new status topic in the current project. Use this to track "
            "dynamic information (e.g. credits, progress, current phase)."
        ),
        "category": "status",
        "parameters": [
            {
                "name": "title",
                "type": "string",
                "description": "Status topic title (short and clear)",
                "required": True,
                "enum": None
            },
            {
                "name": "content",
                "type": "string",
                "description": "Current value/content of the status topic",
                "required": True,
                "enum": None
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Reason for creation (stored in history)",
                "required": False,
                "enum": None
            }
        ]
    },
    
    # Note: read_status removed - Status is always in context as user message
    
    "update_status": {
        "name": "update_status",
        "display_name": "Update status topic",
        "description": (
            "Updates an existing status topic's content and/or title. "
            "Provide at least one of title or content. "
            "Previous content (and title renames) are stored in history."
        ),
        "category": "status",
        "parameters": [
            {
                "name": "topic_id",
                "type": "string",
                "description": "ID of the status topic to update",
                "required": True,
                "enum": None
            },
            {
                "name": "content",
                "type": "string",
                "description": (
                    "New content of the status topic "
                    "(optional if title is provided)"
                ),
                "required": False,
                "enum": None
            },
            {
                "name": "title",
                "type": "string",
                "description": (
                    "New title of the status topic "
                    "(optional if content is provided)"
                ),
                "required": False,
                "enum": None
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Reason for the change (stored in history)",
                "required": True,
                "enum": None
            }
        ]
    },
    
    "delete_status": {
        "name": "delete_status",
        "display_name": "Delete status topic",
        "description": (
            "Deletes a status topic. Use only when the topic is no longer relevant."
        ),
        "category": "status",
        "parameters": [
            {
                "name": "topic_id",
                "type": "string",
                "description": "ID of the status topic to delete",
                "required": True,
                "enum": None
            }
        ]
    },
    
    # User Profile Fact Tools
    "upsert_user_fact": {
        "name": "upsert_user_fact",
        "display_name": "Upsert user fact",
        "description": (
            "Creates or updates a cross-project user profile fact. "
            "Match key is category + title (case/whitespace-insensitive). "
            "Same title again updates the existing row; do not call twice "
            "in one turn after success."
        ),
        "category": "user_profile",
        "parameters": [
            {
                "name": "title",
                "type": "string",
                "description": "Short label for the fact (e.g. 'Communication style', 'Tech stack')",
                "required": True,
                "enum": None
            },
            {
                "name": "content",
                "type": "string",
                "description": "Fact content (concrete and precise)",
                "required": True,
                "enum": None
            },
            {
                "name": "category",
                "type": "string",
                "description": (
                    "Category: style (communication), expertise (skills), "
                    "preference (likes), context (role/environment)"
                ),
                "required": False,
                "enum": ["style", "expertise", "preference", "context"]
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Why this fact is being stored or updated",
                "required": False,
                "enum": None
            }
        ]
    },

    "delete_user_fact": {
        "name": "delete_user_fact",
        "display_name": "Delete user fact",
        "description": (
            "Deletes a user profile fact. Use only when the fact is permanently "
            "no longer relevant (e.g. outdated info)."
        ),
        "category": "user_profile",
        "parameters": [
            {
                "name": "fact_id",
                "type": "string",
                "description": "ID of the user fact to delete",
                "required": True,
                "enum": None
            }
        ]
    },

    # Session Search Tool (semantic vector search)
    "search_past_sessions": {
        "name": "search_past_sessions",
        "display_name": "Search past sessions",
        "description": (
            "Semantically searches all past sessions in this project for relevant "
            "content. Use this to recall knowledge from earlier conversations "
            "(e.g. past decisions, mentioned numbers, preferences). "
            "Returns the most relevant passages."
        ),
        "category": "search",
        "parameters": [
            {
                "name": "query",
                "type": "string",
                "description": "Natural-language search query (e.g. 'What was the agreed budget?')",
                "required": True,
                "enum": None
            },
            {
                "name": "limit",
                "type": "integer",
                "description": "Maximum number of hits (1–10, default: 5)",
                "required": False,
                "enum": None
            }
        ]
    },

    # Document Tools
    "search_documents": {
        "name": "search_documents",
        "display_name": "Search documents",
        "description": (
            "Searches the library for documents by title or content. "
            "Returns a list of matching documents."
        ),
        "category": "documents",
        "parameters": [
            {
                "name": "query",
                "type": "string",
                "description": "Search term (matches title and content)",
                "required": True,
                "enum": None
            },
            {
                "name": "limit",
                "type": "integer",
                "description": "Maximum number of results (default: 5)",
                "required": False,
                "enum": None
            }
        ]
    },
    
    "read_document": {
        "name": "read_document",
        "display_name": "Read document",
        "description": "Reads the full content of a document from the library.",
        "category": "documents",
        "parameters": [
            {
                "name": "document_id",
                "type": "string",
                "description": "ID of the document to read",
                "required": True,
                "enum": None
            }
        ]
    },
    
    # Workshop Tools
    "create_draft": {
        "name": "create_draft",
        "display_name": "Create draft",
        "description": (
            "Creates a new workshop draft (replaces any current draft). "
            "Use for new artifacts AND for full rewrites, condensation, "
            "expansion, or restructuring of an existing draft. "
            "Prefer this over edit_draft whenever most of the document changes "
            "or you would need the entire draft as old_text."
        ),
        "category": "workshop",
        "parameters": [
            {
                "name": "title",
                "type": "string",
                "description": "Draft title (short and descriptive)",
                "required": True,
                "enum": None
            },
            {
                "name": "content",
                "type": "string",
                "description": "Full draft content (Markdown supported)",
                "required": True,
                "enum": None
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Brief reason why this draft was created",
                "required": False,
                "enum": None
            }
        ]
    },
    
    "edit_draft": {
        "name": "edit_draft",
        "display_name": "Edit draft",
        "description": """Surgical edits only: replace short exact snippets in the current draft. Apply ALL small changes in ONE call.

USE edit_draft ONLY when a few local fixes are needed and most of the draft stays the same.
Do NOT use for full rewrites, heavy condensation, restructuring, or "much shorter/longer" versions — use create_draft instead.
FORBIDDEN: passing the entire draft (or nearly the entire draft) as one old_text/new_text pair.

IMPORTANT:
- old_text must be a SHORT exact excerpt from the draft (including newlines and spaces)
- All changes are combined into ONE new version
- For multiple small changes: pass all items in the edits list; do NOT call repeatedly

Example for 3 small changes:
edits: [
  {"old_text": "100ml oil", "new_text": "60ml oil"},
  {"old_text": "fry for 5 minutes", "new_text": "2-3 minutes over medium heat"},
  {"old_text": "salt to taste", "new_text": "1/2 tsp salt"}
]""",
        "category": "workshop",
        "parameters": [
            {
                "name": "edits",
                "type": "array",
                "description": (
                    "List of SMALL exact snippet replacements. "
                    "Do not put the whole draft in one edit — use create_draft for rewrites."
                ),
                "required": True,
                "enum": None,
                "items": {
                    "type": "object",
                    "properties": {
                        "old_text": {
                            "type": "string",
                            "description": "SHORT exact excerpt from the draft (copy-paste; not the whole document)"
                        },
                        "new_text": {"type": "string", "description": "Replacement text (empty = delete)"}
                    },
                    "required": ["old_text", "new_text"]
                }
            },
            {
                "name": "reason",
                "type": "string",
                "description": "Brief reason for the changes",
                "required": False,
                "enum": None
            }
        ]
    }
}


def get_tool_definition(tool_name: str) -> ToolDefinition | None:
    """Get tool definition by name.
    
    Args:
        tool_name: Name of the tool
        
    Returns:
        Tool definition or None if not found
        
    Example:
        >>> tool = get_tool_definition("create_status")
        >>> tool["display_name"]
        'Create status topic'
    """
    return TOOL_DEFINITIONS.get(tool_name)


def get_tools_by_category(category: str) -> dict[str, ToolDefinition]:
    """Get all tools in a category.
    
    Args:
        category: Category name (status, documents, workshop)
        
    Returns:
        Dictionary of tool definitions
        
    Example:
        >>> tools = get_tools_by_category("status")
        >>> len(tools)
        3  # create, update, delete (read removed - status always in context)
    """
    return {
        name: tool
        for name, tool in TOOL_DEFINITIONS.items()
        if tool["category"] == category
    }


def get_enabled_tools(enabled_tool_names: list[str]) -> dict[str, ToolDefinition]:
    """Get only enabled tools.
    
    Args:
        enabled_tool_names: List of enabled tool names
        
    Returns:
        Dictionary of enabled tool definitions
        
    Example:
        >>> tools = get_enabled_tools(["create_status", "read_status"])
        >>> len(tools)
        2
    """
    return {
        name: tool
        for name, tool in TOOL_DEFINITIONS.items()
        if name in enabled_tool_names
    }
