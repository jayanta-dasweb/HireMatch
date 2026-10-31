from functools import lru_cache

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

WEAK_SECRETS = {
    "change-me-to-a-long-random-string-at-least-32-chars",
    "hirematch-dev-secret-key-change-in-prod-32",
    "test-secret-key-hirematch-ai-phase1-32chars",
}


class Settings(BaseSettings):
    """All settings come from environment variables (see .env.example)."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "HireMatch AI"
    app_env: str = Field(default="development", alias="APP_ENV")
    debug: bool = Field(default=False, alias="DEBUG")
    api_v1_prefix: str = "/api/v1"
    secret_key: str = Field(..., alias="SECRET_KEY")
    access_token_expire_minutes: int = Field(default=15, alias="ACCESS_TOKEN_EXPIRE_MINUTES")
    refresh_token_expire_days: int = Field(default=14, alias="REFRESH_TOKEN_EXPIRE_DAYS")
    email_token_expire_hours: int = Field(default=24, alias="EMAIL_TOKEN_EXPIRE_HOURS")
    password_reset_expire_hours: int = Field(default=2, alias="PASSWORD_RESET_EXPIRE_HOURS")
    algorithm: str = "HS256"

    database_url: str = Field(..., alias="DATABASE_URL")
    redis_url: str = Field(default="redis://redis:6379/0", alias="REDIS_URL")
    cors_origins: str = Field(default="http://localhost:3000", alias="CORS_ORIGINS")
    trusted_hosts: str = Field(default="*", alias="TRUSTED_HOSTS")
    rate_limit_enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")

    email_backend: str = Field(default="console", alias="EMAIL_BACKEND")
    smtp_host: str | None = Field(default=None, alias="SMTP_HOST")
    smtp_port: int = Field(default=1025, alias="SMTP_PORT")
    smtp_user: str | None = Field(default=None, alias="SMTP_USER")
    smtp_password: str | None = Field(default=None, alias="SMTP_PASSWORD")
    smtp_from: str = Field(default="noreply@hirematch.local", alias="SMTP_FROM")
    frontend_url: str = Field(default="http://localhost:3000", alias="FRONTEND_URL")
    web_concurrency: int = Field(default=2, alias="WEB_CONCURRENCY")
    seed_demo_user: bool = Field(default=False, alias="SEED_DEMO_USER")

    @field_validator("secret_key")
    @classmethod
    def secret_must_be_long(cls, value: str) -> str:
        if len(value) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters")
        return value

    @model_validator(mode="after")
    def production_must_be_safe(self) -> "Settings":
        if not self.is_production:
            return self
        if self.debug:
            raise ValueError("DEBUG must be false in production")
        if self.secret_key in WEAK_SECRETS:
            raise ValueError("SECRET_KEY must be replaced for production")
        if "*" in self.cors_origin_list:
            raise ValueError("CORS_ORIGINS must not include * in production")
        if self.trusted_hosts.strip() == "*":
            raise ValueError("TRUSTED_HOSTS must be set in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def trusted_host_list(self) -> list[str]:
        return [h.strip() for h in self.trusted_hosts.split(",") if h.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
