"""Pydantic schemas for UserFact endpoints."""

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

UserFactCategory = Literal["style", "expertise", "preference", "context"]


class UserFactResponse(BaseModel):
    """Schema for user fact responses."""

    id: str
    category: str
    title: str
    content: str
    order_index: int
    history: list[dict]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserFactCreate(BaseModel):
    """Schema for creating a user fact."""

    category: UserFactCategory = Field("preference", description="Fact category")
    title: str = Field(..., min_length=1, max_length=200, description="Short label / key")
    content: str = Field(..., min_length=1, description="Fact content")
    order_index: int | None = Field(None, ge=0)


class UserFactUpdate(BaseModel):
    """Schema for updating a user fact."""

    category: UserFactCategory | None = None
    title: str | None = Field(None, min_length=1, max_length=200)
    content: str | None = Field(None, min_length=1)
    order_index: int | None = Field(None, ge=0)
    reason: str | None = Field(None, description="Reason for change (saved to history)")
