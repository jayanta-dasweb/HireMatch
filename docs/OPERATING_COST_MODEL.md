# HireMatch AI — Preliminary Operating Cost Model

**Illustrative only** — validate with real invoices before setting prices.

## Cost drivers

| Driver | Notes |
|--------|-------|
| Compute (API + workers) | Scales with resume parses & match requests |
| GPU / CPU inference | Sentence transformers + cross-encoder |
| PostgreSQL storage | Rows + embeddings (pgvector) |
| Object storage | Original PDFs/DOCX + exports |
| Redis | Queue depth under bulk import |
| Email / SMS | Verification & notifications |
| Payment fees | Razorpay/Cashfree % + GST considerations |
| Support | Agency customers cost more than candidates |

## Rough unit economics (planning)

Track monthly:

- Cost per resume processed
- Cost per match request
- Gross margin by plan (Candidate Pro vs Agency)

## Pricing guardrails (India, illustrative)

| Plan | Illustrative price | Guardrail |
|------|--------------------|-----------|
| Free | ₹0 | Hard quotas |
| Candidate Pro | ₹299–₹599/mo | Cap analyses |
| Recruiter | ₹1,999–₹3,999/mo | Seat + volume |
| Agency | ₹5,000–₹15,000/mo | Seats + bulk |
| Enterprise | Custom | Private deploy option |

Avoid unlimited AI on low-priced plans until costs are measured.
