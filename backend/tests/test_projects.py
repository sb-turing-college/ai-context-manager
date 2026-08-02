"""Tests for project CRUD endpoints."""

import pytest


def test_create_project(test_client):
    """Test creating a new project."""
    response = test_client.post(
        "/api/v1/projects",
        json={"title": "Test Project"}
    )
    assert response.status_code == 201
    
    data = response.json()
    assert data["title"] == "Test Project"
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_get_projects(test_client):
    """Test getting all projects."""
    # Create a project first
    create_response = test_client.post(
        "/api/v1/projects",
        json={"title": "Project for List Test"}
    )
    assert create_response.status_code == 201
    
    # Get all projects
    response = test_client.get("/api/v1/projects")
    assert response.status_code == 200
    
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0
    assert any(p["title"] == "Project for List Test" for p in data)


def test_get_single_project(test_client):
    """Test getting a single project by ID."""
    # Create a project
    create_response = test_client.post(
        "/api/v1/projects",
        json={"title": "Project for Get Test"}
    )
    project_id = create_response.json()["id"]
    
    # Get the project
    response = test_client.get(f"/api/v1/projects/{project_id}")
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == project_id
    assert data["title"] == "Project for Get Test"


def test_get_nonexistent_project(test_client):
    """Test getting a project that doesn't exist."""
    response = test_client.get("/api/v1/projects/nonexistent-id")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_update_project(test_client):
    """Test updating a project's title."""
    # Create a project
    create_response = test_client.post(
        "/api/v1/projects",
        json={"title": "Original Title"}
    )
    project_id = create_response.json()["id"]
    
    # Update the project
    response = test_client.patch(
        f"/api/v1/projects/{project_id}",
        json={"title": "Updated Title"}
    )
    assert response.status_code == 200
    
    data = response.json()
    assert data["id"] == project_id
    assert data["title"] == "Updated Title"
    
    # Verify update persisted
    get_response = test_client.get(f"/api/v1/projects/{project_id}")
    assert get_response.json()["title"] == "Updated Title"


def test_update_nonexistent_project(test_client):
    """Test updating a project that doesn't exist."""
    response = test_client.patch(
        "/api/v1/projects/nonexistent-id",
        json={"title": "New Title"}
    )
    assert response.status_code == 404


def test_delete_project(test_client):
    """Test deleting a project."""
    # Create a project
    create_response = test_client.post(
        "/api/v1/projects",
        json={"title": "Project to Delete"}
    )
    project_id = create_response.json()["id"]
    
    # Delete the project
    response = test_client.delete(f"/api/v1/projects/{project_id}")
    assert response.status_code == 204
    
    # Verify deletion
    get_response = test_client.get(f"/api/v1/projects/{project_id}")
    assert get_response.status_code == 404


def test_delete_nonexistent_project(test_client):
    """Test deleting a project that doesn't exist."""
    response = test_client.delete("/api/v1/projects/nonexistent-id")
    assert response.status_code == 404


def test_create_project_validation(test_client):
    """Test validation for project creation."""
    # Empty title
    response = test_client.post(
        "/api/v1/projects",
        json={"title": ""}
    )
    assert response.status_code == 422  # Validation error
    
    # Missing title
    response = test_client.post(
        "/api/v1/projects",
        json={}
    )
    assert response.status_code == 422
