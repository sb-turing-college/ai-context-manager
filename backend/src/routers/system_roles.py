"""System Roles endpoints for Workshop feature.

System Roles define AI personas/behaviors for different artifact types.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from src.database import get_db
from src.models.settings import SystemRole


router = APIRouter(tags=["system-roles"])


class SystemRoleResponse(BaseModel):
    """System Role response."""
    id: str
    title: str
    prompt: str


class SystemRoleCreateRequest(BaseModel):
    """Create system role request."""
    title: str = Field(..., min_length=1, max_length=200)
    prompt: str = Field(..., min_length=1)


class SystemRoleUpdateRequest(BaseModel):
    """Update system role request."""
    title: str | None = Field(None, min_length=1, max_length=200)
    prompt: str | None = Field(None, min_length=1)


@router.get("/system-roles", response_model=list[SystemRoleResponse])
async def get_system_roles(
    db: AsyncSession = Depends(get_db)
) -> list[SystemRoleResponse]:
    """Get all system roles.
    
    Returns:
        List of system roles
        
    Example response:
        [
            {
                "id": "role-123",
                "title": "Code Review Expert",
                "prompt": "You are an experienced code reviewer..."
            }
        ]
    """
    result = await db.execute(select(SystemRole))
    roles = result.scalars().all()
    
    return [
        SystemRoleResponse(
            id=role.id,
            title=role.title,
            prompt=role.content  # Model uses 'content', not 'prompt'
        )
        for role in roles
    ]


@router.post("/system-roles", response_model=SystemRoleResponse, status_code=status.HTTP_201_CREATED)
async def create_system_role(
    request: SystemRoleCreateRequest,
    db: AsyncSession = Depends(get_db)
) -> SystemRoleResponse:
    """Create a new system role.
    
    Args:
        request: System role data
        
    Returns:
        Created system role
        
    Example request:
        {
            "title": "Code Review Expert",
            "prompt": "You are an experienced code reviewer..."
        }
    """
    role = SystemRole(
        title=request.title,
        content=request.prompt,  # Model uses 'content', API uses 'prompt'
        category="chat",  # Default category
        is_default=False
    )
    
    db.add(role)
    await db.commit()
    await db.refresh(role)
    
    return SystemRoleResponse(
        id=role.id,
        title=role.title,
        prompt=role.content  # Model uses 'content', API uses 'prompt'
    )


@router.patch("/system-roles/{role_id}", response_model=SystemRoleResponse)
async def update_system_role(
    role_id: str,
    request: SystemRoleUpdateRequest,
    db: AsyncSession = Depends(get_db)
) -> SystemRoleResponse:
    """Update a system role.
    
    Args:
        role_id: Role ID to update
        request: Update data
        
    Returns:
        Updated system role
        
    Raises:
        HTTPException: 404 if role not found
    """
    result = await db.execute(
        select(SystemRole).where(SystemRole.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System role {role_id} not found"
        )
    
    # Update fields
    if request.title is not None:
        role.title = request.title
    if request.prompt is not None:
        role.content = request.prompt  # Model uses 'content', API uses 'prompt'
    
    await db.commit()
    await db.refresh(role)
    
    return SystemRoleResponse(
        id=role.id,
        title=role.title,
        prompt=role.content  # Model uses 'content', API uses 'prompt'
    )


@router.delete("/system-roles/{role_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_system_role(
    role_id: str,
    db: AsyncSession = Depends(get_db)
) -> None:
    """Delete a system role.
    
    Args:
        role_id: Role ID to delete
        
    Raises:
        HTTPException: 404 if role not found
    """
    result = await db.execute(
        select(SystemRole).where(SystemRole.id == role_id)
    )
    role = result.scalar_one_or_none()
    
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"System role {role_id} not found"
        )
    
    await db.delete(role)
    await db.commit()
