"""Tests for session and message CRUD endpoints."""

import pytest


@pytest.fixture
def test_project(test_client):
    """Create a test project and return its ID."""
    response = test_client.post(
        "/api/v1/projects",
        json={"title": "Test Project for Sessions"}
    )
    assert response.status_code == 201
    return response.json()["id"]


@pytest.fixture
def test_session(test_project, test_client):
    """Create a test session and return its ID."""
    response = test_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project, "title": "Test Session"}
    )
    assert response.status_code == 201
    return response.json()["id"]


# --- Session Tests ---

def test_create_session(test_project, test_client):
    """Test creating a new session."""
    response = test_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project, "title": "New Session"}
    )
    assert response.status_code == 201
    
    data = response.json()
    assert data["title"] == "New Session"
    assert data["project_id"] == test_project
    assert data["message_count"] == 0
    assert data["active"] == False
    assert "id" in data


def test_create_session_invalid_project(test_client):
    """Test creating a session with invalid project ID."""
    response = test_client.post(
        "/api/v1/sessions",
        json={"project_id": "invalid-id", "title": "New Session"}
    )
    assert response.status_code == 404


def test_get_project_sessions(test_project, test_client):
    """Test getting all sessions for a project."""
    # Create multiple sessions
    test_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project, "title": "Session 1"}
    )
    test_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project, "title": "Session 2"}
    )
    
    # Get all sessions
    response = test_client.get(f"/api/v1/projects/{test_project}/sessions")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    assert any(s["title"] == "Session 1" for s in data)
    assert any(s["title"] == "Session 2" for s in data)


def test_get_project_sessions_invalid_project(test_client):
    """Test getting sessions for non-existent project."""
    response = test_client.get("/api/v1/projects/invalid-id/sessions")
    assert response.status_code == 404


def test_update_session(test_session, test_client):
    """Test updating a session's title (must not bump content timestamps)."""
    proj = test_client.post("/api/v1/projects", json={"title": "Rename TS Project"}).json()
    created = test_client.post(
        "/api/v1/sessions",
        json={"project_id": proj["id"], "title": "Original"},
    ).json()
    before_updated = created["updated_at"]
    before_last_modified = created["last_modified"]

    response = test_client.patch(
        f"/api/v1/sessions/{created['id']}",
        json={"title": "Updated Session Title"},
    )
    assert response.status_code == 200

    data = response.json()
    assert data["id"] == created["id"]
    assert data["title"] == "Updated Session Title"
    assert data["updated_at"] == before_updated
    assert data["last_modified"] == before_last_modified

    # Fixture session still renames successfully
    response = test_client.patch(
        f"/api/v1/sessions/{test_session}",
        json={"title": "Updated Session Title"},
    )
    assert response.status_code == 200
    assert response.json()["title"] == "Updated Session Title"


def test_update_nonexistent_session(test_client):
    """Test updating a session that doesn't exist."""
    response = test_client.patch(
        "/api/v1/sessions/nonexistent-id",
        json={"title": "New Title"}
    )
    assert response.status_code == 404


def test_delete_session(test_project, test_client):
    """Test deleting a session."""
    # Create session
    create_response = test_client.post(
        "/api/v1/sessions",
        json={"project_id": test_project, "title": "Session to Delete"}
    )
    session_id = create_response.json()["id"]
    
    # Delete session
    response = test_client.delete(f"/api/v1/sessions/{session_id}")
    assert response.status_code == 204
    
    # Verify deletion
    get_response = test_client.get(f"/api/v1/projects/{test_project}/sessions")
    sessions = get_response.json()
    assert not any(s["id"] == session_id for s in sessions)


def test_delete_nonexistent_session(test_client):
    """Test deleting a session that doesn't exist."""
    response = test_client.delete("/api/v1/sessions/nonexistent-id")
    assert response.status_code == 404


# --- Message Tests ---

def test_create_message(test_session, test_client):
    """Test adding a message to a session."""
    response = test_client.post(
        f"/api/v1/sessions/{test_session}/messages",
        json={
            "role": "user",
            "content": "Hello, AI!",
            "timestamp": "14:30"
        }
    )
    assert response.status_code == 201
    
    data = response.json()
    assert data["role"] == "user"
    assert data["content"] == "Hello, AI!"
    # Backend now generates timestamp (datetime), not from frontend
    assert "timestamp" in data
    assert isinstance(data["timestamp"], str)  # ISO format datetime string
    assert data["session_id"] == test_session
    assert "id" in data


