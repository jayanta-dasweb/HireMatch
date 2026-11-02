"""Private on-disk resume storage (not served as static files)."""

from __future__ import annotations

import hashlib
import uuid
from pathlib import Path

from app.core.config import get_settings


ALLOWED_CONTENT_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
}

ALLOWED_EXTENSIONS = {".pdf", ".docx"}


def storage_root() -> Path:
    root = Path(get_settings().resume_storage_path)
    root.mkdir(parents=True, exist_ok=True)
    return root


def build_storage_key(*, organization_id: uuid.UUID, document_id: uuid.UUID, version: int, ext: str) -> str:
    safe_ext = ext if ext.startswith(".") else f".{ext}"
    return f"{organization_id}/{document_id}/v{version}{safe_ext}"


def absolute_path(storage_key: str) -> Path:
    root = storage_root().resolve()
    path = (root / storage_key).resolve()
    if not str(path).startswith(str(root)):
        raise ValueError("Invalid storage key")
    return path


def save_bytes(*, storage_key: str, data: bytes) -> tuple[int, str]:
    path = absolute_path(storage_key)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    digest = hashlib.sha256(data).hexdigest()
    return len(data), digest


def read_bytes(storage_key: str) -> bytes:
    path = absolute_path(storage_key)
    if not path.is_file():
        raise FileNotFoundError(storage_key)
    return path.read_bytes()


def delete_key(storage_key: str) -> None:
    path = absolute_path(storage_key)
    if path.is_file():
        path.unlink()
