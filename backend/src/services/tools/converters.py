"""Tool converters for different LLM providers.

Converts internal tool definitions to provider-specific formats.
"""

from src.services.tools.definitions import ToolDefinition, TOOL_DEFINITIONS


def convert_tools_for_gemini(enabled_tools: list[str]) -> list[dict]:
    """Convert tool definitions to Gemini format.
    
    Args:
        enabled_tools: List of enabled tool names
        
    Returns:
        List of function declarations for Gemini
        
    Example:
        >>> tools = convert_tools_for_gemini(["create_status"])
        >>> tools[0]["name"]
        'create_status'
    """
    function_declarations = []
    
    for tool_name in enabled_tools:
        tool = TOOL_DEFINITIONS.get(tool_name)
        if not tool:
            continue
        
        # Build parameters schema
        properties = {}
        required = []
        
        for param in tool["parameters"]:
            param_schema = {
                "type": _map_type_to_gemini(param["type"]),
                "description": param["description"]
            }
            if param.get("enum"):
                param_schema["enum"] = param["enum"]
            # Handle array items
            if param["type"] == "array" and param.get("items"):
                param_schema["items"] = param["items"]
            
            properties[param["name"]] = param_schema
            
            if param["required"]:
                required.append(param["name"])
        
        function_declarations.append({
            "name": tool["name"],
            "description": tool["description"],
            "parameters": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        })
    
    return function_declarations


def convert_tools_for_claude(enabled_tools: list[str]) -> list[dict]:
    """Convert tool definitions to Claude format.
    
    Args:
        enabled_tools: List of enabled tool names
        
    Returns:
        List of tool definitions for Claude
        
    Example:
        >>> tools = convert_tools_for_claude(["create_status"])
        >>> tools[0]["name"]
        'create_status'
    """
    tool_definitions = []
    
    for tool_name in enabled_tools:
        tool = TOOL_DEFINITIONS.get(tool_name)
        if not tool:
            continue
        
        # Build input schema
        properties = {}
        required = []
        
        for param in tool["parameters"]:
            param_schema = {
                "type": _map_type_to_claude(param["type"]),
                "description": param["description"]
            }
            if param.get("enum"):
                param_schema["enum"] = param["enum"]
            # Handle array items
            if param["type"] == "array" and param.get("items"):
                param_schema["items"] = param["items"]
            
            properties[param["name"]] = param_schema
            
            if param["required"]:
                required.append(param["name"])
        
        tool_definitions.append({
            "name": tool["name"],
            "description": tool["description"],
            "input_schema": {
                "type": "object",
                "properties": properties,
                "required": required
            }
        })
    
    return tool_definitions


def _map_type_to_gemini(param_type: str) -> str:
    """Map parameter type to Gemini format.
    
    Args:
        param_type: Internal type name
        
    Returns:
        Gemini type name
    """
    type_map = {
        "string": "string",
        "integer": "integer",
        "boolean": "boolean",
        "number": "number",
        "array": "array",
        "object": "object"
    }
    return type_map.get(param_type.lower(), "string")


def _map_type_to_claude(param_type: str) -> str:
    """Map parameter type to Claude format.
    
    Args:
        param_type: Internal type name
        
    Returns:
        Claude type name
    """
    type_map = {
        "string": "string",
        "integer": "integer",
        "boolean": "boolean",
        "number": "number",
        "array": "array",
        "object": "object"
    }
    return type_map.get(param_type.lower(), "string")


def extract_tool_calls_from_gemini(response) -> list[dict]:
    """Extract tool calls from Gemini response.
    
    Args:
        response: Gemini API response
        
    Returns:
        List of tool calls with name and arguments
        
    Example:
        >>> calls = extract_tool_calls_from_gemini(response)
        >>> calls[0]["name"]
        'create_status'
    """
    tool_calls = []
    
    if hasattr(response, 'candidates') and response.candidates:
        candidate = response.candidates[0]
        if hasattr(candidate, 'content') and hasattr(candidate.content, 'parts'):
            for part in candidate.content.parts:
                if hasattr(part, 'function_call') and part.function_call is not None:
                    fc = part.function_call
                    tool_calls.append({
                        "name": fc.name,
                        "arguments": dict(fc.args)
                    })
    
    return tool_calls


def extract_tool_calls_from_claude(response) -> list[dict]:
    """Extract tool calls from Claude response.
    
    Args:
        response: Claude API response
        
    Returns:
        List of tool calls with name and arguments
        
    Example:
        >>> calls = extract_tool_calls_from_claude(response)
        >>> calls[0]["name"]
        'create_status'
    """
    tool_calls = []
    
    if hasattr(response, 'content'):
        for content_block in response.content:
            if content_block.type == 'tool_use':
                tool_calls.append({
                    "name": content_block.name,
                    "arguments": content_block.input,
                    "id": content_block.id  # Claude requires tool_use_id for results
                })
    
    return tool_calls
