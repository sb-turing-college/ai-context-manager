"""Usage tracking service.

Tracks token usage and costs for all LLM API calls.
"""

import uuid
from datetime import datetime, UTC
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.usage import UsageRecord, calculate_cost, get_provider_for_model


async def track_usage(
    db: AsyncSession,
    model: str,
    input_tokens: int,
    output_tokens: int
) -> UsageRecord:
    """Track usage for an API call.
    
    Args:
        db: Database session
        model: Model identifier
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        
    Returns:
        Created usage record
        
    Example:
        >>> record = await track_usage(db, "gemini-3-flash-preview", 1000, 500)
        >>> record.cost_usd
        0.002
    """
    cost = calculate_cost(model, input_tokens, output_tokens)
    provider = get_provider_for_model(model)
    
    record = UsageRecord(
        id=str(uuid.uuid4()),
        model=model,
        provider=provider,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=cost,
        timestamp=datetime.now(UTC)
    )
    
    db.add(record)
    await db.commit()
    
    return record


async def get_usage_stats(db: AsyncSession) -> dict:
    """Get aggregated usage statistics.
    
    Returns usage grouped by provider and model.
    
    Args:
        db: Database session
        
    Returns:
        Usage statistics dict
        
    Example:
        >>> stats = await get_usage_stats(db)
        >>> stats["google"]["total_cost"]
        0.05
    """
    # Get stats grouped by model
    result = await db.execute(
        select(
            UsageRecord.model,
            UsageRecord.provider,
            func.sum(UsageRecord.input_tokens).label("input_tokens"),
            func.sum(UsageRecord.output_tokens).label("output_tokens"),
            func.sum(UsageRecord.cost_usd).label("total_cost"),
            func.count(UsageRecord.id).label("call_count")
        ).group_by(UsageRecord.model, UsageRecord.provider)
    )
    
    rows = result.fetchall()
    
    # Organize by provider
    stats = {
        "google": {
            "models": {},
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_cost": 0.0,
            "total_calls": 0
        },
        "anthropic": {
            "models": {},
            "total_input_tokens": 0,
            "total_output_tokens": 0,
            "total_cost": 0.0,
            "total_calls": 0
        }
    }
    
    for row in rows:
        provider = row.provider
        model = row.model
        
        if provider not in stats:
            continue
        
        stats[provider]["models"][model] = {
            "input_tokens": row.input_tokens or 0,
            "output_tokens": row.output_tokens or 0,
            "cost": row.total_cost or 0.0,
            "calls": row.call_count or 0
        }
        
        stats[provider]["total_input_tokens"] += row.input_tokens or 0
        stats[provider]["total_output_tokens"] += row.output_tokens or 0
        stats[provider]["total_cost"] += row.total_cost or 0.0
        stats[provider]["total_calls"] += row.call_count or 0
    
    # Add grand total
    stats["total"] = {
        "input_tokens": stats["google"]["total_input_tokens"] + stats["anthropic"]["total_input_tokens"],
        "output_tokens": stats["google"]["total_output_tokens"] + stats["anthropic"]["total_output_tokens"],
        "cost": stats["google"]["total_cost"] + stats["anthropic"]["total_cost"],
        "calls": stats["google"]["total_calls"] + stats["anthropic"]["total_calls"]
    }
    
    return stats


async def reset_usage_stats(db: AsyncSession) -> int:
    """Reset all usage statistics.
    
    Deletes all usage records from the database.
    
    Args:
        db: Database session
        
    Returns:
        Number of deleted records
        
    Example:
        >>> deleted = await reset_usage_stats(db)
        >>> deleted
        42
    """
    # Count before delete
    count_result = await db.execute(select(func.count(UsageRecord.id)))
    count = count_result.scalar() or 0
    
    # Delete all records
    await db.execute(delete(UsageRecord))
    await db.commit()
    
    return count
