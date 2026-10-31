# HireMatch AI — AI Evaluation Plan

**Status:** Planning only — no models in Phase 1.

## Goals

Measure retrieval, reranking, extraction, and explanation quality before claiming product fitness.

## Datasets

- Permissioned, de-identified resume/JD pairs with labeled relevance
- Job-family stratified samples (backend, data, frontend, etc.)
- Never train shared models on customer resumes without legal basis + consent

## Metrics

| Stage | Metrics |
|-------|---------|
| Retrieval | Recall@K, Precision@K, MRR |
| Reranking | nDCG@K vs baseline; pairwise accuracy |
| Skill extraction | Precision/recall vs gold spans |
| Matching | Score consistency; evidence grounding rate |
| Robustness | Formatting variants, OCR noise |

## Process

1. Freeze labeled eval set version
2. Compare ≥2 embedding models before default selection
3. Evaluate retrieval and reranking separately
4. Track false positives/negatives by job family
5. Fairness / disparate-impact review where appropriate — exclusion of protected attrs ≠ “unbiased”
6. Regression tests for every serious AI defect

## Phase 1 note

No AI inference ships in Phase 1. This plan guides Phases 2–4 and Phase 7 hardening.
