from app.services.resume_analysis import ANALYZER_ID, analyze_resume


SAMPLE = """
Jane Doe
jane.doe@example.com
+1 555-123-4567
https://linkedin.com/in/janedoe
https://github.com/janedoe

Summary
Backend engineer focused on APIs and reliability.

Experience
Software Engineer at Acme
Jan 2020 - Present
- Built payment APIs with FastAPI and Docker
- Led PostgreSQL migration and reduced latency
- Mentored two junior engineers

Education
B.S. Computer Science, State University
2016 - 2020

Skills
Python, FastAPI, Docker, React, PostgreSQL, Leadership
"""


def test_analyze_resume_depth():
    payload = analyze_resume(SAMPLE)
    assert payload["extractor"] == ANALYZER_ID
    assert payload["ats"]["score"] >= 70
    assert "jane.doe@example.com" in payload["contact"]["emails"]
    assert "Python" in payload["skills"]
    assert "Kubernetes" not in payload["skills"]  # not in text
    assert any(s["name"] == "Python" and s["mentions"] >= 1 for s in payload["skills_detailed"])
    assert len(payload["roles"]) >= 1
    role = payload["roles"][0]
    assert role.get("title")
    assert any("Built" in b or "FastAPI" in b for b in (role.get("bullets") or []))
    assert len(payload["education_entries"]) >= 1
    assert payload["findings"]
    assert payload["section_coverage"].get("experience") is True
    assert payload["metrics"]["word_count"] > 40


def test_analyze_empty_is_honest():
    payload = analyze_resume("")
    assert payload["skills"] == []
    assert payload["roles"] == []
    assert payload["ats"]["score"] < 40
