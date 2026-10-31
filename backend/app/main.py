import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.v1.router import api_router
from app.core.config import get_settings
from app.core.middleware import SecurityHeadersMiddleware
from app.core.rate_limit import limiter

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s [%(name)s] %(message)s")
logger = logging.getLogger("hirematch")


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings = get_settings()
    logger.info("Starting %s (%s)", settings.app_name, settings.app_env)
    if settings.is_production and settings.email_backend == "console":
        logger.warning("EMAIL_BACKEND=console — emails are not delivered until SMTP is configured")
    from app.db.session import SessionLocal
    from app.services.rbac import backfill_membership_roles, ensure_rbac_seeded
    from app.services.rbac_seed import seed_rbac_defaults

    with SessionLocal() as db:
        seed_rbac_defaults(db)
        ensure_rbac_seeded(db)
        backfill_membership_roles(db)

    if settings.seed_platform_admin or settings.seed_demo_user:
        from app.services.seed import run_seeds

        run_seeds(
            seed_admin=settings.seed_platform_admin,
            seed_demo=settings.seed_demo_user,
        )
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    show_docs = not settings.is_production

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if show_docs else None,
        openapi_url="/openapi.json" if show_docs else None,
        redoc_url="/redoc" if show_docs else None,
    )
    app.state.limiter = limiter
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
    app.add_middleware(SlowAPIMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    if settings.trusted_host_list != ["*"]:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=settings.trusted_host_list)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
    )

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        request.state.correlation_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.exception_handler(RequestValidationError)
    async def on_validation_error(_: Request, exc: RequestValidationError):
        messages: list[str] = []
        for err in exc.errors():
            loc = err.get("loc") or ()
            field = str(loc[-1]) if loc else "field"
            msg = str(err.get("msg") or "Invalid value")
            lower = msg.lower()
            if field == "email" or "email" in lower:
                if "special-use" in lower or "reserved" in lower:
                    messages.append(
                        "That email domain can’t be used. Try a normal address like name@company.com"
                    )
                else:
                    messages.append("Please enter a valid email address (example: name@company.com)")
            elif field == "password":
                messages.append("Password must be at least 8 characters")
            else:
                messages.append(msg.replace("Value error, ", ""))
        detail = messages[0] if len(messages) == 1 else messages
        return JSONResponse(status_code=422, content={"detail": detail})

    @app.exception_handler(Exception)
    async def on_error(request: Request, exc: Exception):
        request_id = getattr(request.state, "correlation_id", "-")
        logger.exception("Unhandled error %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "request_id": request_id},
        )

    app.include_router(api_router, prefix=settings.api_v1_prefix)
    return app


app = create_app()
