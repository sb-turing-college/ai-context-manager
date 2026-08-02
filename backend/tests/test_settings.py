"""Tests for settings endpoints."""

import pytest


# --- App Settings Tests ---

def test_get_default_app_settings(test_client) -> None:
    """Test getting app settings (may have been modified by previous tests)."""
    response = test_client.get("/api/v1/settings")
    assert response.status_code == 200
    
    data = response.json()
    assert "font_size" in data
    assert 12 <= data["font_size"] <= 20
    assert "animations_enabled" in data
    assert isinstance(data["animations_enabled"], bool)
    assert "summary_trigger_mode" in data
    assert data["summary_trigger_mode"] in ["automatic", "manual", "disabled"]


def test_update_app_settings(test_client) -> None:
    """Test updating app settings."""
    update_data = {
        "font_size": 16,
        "animations_enabled": False
    }
    
    response = test_client.patch("/api/v1/settings", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["font_size"] == 16
    assert data["animations_enabled"] is False
    assert data["summary_trigger_mode"] == "manual"  # Unchanged


def test_update_app_settings_persists(test_client) -> None:
    """Test that app settings persist."""
    # Get current settings
    current_response = test_client.get("/api/v1/settings")
    current_size = current_response.json()["font_size"]
    
    # Update to a different value
    new_size = 20 if current_size != 20 else 18
    test_client.patch("/api/v1/settings", json={"font_size": new_size})
    
    # Get settings again
    response = test_client.get("/api/v1/settings")
    data = response.json()
    assert data["font_size"] == new_size


def test_update_app_settings_validation(test_client) -> None:
    """Test validation for app settings."""
    # Font size too small
    response = test_client.patch("/api/v1/settings", json={"font_size": 10})
    assert response.status_code == 422
    
    # Font size too large
    response = test_client.patch("/api/v1/settings", json={"font_size": 25})
    assert response.status_code == 422


# --- System Prompt Tests ---

def test_get_default_system_prompts(test_client) -> None:
    """Test getting system prompts (summary, verify, audit)."""
    response = test_client.get("/api/v1/settings/system-prompts")
    assert response.status_code == 200
    
    data = response.json()
    # API returns object with 'prompts' key
    assert "prompts" in data
    prompts = data["prompts"]
    assert len(prompts) == 3  # summary, verify, audit
    
    # Check all prompt types exist
    types = [prompt["type"] for prompt in prompts]
    assert "summary" in types
    assert "verify" in types
    assert "audit" in types
    
    # All prompts have required fields
    for prompt in prompts:
        assert "type" in prompt
        assert "content" in prompt
        assert "is_default" in prompt
        assert isinstance(prompt["is_default"], bool)


def test_update_system_prompt(test_client) -> None:
    """Test updating a system prompt (summary, verify, audit)."""
    update_data = {"content": "Custom summary prompt"}
    
    response = test_client.put("/api/v1/settings/system-prompts/summary", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["type"] == "summary"
    assert data["content"] == "Custom summary prompt"
    assert data["is_default"] is False


def test_update_system_prompt_persists(test_client) -> None:
    """Test that system prompt updates persist."""
    # Update prompt
    test_client.put("/api/v1/settings/system-prompts/verify", json={"content": "Custom verify prompt"})
    
    # Get all prompts
    response = test_client.get("/api/v1/settings/system-prompts")
    data = response.json()
    
    verify_prompt = next(p for p in data["prompts"] if p["type"] == "verify")
    assert verify_prompt["content"] == "Custom verify prompt"
    assert verify_prompt["is_default"] is False


def test_reset_system_prompt(test_client) -> None:
    """Test resetting a system prompt to default."""
    # First, customize it
    test_client.put("/api/v1/settings/system-prompts/audit", json={"content": "Custom audit prompt"})
    
    # Reset it
    response = test_client.post("/api/v1/settings/system-prompts/audit/reset")
    assert response.status_code == 200
    
    data = response.json()
    assert data["type"] == "audit"
    assert data["is_default"] is True
    # Content should match default (exact content may vary, just check it exists)
    assert len(data["content"]) > 0


def test_update_invalid_system_prompt(test_client) -> None:
    """Test updating a non-existent system prompt module."""
    response = test_client.put("/api/v1/settings/system-prompts/invalid", json={"content": "Test"})
    # API returns 400 (Bad Request) for invalid prompt type, not 404
    assert response.status_code == 400
    assert "Invalid prompt type" in response.json()["detail"]


def test_reset_invalid_system_prompt(test_client) -> None:
    """Test resetting a non-existent system prompt module."""
    response = test_client.post("/api/v1/settings/system-prompts/invalid/reset")
    # API returns 400 (Bad Request) for invalid prompt type, not 404
    assert response.status_code == 400
    assert "Invalid prompt type" in response.json()["detail"]


# --- System Roles Tests ---

def test_get_system_roles_empty(test_client) -> None:
    """Test getting system roles when none exist."""
    response = test_client.get("/api/v1/settings/roles")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)


def test_create_system_role(test_client) -> None:
    """Test creating a system role."""
    role_data = {
        "title": "Test Role",
        "content": "Test content",
        "category": "chat",
        "is_default": False
    }
    
    response = test_client.post("/api/v1/settings/roles", json=role_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["title"] == "Test Role"
    assert data["content"] == "Test content"
    assert data["category"] == "chat"
    assert data["is_default"] is False
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_get_system_role(test_client) -> None:
    """Test getting a single system role."""
    # Create role
    create_response = test_client.post("/api/v1/settings/roles", json={
        "title": "Verifier",
        "content": "Verify facts",
        "category": "verify",
        "is_default": True
    })
    role_id = create_response.json()["id"]
    
    # Get role
    response = test_client.get(f"/api/v1/settings/roles/{role_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == role_id
    assert data["title"] == "Verifier"


def test_get_nonexistent_system_role(test_client) -> None:
    """Test getting a non-existent system role."""
    response = test_client.get("/api/v1/settings/roles/nonexistent-id")
    assert response.status_code == 404


def test_update_system_role(test_client) -> None:
    """Test updating a system role."""
    # Create role
    create_response = test_client.post("/api/v1/settings/roles", json={
        "title": "Old Title",
        "content": "Old content",
        "category": "chat",
        "is_default": False
    })
    role_id = create_response.json()["id"]
    
    # Update role
    update_data = {"title": "New Title", "content": "New content"}
    response = test_client.patch(f"/api/v1/settings/roles/{role_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == role_id
    assert data["title"] == "New Title"
    assert data["content"] == "New content"
    assert data["category"] == "chat"  # Unchanged


def test_update_nonexistent_system_role(test_client) -> None:
    """Test updating a non-existent system role."""
    response = test_client.patch("/api/v1/settings/roles/nonexistent-id", json={"title": "Test"})
    assert response.status_code == 404


def test_delete_system_role(test_client) -> None:
    """Test deleting a system role."""
    # Create role
    create_response = test_client.post("/api/v1/settings/roles", json={
        "title": "To Delete",
        "content": "Content",
        "category": "chat",
        "is_default": False
    })
    role_id = create_response.json()["id"]
    
    # Delete role
    response = test_client.delete(f"/api/v1/settings/roles/{role_id}")
    assert response.status_code == 204
    
    # Verify deleted
    get_response = test_client.get(f"/api/v1/settings/roles/{role_id}")
    assert get_response.status_code == 404


def test_delete_nonexistent_system_role(test_client) -> None:
    """Test deleting a non-existent system role."""
    response = test_client.delete("/api/v1/settings/roles/nonexistent-id")
    assert response.status_code == 404


def test_get_all_system_roles(test_client) -> None:
    """Test getting all system roles."""
    # Create multiple roles
    for i in range(3):
        test_client.post("/api/v1/settings/roles", json={
            "title": f"Role {i}",
            "content": f"Content {i}",
            "category": "chat",
            "is_default": False
        })
    
    # Get all roles
    response = test_client.get("/api/v1/settings/roles")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 3


# --- Tool Use Settings Tests ---

def test_get_default_tool_use_settings(test_client) -> None:
    """Test getting tool use settings."""
    response = test_client.get("/api/v1/settings/tool-use")
    assert response.status_code == 200
    
    data = response.json()
    assert "enabled_tools" in data
    assert "auto_confirm" in data
    assert isinstance(data["auto_confirm"], bool)
    
    # Check that enabled_tools is a dict with tool names
    assert isinstance(data["enabled_tools"], dict)
    assert len(data["enabled_tools"]) > 0


def test_update_tool_use_settings(test_client) -> None:
    """Test updating tool use settings."""
    update_data = {
        "enabled_tools": {
            "web_search": False,
            "create_draft": True
        },
        "auto_confirm": True
    }
    
    response = test_client.patch("/api/v1/settings/tool-use", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["enabled_tools"]["web_search"] is False
    assert data["enabled_tools"]["create_draft"] is True
    assert data["auto_confirm"] is True


def test_update_tool_use_settings_persists(test_client) -> None:
    """Test that tool use settings persist."""
    # Update settings
    test_client.patch("/api/v1/settings/tool-use", json={"auto_confirm": True})
    
    # Get settings again
    response = test_client.get("/api/v1/settings/tool-use")
    data = response.json()
    assert data["auto_confirm"] is True


def test_partial_tool_update(test_client) -> None:
    """Test updating only specific tools."""
    # First set initial state
    test_client.patch("/api/v1/settings/tool-use", json={
        "enabled_tools": {
            "web_search": True,
            "create_draft": True,
            "update_status": True
        }
    })
    
    # Update only one tool
    response = test_client.patch("/api/v1/settings/tool-use", json={
        "enabled_tools": {
            "web_search": False
        }
    })
    
    data = response.json()
    assert data["enabled_tools"]["web_search"] is False
    assert data["enabled_tools"]["create_draft"] is True  # Unchanged
    assert data["enabled_tools"]["update_status"] is True  # Unchanged
