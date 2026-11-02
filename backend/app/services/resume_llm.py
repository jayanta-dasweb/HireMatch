"""Embedded open-weight resume understanding — runs in-process, no external inference API.

Model weights are cached under HF_HOME. Heuristic analysis remains the baseline;
LLM output is evidence-validated before merge (never keep invented skills/emails).
"""

from __future__ import annotations

import json
import logging
import os
import re
import threading
from typing import Any

from app.core.config import get_settings

logger = logging.getLogger(__name__)

LLM_EXTRACTOR_ID = "hirematch_embedded_llm_v1"

_lock = threading.Lock()
_pipe = None
_load_error: str | None = None

_JSON_FENCE = re.compile(r"\{[\s\S]*\}")


def llm_available() -> bool:
    settings = get_settings()
    if not settings.resume_llm_enabled:
        return False
    if _load_error:
        return False
    return True


def enrich_with_local_llm(text: str, baseline: dict[str, Any]) -> dict[str, Any]:
    """Run embedded model; merge validated fields into baseline analysis dict."""
    settings = get_settings()
    if not settings.resume_llm_enabled:
        return {**baseline, "llm": {"enabled": False, "used": False}}

    raw = (text or "").replace("\x00", "").strip()
    if len(raw) < 40:
        return {
            **baseline,
            "llm": {"enabled": True, "used": False, "detail": "text_too_short"},
            "extractor": baseline.get("extractor") or LLM_EXTRACTOR_ID,
        }

    try:
        generated = _generate_json(raw[: settings.resume_llm_max_input_chars])
    except Exception as exc:  # noqa: BLE001
        logger.exception("Embedded LLM failed")
        return {
            **baseline,
            "llm": {"enabled": True, "used": False, "detail": str(exc)[:500]},
        }

    if not isinstance(generated, dict):
        return {
            **baseline,
            "llm": {"enabled": True, "used": False, "detail": "invalid_json"},
        }

    merged = _merge_validated(baseline, generated, raw)
    merged["extractor"] = LLM_EXTRACTOR_ID
    merged["analyzer"] = baseline.get("analyzer") or baseline.get("extractor")
    merged["llm"] = {
        "enabled": True,
        "used": True,
        "model": settings.resume_llm_model,
    }
    return merged


def _ensure_pipeline():
    global _pipe, _load_error
    if _pipe is not None or _load_error:
        return _pipe
    with _lock:
        if _pipe is not None or _load_error:
            return _pipe
        settings = get_settings()
        os.environ.setdefault("HF_HOME", settings.hf_home)
        os.makedirs(settings.hf_home, exist_ok=True)
        try:
            import torch
            from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline

            model_id = settings.resume_llm_model
            logger.info("Loading embedded resume model %s into %s", model_id, settings.hf_home)
            tokenizer = AutoTokenizer.from_pretrained(model_id)
            model = AutoModelForCausalLM.from_pretrained(
                model_id,
                torch_dtype=torch.float32,
                low_cpu_mem_usage=True,
            )
            _pipe = pipeline(
                "text-generation",
                model=model,
                tokenizer=tokenizer,
                device=-1,
            )
            logger.info("Embedded resume model ready")
        except Exception as exc:  # noqa: BLE001
            _load_error = str(exc)[:1000]
            logger.exception("Could not load embedded model")
            return None
        return _pipe


def _generate_json(text: str) -> dict[str, Any] | None:
    pipe = _ensure_pipeline()
    if pipe is None:
        raise RuntimeError(_load_error or "model_unavailable")

    settings = get_settings()
    prompt = (
        "You extract resume facts. Reply with ONLY one JSON object. "
        "Use only information present in the resume text. "
        "If unknown, use null or []. Never invent employers, degrees, skills, or dates.\n"
        "JSON schema:\n"
        "{"
        '"summary": string|null,'
        '"skills": string[],'
        '"roles": [{"title": string|null, "company": string|null, '
        '"dates": {"start": string|null, "end": string|null}|null, "bullets": string[]}],'
        '"education_entries": [{"degree": string|null, "school": string|null, '
        '"dates": {"start": string|null, "end": string|null}|null}],'
        '"soft_skills": string[]'
        "}\n"
        f"Resume text:\n{text}\n"
        "JSON:"
    )

    out = pipe(
        prompt,
        max_new_tokens=settings.resume_llm_max_new_tokens,
        do_sample=False,
        return_full_text=False,
        pad_token_id=getattr(pipe.tokenizer, "eos_token_id", None),
    )
    content = ""
    if out and isinstance(out, list):
        content = (out[0].get("generated_text") or "").strip()
    return _parse_json_object(content)


