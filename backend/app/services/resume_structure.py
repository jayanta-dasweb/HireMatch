"""Free local structured extraction — evidence only, no invented fields."""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path

EXTRACTOR_ID = "local_v1"

_EMAIL_RE = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_PHONE_RE = re.compile(
    r"(?:(?:\+|00)\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}\b"
)
_URL_RE = re.compile(r"https?://[^\s<>\"']+|www\.[^\s<>\"']+", re.I)
_LINKEDIN_RE = re.compile(r"(?:linkedin\.com/in/|linkedin\.com/pub/)[A-Za-z0-9_-]+/?", re.I)
_GITHUB_RE = re.compile(r"(?:github\.com/)[A-Za-z0-9_.-]+/?", re.I)

_EXPERIENCE_HEADERS = re.compile(
    r"^(?:work\s+experience|professional\s+experience|employment|experience|work\s+history)\s*$",
    re.I | re.M,
)
_EDUCATION_HEADERS = re.compile(
    r"^(?:education|academic\s+background|qualifications)\s*$",
    re.I | re.M,
)
_SECTION_STOP = re.compile(
    r"^(?:skills|projects|certifications|awards|summary|objective|profile|"
    r"work\s+experience|professional\s+experience|employment|experience|work\s+history|"
    r"education|academic\s+background|qualifications)\s*$",
    re.I,
)


@lru_cache(maxsize=1)
def _skill_lexicon() -> list[str]:
    path = Path(__file__).resolve().parent.parent / "data" / "skill_lexicon.txt"
    if not path.is_file():
        return []
    skills: list[str] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        s = line.strip()
        if s and not s.startswith("#"):
            skills.append(s)
    # Longer phrases first so "Machine Learning" wins over partials
    skills.sort(key=len, reverse=True)
    return skills


def extract_structure(text: str) -> dict:
    """Build structured payload only from evidence in `text`."""
    raw = (text or "").replace("\x00", "").strip()
    contact = _extract_contact(raw)
    skills = _extract_skills(raw)
    experience_sections = _extract_section_blocks(raw, _EXPERIENCE_HEADERS)
    education_sections = _extract_section_blocks(raw, _EDUCATION_HEADERS)
    return {
        "extractor": EXTRACTOR_ID,
        "contact": contact,
        "skills": skills,
        "experience_sections": experience_sections,
        "education_sections": education_sections,
    }


def _extract_contact(text: str) -> dict:
    emails = list(dict.fromkeys(_EMAIL_RE.findall(text)))
    phones: list[str] = []
    for m in _PHONE_RE.findall(text):
        digits = re.sub(r"\D", "", m)
        if 7 <= len(digits) <= 15:
            phones.append(m.strip())
    phones = list(dict.fromkeys(phones))[:5]

    links = list(dict.fromkeys(m.rstrip(".,);]") for m in _URL_RE.findall(text)))[:10]
    linkedin = list(dict.fromkeys(m.rstrip(".,);]") for m in _LINKEDIN_RE.findall(text)))[:3]
    github = list(dict.fromkeys(m.rstrip(".,);]") for m in _GITHUB_RE.findall(text)))[:3]

    return {
        "emails": emails[:5],
        "phones": phones,
        "links": links,
        "linkedin": linkedin,
        "github": github,
    }


def _extract_skills(text: str) -> list[str]:
    found: list[str] = []
    for skill in _skill_lexicon():
        # Word-ish boundary: avoid matching "Go" inside "Google"
        pattern = re.compile(rf"(?<![A-Za-z0-9+.#]){re.escape(skill)}(?![A-Za-z0-9+.#])", re.I)
        if pattern.search(text):
            found.append(skill)
    return found


def _extract_section_blocks(text: str, header_re: re.Pattern[str]) -> list[str]:
    lines = text.splitlines()
    blocks: list[str] = []
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if header_re.match(line):
            i += 1
            chunk: list[str] = []
            while i < len(lines):
                nxt = lines[i].strip()
                if nxt and _SECTION_STOP.match(nxt) and not header_re.match(nxt):
                    break
                if nxt and header_re.match(nxt):
                    break
                chunk.append(lines[i])
                i += 1
            body = "\n".join(chunk).strip()
            if body:
                blocks.append(body[:4000])
            continue
        i += 1
    return blocks
