"""Usage tracking models."""

from datetime import datetime, UTC
from sqlalchemy import Column, String, Integer, Float, DateTime
from src.database import Base


class UsageRecord(Base):
    """Individual usage record for each API call.
    
    Attributes:
        id: Unique identifier
        model: Model identifier (e.g., 'gemini-3-flash-preview')
        provider: Provider name ('google' or 'anthropic')
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        cost_usd: Calculated cost in USD
        timestamp: When the call was made
    """
    
    __tablename__ = "usage_records"
    
    id = Column(String, primary_key=True)
    model = Column(String, nullable=False, index=True)
    provider = Column(String, nullable=False, index=True)
    input_tokens = Column(Integer, nullable=False, default=0)
    output_tokens = Column(Integer, nullable=False, default=0)
    cost_usd = Column(Float, nullable=False, default=0.0)
    timestamp = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC))


# Pricing per 1M tokens (matches frontend config/models.ts)
MODEL_PRICING = {
    # Google Gemini
    "gemini-3-flash-preview": {"input": 0.50, "output": 3.00},
    "gemini-3.6-flash": {"input": 1.50, "output": 7.50},
    "gemini-3.5-flash-lite": {"input": 0.30, "output": 2.50},
    "gemini-3-pro-preview": {"input": 2.00, "output": 12.00},
    "gemini-3.1-pro-preview": {"input": 2.00, "output": 12.00},
    # Anthropic Claude
    "claude-haiku-4-5": {"input": 1.00, "output": 5.00},
    "claude-sonnet-4-5": {"input": 3.00, "output": 15.00},
    "claude-sonnet-4-6": {"input": 3.00, "output": 15.00},
    # Intro pricing through 2026-08-31; then $3 / $15
    "claude-sonnet-5": {"input": 2.00, "output": 10.00},
    "claude-opus-4-5": {"input": 15.00, "output": 75.00},
    "claude-opus-4-6": {"input": 5.00, "output": 25.00},
    "claude-opus-5": {"input": 5.00, "output": 25.00},
}


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    """Calculate cost for token usage.
    
    Args:
        model: Model identifier
        input_tokens: Number of input tokens
        output_tokens: Number of output tokens
        
    Returns:
        Cost in USD
        
    Example:
        >>> calculate_cost("gemini-3-flash-preview", 1000, 500)
        0.002  # $0.0005 input + $0.0015 output
    """
    pricing = MODEL_PRICING.get(model, {"input": 0, "output": 0})
    input_cost = (input_tokens / 1_000_000) * pricing["input"]
    output_cost = (output_tokens / 1_000_000) * pricing["output"]
    return input_cost + output_cost


def get_provider_for_model(model: str) -> str:
    """Get provider name for a model.
    
    Args:
        model: Model identifier
        
    Returns:
        Provider name ('google' or 'anthropic')
    """
    if model.startswith("gemini"):
        return "google"
    elif model.startswith("claude"):
        return "anthropic"
    return "unknown"
