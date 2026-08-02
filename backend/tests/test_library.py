"""Tests for library endpoints."""

import pytest


@pytest.fixture
def test_project(test_client):
    """Create a test project and return its ID."""
    response = test_client.post(
        "/api/v1/projects",
        json={"title": "Test Project for Library"}
    )
    assert response.status_code == 201
    return response.json()["id"]


def test_create_folder(test_project: str, test_client) -> None:
    """Test creating a folder in a project."""
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Test Folder"
    }
    
    response = test_client.post("/api/v1/library/folders", json=folder_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Test Folder"
    assert data["project_id"] == test_project
    assert data["parent_id"] is None
    assert "id" in data
    assert "created_at" in data


def test_create_nested_folder(test_project: str, test_client) -> None:
    """Test creating a nested folder."""
    # Create parent folder
    parent_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Parent"
    }
    parent_response = test_client.post("/api/v1/library/folders", json=parent_data)
    parent_id = parent_response.json()["id"]
    
    # Create child folder
    child_data = {
        "project_id": test_project,
        "parent_id": parent_id,
        "name": "Child"
    }
    
    response = test_client.post("/api/v1/library/folders", json=child_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["name"] == "Child"
    assert data["parent_id"] == parent_id


def test_get_project_folders(test_project: str, test_client) -> None:
    """Test getting all folders for a project."""
    # Create two folders
    for i in range(2):
        folder_data = {
            "project_id": test_project,
            "parent_id": None,
            "name": f"Folder {i}"
        }
        test_client.post("/api/v1/library/folders", json=folder_data)
    
    response = test_client.get(f"/api/v1/projects/{test_project}/library/folders")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 2
    assert all(f["project_id"] == test_project for f in data)


def test_update_folder(test_project: str, test_client) -> None:
    """Test updating a folder's name."""
    # Create folder
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Old Name"
    }
    create_response = test_client.post("/api/v1/library/folders", json=folder_data)
    folder_id = create_response.json()["id"]
    
    # Update folder
    update_data = {"name": "New Name"}
    response = test_client.patch(f"/api/v1/library/folders/{folder_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["name"] == "New Name"
    assert data["id"] == folder_id


def test_delete_folder(test_project: str, test_client) -> None:
    """Test deleting a folder."""
    # Create folder
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "To Delete"
    }
    create_response = test_client.post("/api/v1/library/folders", json=folder_data)
    folder_id = create_response.json()["id"]
    
    # Delete folder
    response = test_client.delete(f"/api/v1/library/folders/{folder_id}")
    assert response.status_code == 204
    
    # Verify folder is gone
    get_response = test_client.get(f"/api/v1/projects/{test_project}/library/folders")
    folders = get_response.json()
    assert not any(f["id"] == folder_id for f in folders)


def test_delete_folder_moves_items_to_root(test_project: str, test_client) -> None:
    """Test that deleting a folder moves its items to root."""
    # Create folder
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Folder"
    }
    folder_response = test_client.post("/api/v1/library/folders", json=folder_data)
    folder_id = folder_response.json()["id"]
    
    # Create item in folder
    item_data = {
        "project_id": test_project,
        "folder_id": folder_id,
        "title": "Test Item",
        "content": "Content",
        "item_type": "text"
    }
    item_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = item_response.json()["id"]
    
    # Delete folder
    test_client.delete(f"/api/v1/library/folders/{folder_id}")
    
    # Check that item is now in root
    items_response = test_client.get(f"/api/v1/projects/{test_project}/library/items")
    items = items_response.json()
    item = next(i for i in items if i["id"] == item_id)
    assert item["folder_id"] is None


def test_create_item(test_project: str, test_client) -> None:
    """Test creating a library item."""
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Test Document",
        "content": "This is test content",
        "item_type": "text"
    }
    
    response = test_client.post("/api/v1/library/items", json=item_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["title"] == "Test Document"
    assert data["content"] == "This is test content"
    assert data["item_type"] == "text"
    assert data["version"] == 1
    assert data["history"] == []
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


def test_create_item_in_folder(test_project: str, test_client) -> None:
    """Test creating an item in a folder."""
    # Create folder
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Documents"
    }
    folder_response = test_client.post("/api/v1/library/folders", json=folder_data)
    folder_id = folder_response.json()["id"]
    
    # Create item in folder
    item_data = {
        "project_id": test_project,
        "folder_id": folder_id,
        "title": "Document",
        "content": "Content",
        "item_type": "markdown"
    }
    
    response = test_client.post("/api/v1/library/items", json=item_data)
    assert response.status_code == 201
    
    data = response.json()
    assert data["folder_id"] == folder_id


