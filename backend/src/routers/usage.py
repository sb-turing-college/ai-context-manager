"""Usage tracking endpoints.

Provides API for viewing and resetting usage statistics.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from src.database import get_db
from src.services import usage_tracker


router = APIRouter(tags=["usage"])


class UsageStatsResponse(BaseModel):
    """Usage statistics response."""
    google: dict
    anthropic: dict
    total: dict


class ResetResponse(BaseModel):
    """Reset confirmation response."""
    success: bool
    deleted_records: int
    message: str


@router.get("/usage/stats", response_model=UsageStatsResponse)
async def get_usage_stats(
    db: AsyncSession = Depends(get_db)
) -> UsageStatsResponse:
    """Get usage statistics grouped by provider and model.
    
    Returns:
        Usage statistics with breakdown by provider and model
        
    Example response:
        {
            "google": {
                "models": {
                    "gemini-3-flash-preview": {
                        "input_tokens": 10000,
                        "output_tokens": 5000,
                        "cost": 0.02,
                        "calls": 5
                    }
                },
                "total_input_tokens": 10000,
                "total_output_tokens": 5000,
                "total_cost": 0.02,
                "total_calls": 5
            },
            "anthropic": { ... },
            "total": {
                "input_tokens": 20000,
                "output_tokens": 10000,
                "cost": 0.05,
                "calls": 10
            }
        }
    """
    stats = await usage_tracker.get_usage_stats(db)
    return UsageStatsResponse(**stats)


@router.delete("/usage/reset", response_model=ResetResponse)
async def reset_usage_stats(
    confirm: bool = False,
    db: AsyncSession = Depends(get_db)
) -> ResetResponse:
    """Reset all usage statistics.
    
    Requires confirmation query parameter to prevent accidental resets.
    
    Args:
        confirm: Must be true to confirm reset
        
    Returns:
        Confirmation of reset with number of deleted records
        
    Raises:
        HTTPException: 400 if confirm is not true
    """
    if not confirm:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset requires confirmation. Add ?confirm=true to confirm."
        )
    
    deleted = await usage_tracker.reset_usage_stats(db)
    
    return ResetResponse(
        success=True,
        deleted_records=deleted,
        message=f"Usage statistics reset. {deleted} records deleted."
    )
