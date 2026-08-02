"""Library endpoints for documents and folders."""

import io
import re
import zipfile
from datetime import datetime, UTC
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import LibraryItem, LibraryFolder, Project
from src.schemas.library import (
    LibraryFolderCreate,
    LibraryFolderUpdate,
    LibraryFolderResponse,
    LibraryItemCreate,
    LibraryItemUpdate,
    LibraryItemResponse,
    LibraryItemMove,
)

router = APIRouter()


# --- Folder Endpoints ---

@router.get("/projects/{project_id}/library/folders", response_model=list[LibraryFolderResponse])
async def get_project_folders(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[LibraryFolder]:
    """Get all library folders for a project.
    
    Args:
        project_id: Project UUID
        db: Database session
        
    Returns:
        List of folders for the project
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> folders = await get_project_folders("abc-123")
        >>> len(folders)
        3
    """
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    # Get folders
    result = await db.execute(
        select(LibraryFolder).where(LibraryFolder.project_id == project_id)
    )
    folders = result.scalars().all()
    return list(folders)


@router.post("/library/folders", response_model=LibraryFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_folder(
    folder_data: LibraryFolderCreate,
    db: AsyncSession = Depends(get_db)
) -> LibraryFolder:
    """Create a new library folder.
    
    Args:
        folder_data: Folder creation data
        db: Database session
        
    Returns:
        Newly created folder
        
    Raises:
        HTTPException: 404 if project or parent folder not found
        
    Example:
        >>> folder = await create_folder(
        ...     LibraryFolderCreate(project_id="abc-123", name="Docs")
        ... )
        >>> folder.name
        'Docs'
    """
    # Verify project exists
    result = await db.execute(
        select(Project).where(Project.id == folder_data.project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {folder_data.project_id} not found"
        )
    
    # Verify parent folder exists if provided
    if folder_data.parent_id:
        result = await db.execute(
            select(LibraryFolder).where(LibraryFolder.id == folder_data.parent_id)
        )
        parent = result.scalar_one_or_none()
        
        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent folder with id {folder_data.parent_id} not found"
            )
    
    folder = LibraryFolder(
        project_id=folder_data.project_id,
        parent_id=folder_data.parent_id,
        name=folder_data.name
    )
    db.add(folder)
    await db.commit()
    await db.refresh(folder)
    return folder


@router.patch("/library/folders/{folder_id}", response_model=LibraryFolderResponse)
async def update_folder(
    folder_id: str,
    folder_data: LibraryFolderUpdate,
    db: AsyncSession = Depends(get_db)
) -> LibraryFolder:
    """Update a folder's name.
    
    Args:
        folder_id: Folder UUID
        folder_data: Update data
        db: Database session
        
    Returns:
        Updated folder
        
    Raises:
        HTTPException: 404 if folder not found
        
    Example:
        >>> folder = await update_folder(
        ...     "def-456",
        ...     LibraryFolderUpdate(name="Documents")
        ... )
        >>> folder.name
        'Documents'
    """
    result = await db.execute(select(LibraryFolder).where(LibraryFolder.id == folder_id))
    folder = result.scalar_one_or_none()
    
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with id {folder_id} not found"
        )
    
    folder.name = folder_data.name
    await db.commit()
    await db.refresh(folder)
    return folder


@router.delete("/library/folders/{folder_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_folder(
    folder_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a folder and move its items to root.
    
    Items in the folder are NOT deleted, just moved to root (folder_id = null).
    
    Args:
        folder_id: Folder UUID
        db: Database session
        
    Raises:
        HTTPException: 404 if folder not found
        
    Example:
        >>> await delete_folder("def-456")
        # Folder deleted, items moved to root
    """
    result = await db.execute(select(LibraryFolder).where(LibraryFolder.id == folder_id))
    folder = result.scalar_one_or_none()
    
    if not folder:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Folder with id {folder_id} not found"
        )
    
    # Move all items in this folder to root
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.folder_id == folder_id)
    )
    items = result.scalars().all()
    
    for item in items:
        item.folder_id = None
    
    await db.delete(folder)
    await db.commit()


# --- Item Endpoints ---

@router.get("/projects/{project_id}/library/items", response_model=list[LibraryItemResponse])
async def get_project_items(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[LibraryItem]:
    """Get all library items for a project.
    
    Args:
        project_id: Project UUID
        db: Database session
        
    Returns:
        List of items for the project
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> items = await get_project_items("abc-123")
        >>> len(items)
        10
    """
    # Verify project exists
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    # Get items
    result = await db.execute(
        select(LibraryItem).where(LibraryItem.project_id == project_id)
    )
    items = result.scalars().all()
    return list(items)


@router.post("/library/items", response_model=LibraryItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item_data: LibraryItemCreate,
    db: AsyncSession = Depends(get_db)
) -> LibraryItem:
    """Create a new library item.
    
    Args:
        item_data: Item creation data
        db: Database session
        
    Returns:
        Newly created item
        
    Raises:
        HTTPException: 404 if project or folder not found
        
    Example:
        >>> item = await create_item(
        ...     LibraryItemCreate(
        ...         project_id="abc-123",
        ...         title="Notes",
        ...         content="Some notes..."
        ...     )
        ... )
        >>> item.version
        1
    """
    # Verify project exists
    result = await db.execute(
        select(Project).where(Project.id == item_data.project_id)
    )
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {item_data.project_id} not found"
        )
    
    # Verify folder exists if provided
    if item_data.folder_id:
        result = await db.execute(
            select(LibraryFolder).where(LibraryFolder.id == item_data.folder_id)
        )
        folder = result.scalar_one_or_none()
        
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Folder with id {item_data.folder_id} not found"
            )
    
    item = LibraryItem(
        project_id=item_data.project_id,
        folder_id=item_data.folder_id,
        title=item_data.title,
        content=item_data.content,
        item_type=item_data.item_type,
        version=1,
        history=[]
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/library/items/{item_id}", response_model=LibraryItemResponse)
async def update_item(
    item_id: str,
    item_data: LibraryItemUpdate,
    db: AsyncSession = Depends(get_db)
) -> LibraryItem:
    """Update a library item.
    
    If content is changed, a new version is created and old content is saved to history.
    
    Args:
        item_id: Item UUID
        item_data: Update data
        db: Database session
        
    Returns:
        Updated item
        
    Raises:
        HTTPException: 404 if item not found
        
    Example:
        >>> item = await update_item(
        ...     "ghi-789",
        ...     LibraryItemUpdate(content="Updated content")
        ... )
        >>> item.version
        2
    """
    result = await db.execute(select(LibraryItem).where(LibraryItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found"
        )
    
    # Update title if provided
    if item_data.title is not None:
        item.title = item_data.title
    
    # Update content and create new version if changed
    if item_data.content is not None and item_data.content != item.content:
        # Save current version to history
        history_entry = {
            "version": item.version,
            "content": item.content,
            "timestamp": datetime.now(UTC).isoformat()
        }
        item.history = item.history + [history_entry]
        
        # Update to new version
        item.content = item_data.content
        item.version += 1
    
    # Move to different folder if provided
    if "folder_id" in item_data.model_dump(exclude_unset=True):
        # Verify folder exists if not moving to root
        if item_data.folder_id is not None:
            result = await db.execute(
                select(LibraryFolder).where(LibraryFolder.id == item_data.folder_id)
            )
            folder = result.scalar_one_or_none()
            
            if not folder:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Folder with id {item_data.folder_id} not found"
                )
        
        item.folder_id = item_data.folder_id
    
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/library/items/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_item(
    item_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a library item.
    
    Args:
        item_id: Item UUID
        db: Database session
        
    Raises:
        HTTPException: 404 if item not found
        
    Example:
        >>> await delete_item("ghi-789")
        # Item deleted permanently
    """
    result = await db.execute(select(LibraryItem).where(LibraryItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found"
        )
    
    await db.delete(item)
    await db.commit()


@router.get("/library/items/{item_id}/history", response_model=list[dict])
async def get_item_history(
    item_id: str,
    db: AsyncSession = Depends(get_db)
) -> list[dict]:
    """Get version history for a library item.
    
    Args:
        item_id: Item UUID
        db: Database session
        
    Returns:
        List of version history entries
        
    Raises:
        HTTPException: 404 if item not found
        
    Example:
        >>> history = await get_item_history("ghi-789")
        >>> len(history)
        3
    """
    result = await db.execute(select(LibraryItem).where(LibraryItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found"
        )
    
    return item.history


@router.patch("/library/items/{item_id}/move", response_model=LibraryItemResponse)
async def move_item(
    item_id: str,
    move_data: LibraryItemMove,
    db: AsyncSession = Depends(get_db)
) -> LibraryItem:
    """Move an item to a different folder.
    
    Args:
        item_id: Item UUID
        move_data: Target folder ID
        db: Database session
        
    Returns:
        Updated item
        
    Raises:
        HTTPException: 404 if item or folder not found
        
    Example:
        >>> item = await move_item(
        ...     "ghi-789",
        ...     LibraryItemMove(folder_id="def-456")
        ... )
        >>> item.folder_id
        'def-456'
    """
    result = await db.execute(select(LibraryItem).where(LibraryItem.id == item_id))
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Item with id {item_id} not found"
        )
    
    # Verify folder exists if not moving to root
    if move_data.folder_id is not None:
        result = await db.execute(
            select(LibraryFolder).where(LibraryFolder.id == move_data.folder_id)
        )
        folder = result.scalar_one_or_none()
        
        if not folder:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Folder with id {move_data.folder_id} not found"
            )
    
    item.folder_id = move_data.folder_id
    await db.commit()
    await db.refresh(item)
    return item


def _safe_zip_filename(title: str, extension: str, used: set[str]) -> str:
    """Build a ZIP entry name from a library title (sanitize + unique)."""
    base = re.sub(r"[^\w\s.-]", "", title or "", flags=re.UNICODE).strip()
    base = re.sub(r"\s+", "_", base) if base else "document"
    base = base[:80] or "document"
    candidate = f"{base}.{extension}"
    if candidate not in used:
        used.add(candidate)
        return candidate
    index = 2
    while f"{base}_{index}.{extension}" in used:
        index += 1
    candidate = f"{base}_{index}.{extension}"
    used.add(candidate)
    return candidate


@router.get("/projects/{project_id}/library/export.zip")
async def export_library_zip(
    project_id: str,
    format: Literal["md", "txt"] = Query("md"),
    db: AsyncSession = Depends(get_db),
) -> StreamingResponse:
    """Download all library items for a project as a ZIP of text files.

    Each item becomes one ``.md`` or ``.txt`` entry (content as stored; no PDF
    conversion). Folder structure is not preserved (flat ZIP).
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found",
        )

    result = await db.execute(
        select(LibraryItem).where(LibraryItem.project_id == project_id)
    )
    items = list(result.scalars().all())
    if not items:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Library is empty — nothing to export",
        )

    buffer = io.BytesIO()
    used_names: set[str] = set()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for item in items:
            name = _safe_zip_filename(item.title, format, used_names)
            archive.writestr(name, item.content or "")

    buffer.seek(0)
    filename = f"library-export-{project_id[:8]}.{format}.zip"
    return StreamingResponse(
        buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
