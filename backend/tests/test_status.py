"""Tests for status topics endpoints."""

import pytest


@pytest.fixture
def test_project(test_client):
    """Create a test project and return its ID."""
    response = test_client.post(
        "/api/v1/projects",
        json={"title": "Test Project for Status"}
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_get_project_status_topics_empty(test_project: str, test_client) -> None:
    """Test getting status topics for project with none."""
    response = test_client.get(f"/api/v1/projects/{test_project}/status")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)


def test_create_status_topic(test_project: str, test_client) -> None:
    """Test creating a status topic."""
    topic_data = {
        "project_id": test_project,
        "title": "Budget",
        "content": "5000 EUR remaining"
    }
    
    response = test_client.post("/api/v1/status", json=topic_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["title"] == "Budget"
    assert data["content"] == "5000 EUR remaining"
    assert data["project_id"] == test_project
    assert data["order_index"] == 0
    # Create seeds a history entry with previous_content=""
    assert len(data["history"]) == 1
    assert data["history"][0]["content"] == ""
    assert data["history"][0]["reason"] == "Created via UI"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_status_topic_with_order(test_project: str, test_client) -> None:
    """Test creating a status topic with specific order."""
    topic_data = {
        "project_id": test_project,
        "title": "Priority Task",
        "content": "High priority",
        "order_index": 5
    }
    
    response = test_client.post("/api/v1/status", json=topic_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["order_index"] == 5


def test_create_status_topic_auto_order(test_project: str, test_client) -> None:
    """Test that order_index auto-increments."""
    # Create first topic
    test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Topic 1",
        "content": "Content 1"
    })
    
    # Create second topic without order_index
    response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Topic 2",
        "content": "Content 2"
    })
    
    data = response.json()
    assert data["order_index"] >= 1  # Should be after first topic


def test_create_status_topic_invalid_project(test_client) -> None:
    """Test creating status topic for non-existent project."""
    topic_data = {
        "project_id": "nonexistent-id",
        "title": "Budget",
        "content": "5000 EUR"
    }
    
    response = test_client.post("/api/v1/status", json=topic_data)
    assert response.status_code == 404


def test_get_project_status_topics(test_project: str, test_client) -> None:
    """Test getting all status topics for a project."""
    # Create multiple topics
    for i in range(3):
        test_client.post("/api/v1/status", json={
            "project_id": test_project,
            "title": f"Topic {i}",
            "content": f"Content {i}",
            "order_index": i
        })
    
    response = test_client.get(f"/api/v1/projects/{test_project}/status")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 3
    
    # Check ordering
    orders = [topic["order_index"] for topic in data]
    assert orders == sorted(orders)  # Should be sorted by order_index


def test_get_project_status_invalid_project(test_client) -> None:
    """Test getting status topics for non-existent project."""
    response = test_client.get("/api/v1/projects/nonexistent-id/status")
    assert response.status_code == 404


def test_get_single_status_topic(test_project: str, test_client) -> None:
    """Test getting a single status topic."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Credits",
        "content": "1000 credits"
    })
    topic_id = create_response.json()["id"]
    
    # Get topic
    response = test_client.get(f"/api/v1/status/{topic_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == topic_id
    assert data["title"] == "Credits"


def test_get_nonexistent_status_topic(test_client) -> None:
    """Test getting a non-existent status topic."""
    response = test_client.get("/api/v1/status/nonexistent-id")
    assert response.status_code == 404


def test_update_status_topic_title(test_project: str, test_client) -> None:
    """Test updating a topic's title."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Old Title",
        "content": "Content"
    })
    topic_id = create_response.json()["id"]
    
    # Update title
    update_data = {"title": "New Title"}
    response = test_client.patch(f"/api/v1/status/{topic_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["title"] == "New Title"
    assert data["content"] == "Content"  # Unchanged
    # Title-only change does not append history; create entry remains
    assert len(data["history"]) == 1
    assert data["history"][0]["reason"] == "Created via UI"


def test_update_status_topic_content_creates_history(test_project: str, test_client) -> None:
    """Test that updating content creates a history entry."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Budget",
        "content": "5000 EUR"
    })
    topic_id = create_response.json()["id"]
    
    # Update content
    update_data = {
        "content": "4000 EUR",
        "reason": "Paid invoice"
    }
    response = test_client.patch(f"/api/v1/status/{topic_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["content"] == "4000 EUR"
    assert len(data["history"]) == 2  # create + content update
    assert data["history"][0]["content"] == ""
    assert data["history"][0]["reason"] == "Created via UI"
    assert data["history"][1]["content"] == "5000 EUR"
    assert data["history"][1]["reason"] == "Paid invoice"
    assert "timestamp" in data["history"][1]


def test_update_status_topic_multiple_history(test_project: str, test_client) -> None:
    """Test creating multiple history entries."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Credits",
        "content": "1000"
    })
    topic_id = create_response.json()["id"]
    
    # Update multiple times
    test_client.patch(f"/api/v1/status/{topic_id}", json={
        "content": "900",
        "reason": "Used 100"
    })
    response = test_client.patch(f"/api/v1/status/{topic_id}", json={
        "content": "800",
        "reason": "Used 100 more"
    })
    
    data = response.json()
    assert data["content"] == "800"
    assert len(data["history"]) == 3  # create + 2 updates
    assert data["history"][0]["content"] == ""
    assert data["history"][1]["content"] == "1000"
    assert data["history"][2]["content"] == "900"


