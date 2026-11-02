"""In-house resume analysis engine — no external APIs or third-party AI services.

All findings are grounded in resume text evidence. Empty when not found.
"""

from __future__ import annotations

import re
from collections import Counter
from functools import lru_cache

from app.services import resume_structure

ANALYZER_ID = "hirematch_local_v2"

_MONTH = (
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:t(?:ember)?)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)"
)
_DATE_TOKEN = rf"(?:{_MONTH}[.\s,]+\d{{2,4}}|\d{{1,2}}[/-]\d{{2,4}}|\d{{4}})"
_DATE_RANGE = re.compile(
    rf"(?P<start>{_DATE_TOKEN})\s*(?:[–\-—]|to)\s*(?P<end>Present|Current|Now|{_DATE_TOKEN})",
    re.I,
)

_ROLE_LINE = re.compile(
    r"^(?P<title>.{3,80}?)\s+(?:[-–—|@]|at|–)\s+(?P<company>.{2,80})$",
    re.I,
)
_DEGREE = re.compile(
    r"\b(?:B\.?S\.?|B\.?A\.?|B\.?Tech|B\.?E\.?|M\.?S\.?|M\.?A\.?|M\.?Tech|M\.?B\.?A\.?|"
    r"Ph\.?D\.?|Bachelor(?:'s)?|Master(?:'s)?|Diploma|Associate)\b[^.\n]{0,80}",
    re.I,
)

_ACTION_VERBS = {
    "achieved", "built", "created", "designed", "developed", "delivered", "improved",
    "increased", "led", "managed", "optimized", "reduced", "implemented", "launched",
    "owned", "shipped", "automated", "architected", "migrated", "scaled", "mentored",
    "collaborated", "analyzed", "resolved", "engineered", "deployed", "integrated",
}

_SOFT_SKILLS = [
    "communication", "leadership", "teamwork", "problem solving", "problem-solving",
    "collaboration", "time management", "adaptability", "critical thinking",
    "ownership", "mentoring", "stakeholder management", "presentation",
]

_SECTION_MAP = {
    "summary": re.compile(
        r"^(?:summary|professional\s+summary|profile|objective|about\s+me)\s*$", re.I
    ),
    "skills": re.compile(r"^(?:skills|technical\s+skills|core\s+competencies|technologies)\s*$", re.I),
    "experience": resume_structure._EXPERIENCE_HEADERS,
    "education": resume_structure._EDUCATION_HEADERS,
    "projects": re.compile(r"^(?:projects|personal\s+projects|key\s+projects)\s*$", re.I),
    "certifications": re.compile(
        r"^(?:certifications?|licenses?|achievements|awards)\s*$", re.I
    ),
}


@lru_cache(maxsize=1)
def _soft_skill_patterns() -> list[tuple[str, re.Pattern[str]]]:
    out: list[tuple[str, re.Pattern[str]]] = []
    for s in _SOFT_SKILLS:
        out.append((s, re.compile(rf"(?<![A-Za-z0-9]){re.escape(s)}(?![A-Za-z0-9])", re.I)))
    return out


def analyze_resume(text: str) -> dict:
    """Deep in-house analysis. Never invents employers/skills not evidenced in text."""
    base = resume_structure.extract_structure(text)
    raw = (text or "").replace("\x00", "").strip()
    sections = _split_all_sections(raw)

    skills_detailed = _skills_with_evidence(raw, base.get("skills") or [])
    soft_skills = _soft_skills_with_evidence(raw)
    roles = _parse_roles(sections.get("experience") or base.get("experience_sections") or [])
    education = _parse_education(sections.get("education") or base.get("education_sections") or [])
    projects = _section_snippets(sections.get("projects") or [])
    certifications = _section_snippets(sections.get("certifications") or [])
    summary = "\n".join(sections.get("summary") or []).strip()[:2000] or None

    metrics = _text_metrics(raw)
    ats = _ats_checklist(
        contact=base.get("contact") or {},
        skills=skills_detailed,
        roles=roles,
        education=education,
        summary=summary,
        sections=sections,
        metrics=metrics,
    )
    action = _action_verb_stats(sections.get("experience") or base.get("experience_sections") or [])
    findings = _build_findings(
        contact=base.get("contact") or {},
        skills=skills_detailed,
        soft_skills=soft_skills,
        roles=roles,
        education=education,
        ats=ats,
        action=action,
        metrics=metrics,
    )

    return {
        **base,
        "extractor": ANALYZER_ID,
        "analyzer": ANALYZER_ID,
        "summary": summary,
        "skills_detailed": skills_detailed,
        "soft_skills": soft_skills,
        "roles": roles,
        "education_entries": education,
        "projects": projects,
        "certifications": certifications,
        "metrics": metrics,
        "ats": ats,
        "action_verbs": action,
        "findings": findings,
        "section_coverage": {k: bool(v) for k, v in sections.items()},
    }


