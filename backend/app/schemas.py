from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr


class UserBase(BaseModel):
    email: EmailStr
    name: str
    google_id: Optional[str] = None
    role: str = "requester"


class UserCreate(UserBase):
    pass


class UserResponse(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class TokenPayload(BaseModel):
    sub: str
    email: str
    role: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ApprovalRequestBase(BaseModel):
    title: str
    description: str
    priority: str = "MEDIUM"
    created_by: int
    reviewer_id: Optional[int] = None


class ApprovalRequestCreate(ApprovalRequestBase):
    pass


class ApprovalRequestResponse(ApprovalRequestBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReviewActionCreate(BaseModel):
    request_id: int
    action: str
    comments: Optional[str] = None
    reviewed_by: int


class ReviewActionResponse(BaseModel):
    id: int
    request_id: int
    action: str
    comments: Optional[str]
    reviewed_by: int
    reviewed_at: datetime

    class Config:
        from_attributes = True
