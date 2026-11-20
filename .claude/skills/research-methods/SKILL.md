---
name: research-methods
description: How agents research for the oncology platform — systematic literature search (PubMed MCP), trial search (ClinicalTrials.gov MCP), source grading, conflict handling, citation format and keeping docs/RESEARCH.md current. Use for any literature review, landscape scan, evidence summary or fact-check.
---

# Research methods

## Workflow
1. **Frame** the question (PICO: population, intervention, comparator, outcome) and date window.
2. **Search** in parallel: PubMed MCP (`search_articles`, `get_article_metadata`, `find_related_articles`), ClinicalTrials.gov MCP (`search_trials`, `get_trial_details`, `search_by_eligibility`), web search for regulatory/company news (prefer primary: fda.gov, ema.europa.eu, hl7.org, company press releases, journal pages).
3. **Grade** each source: primary peer-reviewed RCT/meta-analysis > guideline > preprint/abstract > company claim > news/blog. Mark company-reported performance as "company-reported, not independently verified".
4. **Reconcile** conflicts explicitly — state both values, which source, and which is more credible.
5. **Write** a dated finding into `docs/RESEARCH.md` with the source link; never paste uncited facts.

## Citation format
`Claim — Source (type, date) [link]`. Use PMID / NCT / DOI when available.

## Freshness
Oncology moves fast: anything older than 12 months on approvals, trial status, licences or guidelines must be re-checked before use in product decisions.

## Bias checks
Funding source, single-centre vs multi-centre, population mismatch (most AI models trained on US/European data — flag for South-Asian applicability), surrogate vs hard endpoints.