def test_get_project_items(test_project: str, test_client) -> None:
    """Test getting all items for a project."""
    # Create two items
    for i in range(2):
        item_data = {
            "project_id": test_project,
            "folder_id": None,
            "title": f"Item {i}",
            "content": f"Content {i}",
            "item_type": "text"
        }
        test_client.post("/api/v1/library/items", json=item_data)
    
    response = test_client.get(f"/api/v1/projects/{test_project}/library/items")
    assert response.status_code == 200
    
    data = response.json()
    assert len(data) >= 2
    assert all(i["project_id"] == test_project for i in data)


def test_update_item_title(test_project: str, test_client) -> None:
    """Test updating an item's title."""
    # Create item
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Old Title",
        "content": "Content",
        "item_type": "text"
    }
    create_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = create_response.json()["id"]
    
    # Update title
    update_data = {"title": "New Title"}
    response = test_client.patch(f"/api/v1/library/items/{item_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["title"] == "New Title"
    assert data["version"] == 1  # Version unchanged for title change
    assert data["history"] == []


def test_update_item_content_creates_version(test_project: str, test_client) -> None:
    """Test that updating content creates a new version."""
    # Create item
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Document",
        "content": "Version 1",
        "item_type": "text"
    }
    create_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = create_response.json()["id"]
    
    # Update content
    update_data = {"content": "Version 2"}
    response = test_client.patch(f"/api/v1/library/items/{item_id}", json=update_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["content"] == "Version 2"
    assert data["version"] == 2
    assert len(data["history"]) == 1
    assert data["history"][0]["version"] == 1
    assert data["history"][0]["content"] == "Version 1"


def test_update_item_multiple_versions(test_project: str, test_client) -> None:
    """Test creating multiple versions."""
    # Create item
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Document",
        "content": "V1",
        "item_type": "text"
    }
    create_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = create_response.json()["id"]
    
    # Update content twice
    test_client.patch(f"/api/v1/library/items/{item_id}", json={"content": "V2"})
    response = test_client.patch(f"/api/v1/library/items/{item_id}", json={"content": "V3"})
    
    data = response.json()
    assert data["content"] == "V3"
    assert data["version"] == 3
    assert len(data["history"]) == 2


def test_delete_item(test_project: str, test_client) -> None:
    """Test deleting an item."""
    # Create item
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "To Delete",
        "content": "Content",
        "item_type": "text"
    }
    create_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = create_response.json()["id"]
    
    # Delete item
    response = test_client.delete(f"/api/v1/library/items/{item_id}")
    assert response.status_code == 204
    
    # Verify item is gone
    get_response = test_client.get(f"/api/v1/projects/{test_project}/library/items")
    items = get_response.json()
    assert not any(i["id"] == item_id for i in items)


def test_get_item_history(test_project: str, test_client) -> None:
    """Test getting item version history."""
    # Create item and update it
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Document",
        "content": "V1",
        "item_type": "text"
    }
    create_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = create_response.json()["id"]
    
    test_client.patch(f"/api/v1/library/items/{item_id}", json={"content": "V2"})
    
    # Get history
    response = test_client.get(f"/api/v1/library/items/{item_id}/history")
    assert response.status_code == 200
    
    history = response.json()
    assert len(history) == 1
    assert history[0]["version"] == 1
    assert history[0]["content"] == "V1"


