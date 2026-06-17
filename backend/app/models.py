from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    google_id = Column(String(255), unique=True, nullable=True)
    role = Column(String(50), nullable=False, default="requester")
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    requests = relationship(
        "ApprovalRequest",
        foreign_keys="ApprovalRequest.created_by",
        back_populates="creator",
    )
    assigned_requests = relationship(
        "ApprovalRequest",
        foreign_keys="ApprovalRequest.reviewer_id",
        back_populates="reviewer",
    )
    reviews = relationship("ReviewAction", back_populates="reviewer")


class ApprovalRequest(Base):
    __tablename__ = "approval_requests"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=False)
    priority = Column(String(20), nullable=False, default="MEDIUM")
    status = Column(String(20), nullable=False, default="PENDING")
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewer_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    creator = relationship(
        "User",
        foreign_keys=[created_by],
        back_populates="requests",
    )
    reviewer = relationship(
        "User",
        foreign_keys=[reviewer_id],
        back_populates="assigned_requests",
    )
    review_actions = relationship(
        "ReviewAction",
        back_populates="request",
        cascade="all, delete-orphan",
    )


class ReviewAction(Base):
    __tablename__ = "review_actions"

    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(Integer, ForeignKey("approval_requests.id"), nullable=False)
    action = Column(String(20), nullable=False)
    comments = Column(Text, nullable=True)
    reviewed_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), server_default=func.now())

    request = relationship("ApprovalRequest", back_populates="review_actions")
    reviewer = relationship("User", back_populates="reviews")