def test_update_status_topic_order(test_project: str, test_client) -> None:
    """Test updating a topic's order."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Topic",
        "content": "Content",
        "order_index": 0
    })
    topic_id = create_response.json()["id"]
    
    # Update order
    update_data = {"order_index": 5}
    response = test_client.patch(f"/api/v1/status/{topic_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["order_index"] == 5


def test_update_nonexistent_status_topic(test_client) -> None:
    """Test updating a non-existent status topic."""
    response = test_client.patch("/api/v1/status/nonexistent-id", json={
        "content": "New content"
    })
    assert response.status_code == 404


def test_delete_status_topic(test_project: str, test_client) -> None:
    """Test deleting a status topic."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "To Delete",
        "content": "Content"
    })
    topic_id = create_response.json()["id"]
    
    # Delete topic
    response = test_client.delete(f"/api/v1/status/{topic_id}")
    assert response.status_code == 204
    
    # Verify deleted
    get_response = test_client.get(f"/api/v1/status/{topic_id}")
    assert get_response.status_code == 404


def test_delete_nonexistent_status_topic(test_client) -> None:
    """Test deleting a non-existent status topic."""
    response = test_client.delete("/api/v1/status/nonexistent-id")
    assert response.status_code == 404


def test_get_status_topic_history(test_project: str, test_client) -> None:
    """Test getting history for a status topic."""
    # Create topic and update it
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Budget",
        "content": "5000 EUR"
    })
    topic_id = create_response.json()["id"]
    
    # Update content
    test_client.patch(f"/api/v1/status/{topic_id}", json={
        "content": "4000 EUR",
        "reason": "Expense"
    })
    
    # Get history
    response = test_client.get(f"/api/v1/status/{topic_id}/history")
    assert response.status_code == 200
    
    history = response.json()
    assert len(history) == 2  # create + update
    assert history[0]["content"] == ""
    assert history[0]["reason"] == "Created via UI"
    assert history[1]["content"] == "5000 EUR"
    assert history[1]["reason"] == "Expense"


def test_get_history_nonexistent_topic(test_client) -> None:
    """Test getting history for non-existent topic."""
    response = test_client.get("/api/v1/status/nonexistent-id/history")
    assert response.status_code == 404


def test_update_same_content_no_history(test_project: str, test_client) -> None:
    """Test that updating with same content doesn't create history."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Topic",
        "content": "Same content"
    })
    topic_id = create_response.json()["id"]
    
    # Update with same content
    response = test_client.patch(f"/api/v1/status/{topic_id}", json={
        "content": "Same content",
        "reason": "No change"
    })
    
    data = response.json()
    # Same content: no new history entry; create entry remains
    assert len(data["history"]) == 1
    assert data["history"][0]["reason"] == "Created via UI"


def test_update_without_reason(test_project: str, test_client) -> None:
    """Test updating content without providing reason."""
    # Create topic
    create_response = test_client.post("/api/v1/status", json={
        "project_id": test_project,
        "title": "Topic",
        "content": "Original"
    })
    topic_id = create_response.json()["id"]
    
    # Update without reason
    response = test_client.patch(f"/api/v1/status/{topic_id}", json={
        "content": "Updated"
    })
    
    data = response.json()
    assert len(data["history"]) == 2  # create + update
    assert data["history"][1]["content"] == "Original"
    assert data["history"][1]["reason"] == "Updated via UI"