def _split_all_sections(text: str) -> dict[str, list[str]]:
    lines = text.splitlines()
    # Detect headers
    indexed: list[tuple[int, str]] = []
    for i, line in enumerate(lines):
        s = line.strip()
        if not s:
            continue
        for name, pat in _SECTION_MAP.items():
            if pat.match(s):
                indexed.append((i, name))
                break
    out: dict[str, list[str]] = {k: [] for k in _SECTION_MAP}
    if not indexed:
        return out
    for idx, (start, name) in enumerate(indexed):
        end = indexed[idx + 1][0] if idx + 1 < len(indexed) else len(lines)
        body = "\n".join(lines[start + 1 : end]).strip()
        if body:
            out[name].append(body[:6000])
    return out


def _skills_with_evidence(text: str, skills: list[str]) -> list[dict]:
    rows: list[dict] = []
    for skill in skills:
        pat = re.compile(rf"(?<![A-Za-z0-9+.#]){re.escape(skill)}(?![A-Za-z0-9+.#])", re.I)
        matches = list(pat.finditer(text))
        if not matches:
            continue
        evidence = []
        for m in matches[:3]:
            a = max(0, m.start() - 40)
            b = min(len(text), m.end() + 40)
            evidence.append(text[a:b].replace("\n", " ").strip())
        rows.append({"name": skill, "mentions": len(matches), "evidence": evidence})
    rows.sort(key=lambda r: (-r["mentions"], r["name"].lower()))
    return rows


def _soft_skills_with_evidence(text: str) -> list[dict]:
    rows: list[dict] = []
    for name, pat in _soft_skill_patterns():
        m = pat.search(text)
        if not m:
            continue
        a = max(0, m.start() - 40)
        b = min(len(text), m.end() + 40)
        rows.append(
            {
                "name": name,
                "evidence": [text[a:b].replace("\n", " ").strip()],
            }
        )
    return rows


def _parse_roles(experience_blocks: list[str]) -> list[dict]:
    roles: list[dict] = []
    for block in experience_blocks:
        # Split on blank lines into chunks
        chunks = re.split(r"\n\s*\n", block)
        for chunk in chunks:
            lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
            if not lines:
                continue
            title = None
            company = None
            dates = None
            header = lines[0]
            dm = _DATE_RANGE.search(chunk)
            if dm:
                dates = {"start": dm.group("start").strip(), "end": dm.group("end").strip()}
            rm = _ROLE_LINE.match(header)
            if rm:
                title = rm.group("title").strip(" -–—|")
                company = rm.group("company").strip(" -–—|")
            elif len(lines) >= 2 and _DATE_RANGE.search(lines[1]):
                # Title / Company on first line variants: "Title, Company"
                parts = re.split(r"\s*[,|@]\s*", header, maxsplit=1)
                title = parts[0].strip()
                company = parts[1].strip() if len(parts) > 1 else None
            else:
                # Keep first line as raw headline evidence only
                title = header[:120] if len(header) > 3 else None

            bullets = [ln.lstrip("•*-–— ").strip() for ln in lines[1:] if ln.lstrip("•*-–— ")]
            # Drop pure date lines from bullets
            bullets = [b for b in bullets if not _DATE_RANGE.fullmatch(b)][:12]
            if not title and not company and not bullets:
                continue
            roles.append(
                {
                    "title": title,
                    "company": company,
                    "dates": dates,
                    "bullets": bullets,
                    "evidence": chunk[:1500],
                }
            )
    return roles[:20]


def _parse_education(edu_blocks: list[str]) -> list[dict]:
    entries: list[dict] = []
    for block in edu_blocks:
        chunks = re.split(r"\n\s*\n", block)
        for chunk in chunks:
            lines = [ln.strip() for ln in chunk.splitlines() if ln.strip()]
            if not lines:
                continue
            degree_m = _DEGREE.search(chunk)
            dates = None
            dm = _DATE_RANGE.search(chunk)
            if dm:
                dates = {"start": dm.group("start").strip(), "end": dm.group("end").strip()}
            entries.append(
                {
                    "degree": degree_m.group(0).strip() if degree_m else None,
                    "school": lines[0][:160],
                    "dates": dates,
                    "evidence": chunk[:1200],
                }
            )
    return entries[:15]


def _section_snippets(blocks: list[str]) -> list[str]:
    return [b[:2000] for b in blocks[:8]]


def _text_metrics(text: str) -> dict:
    words = re.findall(r"[A-Za-z0-9][A-Za-z0-9+.#/-]*", text)
    lines = [ln for ln in text.splitlines() if ln.strip()]
    return {
        "char_count": len(text),
        "word_count": len(words),
        "line_count": len(lines),
        "estimated_pages": round(max(len(text) / 3000, 0.5), 1),
    }