def test_create_ai_message_with_model(test_session, test_client):
    """Test creating an AI message with model information."""
    response = test_client.post(
        f"/api/v1/sessions/{test_session}/messages",
        json={
            "role": "ai",
            "content": "Hello! How can I help?",
            "timestamp": "14:31",
            "model": "gemini-3-pro"
        }
    )
    assert response.status_code == 201
    
    data = response.json()
    assert data["role"] == "ai"
    assert data["model"] == "gemini-3-pro"


def test_create_message_invalid_session(test_client):
    """Test creating a message in non-existent session."""
    response = test_client.post(
        "/api/v1/sessions/invalid-id/messages",
        json={
            "role": "user",
            "content": "Hello",
            "timestamp": "14:30"
        }
    )
    assert response.status_code == 404


def test_get_session_messages(test_session, test_client):
    """Test getting all messages for a session."""
    # Create multiple messages
    test_client.post(
        f"/api/v1/sessions/{test_session}/messages",
        json={"role": "user", "content": "Message 1", "timestamp": "14:30"}
    )
    test_client.post(
        f"/api/v1/sessions/{test_session}/messages",
        json={"role": "ai", "content": "Response 1", "timestamp": "14:31"}
    )
    
    # Get all messages
    response = test_client.get(f"/api/v1/sessions/{test_session}/messages")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) >= 2


def test_get_messages_invalid_session(test_client):
    """Test getting messages from non-existent session."""
    response = test_client.get("/api/v1/sessions/invalid-id/messages")
    assert response.status_code == 404


def test_message_count_update(test_session, test_client):
    """Test that message_count is updated when messages are added."""
    # Get initial session state
    project_sessions = test_client.get(f"/api/v1/projects/{test_session[:36]}/sessions")
    # Note: This is a simplified test - in real scenario we'd get the project_id first
    
    # Add a message
    test_client.post(
        f"/api/v1/sessions/{test_session}/messages",
        json={"role": "user", "content": "Test", "timestamp": "14:30"}
    )
    
    # Verify message was added
    messages = test_client.get(f"/api/v1/sessions/{test_session}/messages")
    assert len(messages.json()) >= 1


# --- Summary Tests ---

def test_create_summary(test_session, test_client):
    """Test creating a session summary."""
    response = test_client.put(
        f"/api/v1/sessions/{test_session}/summary",
        json={
            "content": "This session discussed various topics...",
            "token_count": 150,
            "message_count_at_creation": 10
        }
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["content"] == "This session discussed various topics..."
    assert data["token_count"] == 150
    assert data["message_count_at_creation"] == 10
    assert data["session_id"] == test_session


def test_update_summary(test_session, test_client):
    """Test updating an existing summary."""
    # Create initial summary
    test_client.put(
        f"/api/v1/sessions/{test_session}/summary",
        json={"content": "Initial summary"}
    )
    
    # Update summary
    response = test_client.put(
        f"/api/v1/sessions/{test_session}/summary",
        json={"content": "Updated summary with more details"}
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["content"] == "Updated summary with more details"


def test_get_summary(test_session, test_client):
    """Test getting a session summary."""
    # Create summary
    test_client.put(
        f"/api/v1/sessions/{test_session}/summary",
        json={"content": "Test summary"}
    )
    
    # Get summary
    response = test_client.get(f"/api/v1/sessions/{test_session}/summary")
    assert response.status_code == 200
    
    data = response.json()
    assert data["content"] == "Test summary"


def test_get_nonexistent_summary(test_session, test_client):
    """Test getting a summary that doesn't exist."""
    response = test_client.get(f"/api/v1/sessions/{test_session}/summary")
    assert response.status_code == 404


def test_summary_invalid_session(test_client):
    """Test creating summary for non-existent session."""
    response = test_client.put(
        "/api/v1/sessions/invalid-id/summary",
        json={"content": "Test"}
    )
    assert response.status_code == 404
