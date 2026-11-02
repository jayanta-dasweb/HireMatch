from app.services.resume_structure import extract_structure


def test_extract_structure_finds_evidence_only():
    text = """
Jane Doe
jane.doe@example.com
+1 555-123-4567
https://linkedin.com/in/janedoe
https://github.com/janedoe

Skills
Python, FastAPI, Docker, React

Experience
Software Engineer at Acme
Built APIs with Python and FastAPI.

Education
B.S. Computer Science
"""
    payload = extract_structure(text)
    assert payload["extractor"] == "local_v1"
    assert "jane.doe@example.com" in payload["contact"]["emails"]
    assert "Python" in payload["skills"]
    assert "FastAPI" in payload["skills"]
    assert "Docker" in payload["skills"]
    assert "React" in payload["skills"]
    # Not in text — must not invent
    assert "Kubernetes" not in payload["skills"]
    assert "TensorFlow" not in payload["skills"]
    assert any("Acme" in block or "Software Engineer" in block for block in payload["experience_sections"])
    assert any("Computer Science" in block for block in payload["education_sections"])


def test_extract_structure_empty_text():
    payload = extract_structure("")
    assert payload["skills"] == []
    assert payload["contact"]["emails"] == []
    assert payload["experience_sections"] == []
