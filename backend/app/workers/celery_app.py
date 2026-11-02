"""Celery application — Redis broker for resume processing."""

from __future__ import annotations

import os

from celery import Celery

from app.core.config import get_settings

settings = get_settings()

celery = Celery(
    "hirematch",
    broker=settings.redis_url,
    backend=settings.redis_url,
    include=["app.workers.tasks"],
)

celery.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    # Tests / APP_ENV=test: run tasks inline without a live worker
    task_always_eager=settings.app_env.lower() == "test"
    or os.environ.get("CELERY_TASK_ALWAYS_EAGER", "").lower() in {"1", "true", "yes"},
    task_eager_propagates=True,
)