def _ats_checklist(
    *,
    contact: dict,
    skills: list[dict],
    roles: list[dict],
    education: list[dict],
    summary: str | None,
    sections: dict[str, list[str]],
    metrics: dict,
) -> dict:
    checks = [
        {"id": "email", "label": "Email present", "pass": bool(contact.get("emails")), "weight": 10},
        {"id": "phone", "label": "Phone present", "pass": bool(contact.get("phones")), "weight": 5},
        {"id": "skills", "label": "Skills detected", "pass": len(skills) >= 3, "weight": 15},
        {"id": "experience", "label": "Experience section", "pass": bool(sections.get("experience")), "weight": 15},
        {"id": "roles", "label": "Parseable roles", "pass": len(roles) >= 1, "weight": 15},
        {"id": "education", "label": "Education section", "pass": bool(sections.get("education") or education), "weight": 10},
        {"id": "summary", "label": "Summary/profile", "pass": bool(summary), "weight": 5},
        {"id": "links", "label": "Portfolio/LinkedIn/GitHub link", "pass": bool(contact.get("links") or contact.get("linkedin") or contact.get("github")), "weight": 5},
        {
            "id": "length",
            "label": "Reasonable length (200–1200 words)",
            "pass": 200 <= int(metrics.get("word_count") or 0) <= 1200,
            "weight": 10,
        },
        {
            "id": "bullets",
            "label": "Experience bullets present",
            "pass": any(r.get("bullets") for r in roles),
            "weight": 10,
        },
    ]
    total_w = sum(c["weight"] for c in checks) or 1
    earned = sum(c["weight"] for c in checks if c["pass"])
    score = round(100 * earned / total_w)
    return {"score": score, "checks": checks, "passed": sum(1 for c in checks if c["pass"]), "total": len(checks)}


def _action_verb_stats(experience_blocks: list[str]) -> dict:
    text = "\n".join(experience_blocks).lower()
    # Count verbs at start of bullets roughly
    starts = re.findall(r"(?:^|\n)\s*[•*\-–—]?\s*([a-z]{3,})", text)
    hits = [w for w in starts if w in _ACTION_VERBS]
    counts = Counter(hits)
    return {
        "strong_bullet_starts": len(hits),
        "top_verbs": [{"verb": v, "count": c} for v, c in counts.most_common(8)],
    }


def _build_findings(
    *,
    contact: dict,
    skills: list[dict],
    soft_skills: list[dict],
    roles: list[dict],
    education: list[dict],
    ats: dict,
    action: dict,
    metrics: dict,
) -> list[dict]:
    findings: list[dict] = []
    findings.append(
        {
            "severity": "info",
            "code": "ats_score",
            "message": f"ATS-style completeness score {ats['score']}/100 ({ats['passed']}/{ats['total']} checks passed).",
        }
    )
    if skills:
        top = ", ".join(s["name"] for s in skills[:8])
        findings.append(
            {
                "severity": "strength",
                "code": "skills_found",
                "message": f"Found {len(skills)} lexicon skills in text (e.g. {top}).",
            }
        )
    else:
        findings.append(
            {
                "severity": "gap",
                "code": "skills_missing",
                "message": "No known technical skills matched the in-house lexicon in this text.",
            }
        )
    if roles:
        findings.append(
            {
                "severity": "strength",
                "code": "roles_parsed",
                "message": f"Parsed {len(roles)} experience role block(s) from the resume.",
            }
        )
    else:
        findings.append(
            {
                "severity": "gap",
                "code": "roles_missing",
                "message": "Could not parse clear job roles — add title/company/date lines under Experience.",
            }
        )
    if not contact.get("emails"):
        findings.append(
            {
                "severity": "gap",
                "code": "email_missing",
                "message": "No email address detected in the text.",
            }
        )
    if education:
        findings.append(
            {
                "severity": "info",
                "code": "education_found",
                "message": f"Found {len(education)} education entr(y/ies).",
            }
        )
    if soft_skills:
        names = ", ".join(s["name"] for s in soft_skills[:5])
        findings.append(
            {
                "severity": "info",
                "code": "soft_skills",
                "message": f"Soft-skill phrases found in text: {names}.",
            }
        )
    if action.get("strong_bullet_starts", 0) == 0 and roles:
        findings.append(
            {
                "severity": "gap",
                "code": "weak_bullets",
                "message": "Experience bullets rarely start with strong action verbs (built, led, shipped, …).",
            }
        )
    wc = int(metrics.get("word_count") or 0)
    if wc and wc < 200:
        findings.append(
            {
                "severity": "gap",
                "code": "too_short",
                "message": f"Resume text is short ({wc} words) — may hurt ATS keyword coverage.",
            }
        )
    if wc > 1200:
        findings.append(
            {
                "severity": "info",
                "code": "long_resume",
                "message": f"Resume text is long ({wc} words) — consider tightening to 1–2 pages.",
            }
        )
    return findings