def _parse_json_object(content: str) -> dict[str, Any] | None:
    if not content:
        return None
    try:
        data = json.loads(content)
        if isinstance(data, dict):
            return data
    except json.JSONDecodeError:
        pass
    m = _JSON_FENCE.search(content)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _appears_in_text(value: str, text: str) -> bool:
    v = (value or "").strip()
    if len(v) < 2:
        return False
    return v.lower() in text.lower()


def _merge_validated(baseline: dict[str, Any], llm: dict[str, Any], text: str) -> dict[str, Any]:
    out = dict(baseline)

    # Summary: only if grounded (overlap with text words)
    summary = llm.get("summary")
    if isinstance(summary, str) and summary.strip() and _summary_grounded(summary, text):
        out["summary"] = summary.strip()[:2000]

    # Skills: keep only those present in resume text
    llm_skills = llm.get("skills") if isinstance(llm.get("skills"), list) else []
    grounded_skills = []
    for s in llm_skills:
        if isinstance(s, str) and _appears_in_text(s, text):
            grounded_skills.append(s.strip())
    # Union with heuristic skills
    merged_skills = list(dict.fromkeys([*(out.get("skills") or []), *grounded_skills]))
    out["skills"] = merged_skills

    # Soft skills phrases must appear in text
    soft = llm.get("soft_skills") if isinstance(llm.get("soft_skills"), list) else []
    soft_out = []
    for s in soft:
        if isinstance(s, str) and _appears_in_text(s, text):
            soft_out.append({"name": s.strip(), "evidence": [s.strip()]})
    if soft_out:
        # Prefer LLM soft skills when grounded; else keep baseline
        existing = {x.get("name", "").lower() for x in (out.get("soft_skills") or [])}
        for row in soft_out:
            if row["name"].lower() not in existing:
                out.setdefault("soft_skills", []).append(row)

    # Roles: keep only if title or company appears in text
    roles = llm.get("roles") if isinstance(llm.get("roles"), list) else []
    validated_roles = []
    for role in roles:
        if not isinstance(role, dict):
            continue
        title = role.get("title") if isinstance(role.get("title"), str) else None
        company = role.get("company") if isinstance(role.get("company"), str) else None
        if title and not _appears_in_text(title, text):
            title = None
        if company and not _appears_in_text(company, text):
            company = None
        bullets_in = role.get("bullets") if isinstance(role.get("bullets"), list) else []
        bullets = [b.strip() for b in bullets_in if isinstance(b, str) and _appears_in_text(b[:40], text)][:12]
        dates = role.get("dates") if isinstance(role.get("dates"), dict) else None
        if title or company or bullets:
            validated_roles.append(
                {
                    "title": title,
                    "company": company,
                    "dates": dates,
                    "bullets": bullets,
                    "evidence": None,
                    "source": "embedded_llm",
                }
            )
    if validated_roles:
        # Prefer LLM roles when we got several; else keep baseline if LLM empty-ish
        if len(validated_roles) >= len(out.get("roles") or []):
            out["roles"] = validated_roles

    edu = llm.get("education_entries") if isinstance(llm.get("education_entries"), list) else []
    validated_edu = []
    for e in edu:
        if not isinstance(e, dict):
            continue
        degree = e.get("degree") if isinstance(e.get("degree"), str) else None
        school = e.get("school") if isinstance(e.get("school"), str) else None
        if degree and not _appears_in_text(degree[:24], text):
            degree = None
        if school and not _appears_in_text(school[:24], text):
            school = None
        if degree or school:
            validated_edu.append(
                {
                    "degree": degree,
                    "school": school,
                    "dates": e.get("dates") if isinstance(e.get("dates"), dict) else None,
                    "evidence": None,
                    "source": "embedded_llm",
                }
            )
    if validated_edu and len(validated_edu) >= len(out.get("education_entries") or []):
        out["education_entries"] = validated_edu

    findings = list(out.get("findings") or [])
    findings.insert(
        0,
        {
            "severity": "info",
            "code": "embedded_llm",
            "message": f"Enriched with embedded open model ({get_settings().resume_llm_model}); invented fields stripped.",
        },
    )
    out["findings"] = findings
    return out


def _summary_grounded(summary: str, text: str) -> bool:
    words = [w.lower() for w in re.findall(r"[A-Za-z]{4,}", summary)]
    if not words:
        return False
    lower = text.lower()
    hits = sum(1 for w in words if w in lower)
    return hits / max(len(words), 1) >= 0.4
