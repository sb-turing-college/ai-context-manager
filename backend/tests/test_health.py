"""Tests for health check endpoints."""

import pytest


def test_health_check(test_client):
    """Test the /health endpoint returns healthy status.
    
    Verifies that the API is running and responds with correct version.
    """
    response = test_client.get("/api/v1/health")
    assert response.status_code == 200
    
    data = response.json()
    assert data["status"] == "healthy"
    assert "version" in data
    assert data["version"] == "0.1.0"


def test_api_info(test_client):
    """Test the /info endpoint returns API information.
    
    Verifies that all required API metadata is present.
    """
    response = test_client.get("/api/v1/info")
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == "AI Context Manager"
    assert data["version"] == "0.1.0"
    assert "google" in data["providers"]
    assert "anthropic" in data["providers"]
    assert data["database"] == "sqlite"
    assert "streaming" in data["features"]
    assert "tool_use" in data["features"]


def test_root_endpoint(test_client):
    """Test the root / endpoint returns welcome message."""
    response = test_client.get("/")
    assert response.status_code == 200
    
    data = response.json()
    assert data["message"] == "AI Context Manager API"
    assert data["docs"] == "/docs"
    assert data["health"] == "/api/v1/health"