def test_move_item(test_project: str, test_client) -> None:
    """Test moving an item to a different folder."""
    # Create folder
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Target Folder"
    }
    folder_response = test_client.post("/api/v1/library/folders", json=folder_data)
    folder_id = folder_response.json()["id"]
    
    # Create item in root
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Item",
        "content": "Content",
        "item_type": "text"
    }
    item_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = item_response.json()["id"]
    
    # Move item to folder
    move_data = {"folder_id": folder_id}
    response = test_client.patch(f"/api/v1/library/items/{item_id}/move", json=move_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["folder_id"] == folder_id


def test_move_item_to_root(test_project: str, test_client) -> None:
    """Test moving an item from folder to root."""
    # Create folder
    folder_data = {
        "project_id": test_project,
        "parent_id": None,
        "name": "Folder"
    }
    folder_response = test_client.post("/api/v1/library/folders", json=folder_data)
    folder_id = folder_response.json()["id"]
    
    # Create item in folder
    item_data = {
        "project_id": test_project,
        "folder_id": folder_id,
        "title": "Item",
        "content": "Content",
        "item_type": "text"
    }
    item_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = item_response.json()["id"]
    
    # Move item to root
    move_data = {"folder_id": None}
    response = test_client.patch(f"/api/v1/library/items/{item_id}/move", json=move_data)
    assert response.status_code == 200
    
    data = response.json()
    assert data["folder_id"] is None


def test_create_folder_nonexistent_project(test_client) -> None:
    """Test creating a folder for non-existent project fails."""
    folder_data = {
        "project_id": "nonexistent-id",
        "parent_id": None,
        "name": "Folder"
    }
    
    response = test_client.post("/api/v1/library/folders", json=folder_data)
    assert response.status_code == 404


def test_create_item_nonexistent_project(test_client) -> None:
    """Test creating an item for non-existent project fails."""
    item_data = {
        "project_id": "nonexistent-id",
        "folder_id": None,
        "title": "Item",
        "content": "Content",
        "item_type": "text"
    }
    
    response = test_client.post("/api/v1/library/items", json=item_data)
    assert response.status_code == 404


def test_create_item_nonexistent_folder(test_project: str, test_client) -> None:
    """Test creating an item in non-existent folder fails."""
    item_data = {
        "project_id": test_project,
        "folder_id": "nonexistent-folder",
        "title": "Item",
        "content": "Content",
        "item_type": "text"
    }
    
    response = test_client.post("/api/v1/library/items", json=item_data)
    assert response.status_code == 404


def test_move_item_nonexistent_folder(test_project: str, test_client) -> None:
    """Test moving an item to non-existent folder fails."""
    # Create item
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Item",
        "content": "Content",
        "item_type": "text"
    }
    item_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = item_response.json()["id"]
    
    # Try to move to non-existent folder
    move_data = {"folder_id": "nonexistent-folder"}
    response = test_client.patch(f"/api/v1/library/items/{item_id}/move", json=move_data)
    assert response.status_code == 404


def test_update_item_same_content_no_version(test_project: str, test_client) -> None:
    """Test that updating with same content doesn't create new version."""
    # Create item
    item_data = {
        "project_id": test_project,
        "folder_id": None,
        "title": "Document",
        "content": "Same content",
        "item_type": "text"
    }
    create_response = test_client.post("/api/v1/library/items", json=item_data)
    item_id = create_response.json()["id"]
    
    # Update with same content
    update_data = {"content": "Same content"}
    response = test_client.patch(f"/api/v1/library/items/{item_id}", json=update_data)
    
    data = response.json()
    assert data["version"] == 1  # No version increment
    assert data["history"] == []


def test_export_library_zip(test_project: str, test_client) -> None:
    """Test ZIP export of all library items as .md files."""
    import io
    import zipfile

    test_client.post(
        "/api/v1/library/items",
        json={
            "project_id": test_project,
            "folder_id": None,
            "title": "Notes One",
            "content": "# One",
            "item_type": "markdown",
        },
    )
    test_client.post(
        "/api/v1/library/items",
        json={
            "project_id": test_project,
            "folder_id": None,
            "title": "Notes Two",
            "content": "Plain two",
            "item_type": "text",
        },
    )

    response = test_client.get(
        f"/api/v1/projects/{test_project}/library/export.zip",
        params={"format": "md"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/zip")

    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert "Notes_One.md" in names
        assert "Notes_Two.md" in names
        assert archive.read("Notes_One.md").decode("utf-8") == "# One"


def test_export_library_zip_empty(test_project: str, test_client) -> None:
    """Empty library cannot be exported as ZIP."""
    response = test_client.get(f"/api/v1/projects/{test_project}/library/export.zip")
    assert response.status_code == 400


def test_export_library_zip_duplicate_titles(test_project: str, test_client) -> None:
    """Duplicate titles get unique ZIP entry names."""
    import io
    import zipfile

    for _ in range(2):
        test_client.post(
            "/api/v1/library/items",
            json={
                "project_id": test_project,
                "folder_id": None,
                "title": "Same Title",
                "content": "x",
                "item_type": "text",
            },
        )

    response = test_client.get(
        f"/api/v1/projects/{test_project}/library/export.zip",
        params={"format": "txt"},
    )
    assert response.status_code == 200
    with zipfile.ZipFile(io.BytesIO(response.content)) as archive:
        names = set(archive.namelist())
        assert "Same_Title.txt" in names
        assert "Same_Title_2.txt" in names
