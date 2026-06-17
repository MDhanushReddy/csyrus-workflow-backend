from datetime import datetime, timedelta
from typing import List, Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import get_db
from app.models import ApprovalRequest, ReviewAction, User
from app.schemas import (
    ApprovalRequestCreate,
    ApprovalRequestResponse,
    ReviewActionCreate,
    ReviewActionResponse,
    UserCreate,
    UserResponse,
)

router = APIRouter(prefix="/api", tags=["workflow"])
settings = get_settings()


def is_reviewer(user: User) -> bool:
    return (user.role or "").lower() == "reviewer"


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=60))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm="HS256")


def get_current_user(request: Request, db: Session = Depends(get_db)):
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        email = payload.get("email")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


@router.get("/auth/google/login")
def google_login():
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=500,
            detail=(
                "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and "
                "GOOGLE_CLIENT_SECRET in backend/.env and restart the server."
            ),
        )

    params = {
        "client_id": settings.google_client_id,
        "redirect_uri": settings.google_redirect_uri,
        "response_type": "code",
        "scope": "openid email profile",
        "access_type": "offline",
        "prompt": "consent",
    }
    return RedirectResponse(
        f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    )


@router.get("/auth/google")
def google_login_alias():
    return google_login()


@router.get("/auth/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=500,
            detail=(
                "Google OAuth is not configured. Set GOOGLE_CLIENT_ID and "
                "GOOGLE_CLIENT_SECRET in backend/.env and restart the server."
            ),
        )

    token_url = "https://oauth2.googleapis.com/token"
    data = {
        "code": code,
        "client_id": settings.google_client_id,
        "client_secret": settings.google_client_secret,
        "redirect_uri": settings.google_redirect_uri,
        "grant_type": "authorization_code",
    }

    token_response = httpx.post(token_url, data=data, timeout=30)
    token_response.raise_for_status()
    token_data = token_response.json()
    access_token = token_data.get("access_token")

    user_info_response = httpx.get(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
        timeout=30,
    )
    user_info_response.raise_for_status()
    profile = user_info_response.json()

    user = db.query(User).filter(User.email == profile["email"]).first()
    if not user:
        user = User(
            name=profile.get("name", profile["email"]),
            email=profile["email"],
            google_id=profile.get("id"),
            role="reviewer" if profile["email"].lower() == "mdhanushreddydr@gmail.com" else "requester",
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        user.name = profile.get("name", user.name)
        user.google_id = profile.get("id", user.google_id)
        if profile["email"].lower() == "mdhanushreddydr@gmail.com":
            user.role = "reviewer"
        db.commit()

    jwt_token = create_access_token(
        {"sub": str(user.id), "email": user.email, "role": user.role}
    )

    redirect = RedirectResponse(url="http://localhost:5173/")
    redirect.set_cookie(
        key="access_token",
        value=jwt_token,
        httponly=True,
        samesite="lax",
        max_age=60 * 60,
    )
    return redirect


@router.get("/auth/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/auth/logout")
def logout():
    response = JSONResponse({"message": "Logged out successfully"})
    response.delete_cookie(
        key="access_token",
        path="/",
        samesite="lax",
    )
    return response


@router.post("/users", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        return user

    user = User(
        name=payload.name,
        email=payload.email,
        google_id=payload.google_id,
        role=payload.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db)):
    return db.query(User).order_by(User.created_at.desc()).all()


@router.post("/requests", response_model=ApprovalRequestResponse, status_code=status.HTTP_201_CREATED)
def create_request(
    payload: ApprovalRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.reviewer_id is not None:
        reviewer = db.query(User).filter(User.id == payload.reviewer_id).first()
        if not reviewer:
            raise HTTPException(status_code=404, detail="Reviewer not found")

    request = ApprovalRequest(
        title=payload.title,
        description=payload.description,
        priority=payload.priority,
        created_by=current_user.id,
        reviewer_id=payload.reviewer_id,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request


@router.get("/requests", response_model=List[ApprovalRequestResponse])
def list_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.created_by == current_user.id)
        .order_by(ApprovalRequest.created_at.desc())
        .all()
    )


@router.get("/requests/{request_id}", response_model=ApprovalRequestResponse)
def get_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if request.created_by != current_user.id and request.reviewer_id != current_user.id:
        raise HTTPException(status_code=403, detail="You are not allowed to view this request")
    return request


@router.put("/requests/{request_id}", response_model=ApprovalRequestResponse)
def update_request(
    request_id: int,
    payload: ApprovalRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if request.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own requests")

    request.title = payload.title
    request.description = payload.description
    request.priority = payload.priority
    request.reviewer_id = payload.reviewer_id
    db.commit()
    db.refresh(request)
    return request


@router.delete("/requests/{request_id}")
def delete_request(
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if request.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own requests")

    db.delete(request)
    db.commit()
    return {"message": "Request deleted successfully"}


@router.get("/reviewer/requests", response_model=List[ApprovalRequestResponse])
def reviewer_requests(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Only reviewers can access this endpoint")

    return (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.reviewer_id == current_user.id)
        .order_by(ApprovalRequest.created_at.desc())
        .all()
    )


@router.post("/reviewer/requests/{request_id}/approve", response_model=ReviewActionResponse)
def approve_request(
    request_id: int,
    comments: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if request.status != "PENDING":
        raise HTTPException(status_code=400, detail="This request has already been reviewed")
    if request.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the assigned reviewer can approve this request",
        )

    review = ReviewAction(
        request_id=request_id,
        action="APPROVED",
        comments=comments,
        reviewed_by=current_user.id,
    )
    request.status = "APPROVED"
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.post("/reviewer/requests/{request_id}/reject", response_model=ReviewActionResponse)
def reject_request(
    request_id: int,
    comments: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    request = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")
    if request.status != "PENDING":
        raise HTTPException(status_code=400, detail="This request has already been reviewed")
    if request.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the assigned reviewer can reject this request",
        )

    review = ReviewAction(
        request_id=request_id,
        action="REJECTED",
        comments=comments,
        reviewed_by=current_user.id,
    )
    request.status = "REJECTED"
    db.add(review)
    db.commit()
    db.refresh(review)
    return review


@router.post("/review-actions", response_model=ReviewActionResponse, status_code=status.HTTP_201_CREATED)
def create_review_action(
    payload: ReviewActionCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not is_reviewer(current_user):
        raise HTTPException(status_code=403, detail="Only reviewers can act on requests")

    request = (
        db.query(ApprovalRequest)
        .filter(ApprovalRequest.id == payload.request_id)
        .first()
    )
    if not request:
        raise HTTPException(status_code=404, detail="Approval request not found")

    if request.status != "PENDING":
        raise HTTPException(status_code=400, detail="This request has already been reviewed")

    if request.reviewer_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="Only the assigned reviewer can act on this request",
        )

    if payload.action not in {"APPROVED", "REJECTED"}:
        raise HTTPException(status_code=400, detail="Action must be APPROVED or REJECTED")

    review = ReviewAction(
        request_id=payload.request_id,
        action=payload.action,
        comments=payload.comments,
        reviewed_by=current_user.id,
    )
    request.status = payload.action
    db.add(review)
    db.commit()
    db.refresh(review)
    return review
