"""Project endpoints for CRUD operations."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.database import get_db
from src.models import Project, Session
from src.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse

router = APIRouter()


@router.get("/projects", response_model=list[ProjectResponse])
async def get_projects(db: AsyncSession = Depends(get_db)):
    """Get all projects with session counts.
    
    Args:
        db: Database session
        
    Returns:
        List of all projects with session_count populated
        
    Example:
        >>> response = await get_projects()
        >>> len(response)
        3
    """
    # Get all projects
    result = await db.execute(select(Project))
    projects = list(result.scalars().all())
    
    # Count sessions per project
    session_counts = {}
    for project in projects:
        count_result = await db.execute(
            select(func.count(Session.id)).where(Session.project_id == project.id)
        )
        session_counts[project.id] = count_result.scalar() or 0
    
    # Build response with session_count
    return [
        ProjectResponse(
            id=p.id,
            title=p.title,
            session_count=session_counts.get(p.id, 0),
            created_at=p.created_at,
            updated_at=p.updated_at
        )
        for p in projects
    ]


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    project_data: ProjectCreate,
    db: AsyncSession = Depends(get_db)
) -> Project:
    """Create a new project.
    
    Args:
        project_data: Project creation data
        db: Database session
        
    Returns:
        Newly created project
        
    Example:
        >>> project = await create_project(ProjectCreate(title="My Project"))
        >>> project.title
        'My Project'
    """
    project = Project(title=project_data.title)
    db.add(project)
    await db.commit()
    await db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> Project:
    """Get a single project by ID.
    
    Args:
        project_id: Project UUID
        db: Database session
        
    Returns:
        Project with matching ID
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> project = await get_project("abc-123")
        >>> project.id
        'abc-123'
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    return project


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: str,
    project_data: ProjectUpdate,
    db: AsyncSession = Depends(get_db)
) -> Project:
    """Update a project's title.
    
    Args:
        project_id: Project UUID
        project_data: Update data
        db: Database session
        
    Returns:
        Updated project
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> project = await update_project("abc-123", ProjectUpdate(title="New Name"))
        >>> project.title
        'New Name'
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    project.title = project_data.title
    await db.commit()
    await db.refresh(project)
    return project


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a project and all related data.
    
    Cascades to delete sessions, library items, and status topics.
    
    Args:
        project_id: Project UUID
        db: Database session
        
    Raises:
        HTTPException: 404 if project not found
        
    Example:
        >>> await delete_project("abc-123")
        # Project and all related data deleted
    """
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with id {project_id} not found"
        )
    
    await db.delete(project)
    await db.commit()
