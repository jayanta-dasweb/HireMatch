from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.deps import get_current_user
from app.core.rate_limit import limiter
from app.db.session import get_db
from app.models import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    LogoutRequest,
    MessageResponse,
    RefreshRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyEmailRequest,
)
from app.services import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", status_code=status.HTTP_201_CREATED)
@limiter.limit("10/minute")
def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    user, raw_verify = auth_service.register_user(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    body: dict = {
        "message": "Registration successful. Verify your email to activate full access.",
        "user_id": str(user.id),
        "email": user.email,
    }
    # Never pretend SMTP worked. Dev-only token exposure when console backend is used.
    if settings.email_backend == "console" and not settings.is_production:
        body["verification_token"] = raw_verify
        body["email_delivery"] = "console_only_not_sent"
    elif settings.email_backend == "console":
        body["email_delivery"] = "console_only_not_sent"
    else:
        body["email_delivery"] = "attempted_via_smtp"
    return body


@router.post("/login", response_model=TokenResponse)
@limiter.limit("20/minute")
def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    user = auth_service.authenticate_user(db, email=payload.email, password=payload.password)
    return auth_service.issue_token_pair(db, user)


@router.post("/refresh", response_model=TokenResponse)
@limiter.limit("30/minute")
def refresh(request: Request, payload: RefreshRequest, db: Session = Depends(get_db)):
    return auth_service.refresh_token_pair(db, refresh_token=payload.refresh_token)


@router.post("/logout", response_model=MessageResponse)
def logout(
    payload: LogoutRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    auth_service.logout(db, refresh_token=payload.refresh_token, user_id=user.id)
    return MessageResponse(message="Logged out")


@router.post("/verify-email", response_model=MessageResponse)
@limiter.limit("20/minute")
def verify_email(request: Request, payload: VerifyEmailRequest, db: Session = Depends(get_db)):
    auth_service.verify_email(db, token=payload.token)
    return MessageResponse(message="Email verified")


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("5/minute")
def forgot_password(request: Request, payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    settings = get_settings()
    raw = auth_service.forgot_password(db, email=payload.email)
    body: dict = {
        "message": "If an account exists for that email, password reset instructions were issued.",
    }
    if raw and settings.email_backend == "console" and not settings.is_production:
        body["reset_token"] = raw
        body["email_delivery"] = "console_only_not_sent"
    return body


@router.post("/reset-password", response_model=MessageResponse)
@limiter.limit("10/minute")
def reset_password(request: Request, payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    auth_service.reset_password(db, token=payload.token, new_password=payload.new_password)
    return MessageResponse(message="Password updated")
