"""Honest PDF/DOCX text extraction — no invented structured fields."""

from __future__ import annotations

import io


def extract_text(*, data: bytes, content_type: str, filename: str) -> str:
    name = (filename or "").lower()
    ctype = (content_type or "").lower()

    if ctype == "application/pdf" or name.endswith(".pdf"):
        return _extract_pdf(data)
    if (
        ctype == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        or name.endswith(".docx")
    ):
        return _extract_docx(data)
    raise ValueError("Unsupported file type for text extraction")


def _extract_pdf(data: bytes) -> str:
    from pypdf import PdfReader

    reader = PdfReader(io.BytesIO(data))
    parts: list[str] = []
    for page in reader.pages:
        text = page.extract_text() or ""
        if text.strip():
            parts.append(text.strip())
    text = "\n\n".join(parts).strip()
    if not text:
        raise ValueError("No extractable text found in PDF (may be scanned/image-only)")
    return text


def _extract_docx(data: bytes) -> str:
    from docx import Document

    doc = Document(io.BytesIO(data))
    parts = [p.text.strip() for p in doc.paragraphs if p.text and p.text.strip()]
    text = "\n".join(parts).strip()
    if not text:
        raise ValueError("No extractable text found in DOCX")
    return text
