"""Pydantic schemas for Library endpoints."""

from datetime import datetime

from pydantic import BaseModel, Field


class LibraryFolderCreate(BaseModel):
    """Schema for creating a library folder.
    
    Attributes:
        project_id: Parent project ID
        parent_id: Parent folder ID (optional, for nested folders)
        name: Folder name
    """
    
    project_id: str = Field(..., description="Parent project UUID")
    parent_id: str | None = Field(None, description="Parent folder UUID (optional)")
    name: str = Field(..., min_length=1, max_length=200, description="Folder name")


class LibraryFolderUpdate(BaseModel):
    """Schema for updating a library folder.
    
    Attributes:
        name: New folder name
    """
    
    name: str = Field(..., min_length=1, max_length=200, description="New folder name")


class LibraryFolderResponse(BaseModel):
    """Schema for library folder responses.
    
    Attributes:
        id: Unique folder identifier
        project_id: Parent project ID
        parent_id: Parent folder ID (null for root folders)
        name: Folder name
        created_at: Creation timestamp
    """
    
    id: str
    project_id: str
    parent_id: str | None
    name: str
    created_at: datetime
    
    model_config = {"from_attributes": True}


class LibraryItemCreate(BaseModel):
    """Schema for creating a library item.
    
    Attributes:
        project_id: Parent project ID
        folder_id: Parent folder ID (optional)
        title: Item title
        content: Item content
        item_type: File type (text, markdown, pdf)
    """
    
    project_id: str = Field(..., description="Parent project UUID")
    folder_id: str | None = Field(None, description="Parent folder UUID (optional)")
    title: str = Field(..., min_length=1, max_length=200, description="Item title")
    content: str = Field(..., min_length=1, description="Item content")
    item_type: str = Field(default="text", description="File type: text, markdown, pdf")


class LibraryItemUpdate(BaseModel):
    """Schema for updating a library item.
    
    Creates a new version when content is changed.
    
    Attributes:
        title: New title (optional)
        content: New content (optional, creates new version)
        folder_id: Move to different folder (optional, use null for root)
    """
    
    title: str | None = Field(None, min_length=1, max_length=200, description="New title")
    content: str | None = Field(None, min_length=1, description="New content")
    folder_id: str | None = Field(None, description="Move to folder (null = root)")


class LibraryItemResponse(BaseModel):
    """Schema for library item responses.
    
    Attributes:
        id: Unique item identifier
        project_id: Parent project ID
        folder_id: Parent folder ID (null for root items)
        title: Item title
        content: Current content
        item_type: File type
        version: Current version number
        history: Version history
        created_at: Creation timestamp
        updated_at: Last update timestamp
    """
    
    id: str
    project_id: str
    folder_id: str | None
    title: str
    content: str
    item_type: str
    version: int
    history: list[dict]
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}


class LibraryItemMove(BaseModel):
    """Schema for moving an item to a folder.
    
    Attributes:
        folder_id: Target folder ID (null for root)
    """
    
    folder_id: str | None = Field(None, description="Target folder UUID (null for root)")
