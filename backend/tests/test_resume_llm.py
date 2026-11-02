from app.services.resume_analysis import analyze_resume
from app.services.resume_llm import _merge_validated, enrich_with_local_llm


SAMPLE = """
Jane Doe
jane.doe@example.com
Experience
Software Engineer at Acme
- Built APIs with Python and FastAPI
Skills
Python, FastAPI, Docker
"""


def test_merge_strips_invented_skills_and_keeps_grounded():
    baseline = analyze_resume(SAMPLE)
    llm = {
        "summary": "Engineer using Python and FastAPI at Acme",
        "skills": ["Python", "Telepathy", "FastAPI"],
        "roles": [
            {
                "title": "Software Engineer",
                "company": "Acme",
                "dates": {"start": "2020", "end": "Present"},
                "bullets": ["Built APIs with Python and FastAPI"],
            },
            {
                "title": "Astronaut",
                "company": "Mars Corp",
                "bullets": ["Flew to Mars"],
            },
        ],
        "education_entries": [],
        "soft_skills": ["telepathy"],
    }
    merged = _merge_validated(baseline, llm, SAMPLE)
    assert "Python" in merged["skills"]
    assert "FastAPI" in merged["skills"]
    assert "Telepathy" not in merged["skills"]
    assert all((r.get("company") or "") != "Mars Corp" for r in merged.get("roles") or [])
    assert any((r.get("company") or "") == "Acme" for r in merged.get("roles") or [])


def test_enrich_disabled_returns_baseline(monkeypatch):
    monkeypatch.setenv("RESUME_LLM_ENABLED", "false")
    from app.core.config import get_settings

    get_settings.cache_clear()
    baseline = analyze_resume(SAMPLE)
    out = enrich_with_local_llm(SAMPLE, baseline)
    assert out["llm"]["enabled"] is False
    assert out["llm"]["used"] is False
    get_settings.cache_clear()
