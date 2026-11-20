# Research findings — Agentic AI Precision Oncology Platform

Research date: 2026-11-20. Re-check anything here before product or investment decisions; items marked *company-reported* are not independently verified.

## 1. Can each step of the vision be done today?

| Step in the vision | 2026 reality | Feasibility now |
|---|---|---|
| Agent monitors patient data in real time, knows which test is needed | Multi-agent tumor-board systems exist in research and early deployment: Microsoft Healthcare Agent Orchestrator (radiology, pathology, staging, guideline, trial agents; Stanford, Johns Hopkins, Providence, UW Health early adopters); a tumor-board-inspired multi-agent system in JCO CCI 2026 reached 94 % correct guideline selection / 90 % on guideline questions (100-question benchmark); OMGs (ovarian) and CoMMa preprints. All say more validation is needed. | **High** — build it, as decision support with HITL |
| Find the responsible gene/protein from test results | Routine in molecular pathology: NGS + curated KBs (OncoKB levels, CIViC A–E, AMP/ASCO/CAP tiers, ESMO ESCAT). Pathology foundation models predict some mutations from H&E (e.g., EGFR AUC 0.89 internal; Tempus NSCLC LDT AUCs 0.6–0.89) — triage only. | **High** — interpretation layer over lab results |
| AlphaFold 3 gives the protein's structure | Works for many complexes. **AF3 weights: non-commercial only; outputs not for commercial activity**; commercial use needs a licence (Google DeepMind / Isomorphic). AlphaFold Server: non-commercial, daily quota. AlphaFold DB (single chains) is CC-BY 4.0. Open alternatives with commercial-friendly terms exist — check each licence. | **Medium** — fine for explanation/research; licence-gated for commercial |
| IsoDDE designs a new drug/protein directly | IsoDDE announced 10 Feb 2026; *company-reported* gains over AF3 in structure, pocket finding and binding-affinity prediction (rivalling FEP+). **Partner-only** (Lilly, Novartis, J&J), not self-service. | **Low for us directly** — partnership route only |
| New drug reaches the patient fast | As of mid-2026 **no AI-discovered drug is FDA-approved**; Insilico's rentosertib entered Phase III (July 2026); Isomorphic's clinical status reported inconsistently. A new molecule still needs preclinical + phased trials. | **Not per-patient**. Real "personalised drug" today = matching approved targeted drugs/trials, and personalised neoantigen vaccines made by licensed manufacturers |
| Personalised therapy example that works | Intismeran autogene (Moderna/Merck personalised mRNA neoantigen therapy) + pembrolizumab: Phase 3 INTerpath-001 positive; 42 % lower risk of recurrence or death vs pembrolizumab alone (ESMO 2026, accepted NEJM); OS immature; no approval found yet. | Shows the direction; platform role = selection, logistics, monitoring |
| Doctor makes final decision (HITL) | Matches regulatory direction: FDA CDS guidance revised Jan 2026 (HCP-facing, reviewable basis; relaxed "single recommendation" stance; silent on LLMs). Image/signal analysis remains SaMD. | **Required** design principle |

## 2. Regulation and privacy
- **FDA CDS guidance (revised final, 6 Jan 2026)** supersedes 2022; HCP-facing only; image/IVD-signal processing stays SaMD. One source dates publication 11 Mar 2026 — verify on fda.gov.
- **FDA "plausible mechanism" framework** — draft guidance Feb 2026 for individualised genetic therapies in severe rare disease; law firms note it is not a new approval standard; final status unconfirmed.
- **Bangladesh Personal Data Protection Ordinance 2025** — cabinet approved 9 Oct 2025, gazetted Nov 2025; health/genetic = sensitive data; data subjects own their data; confidential/restricted data must be stored in Bangladesh; research/public-health exemptions; penalties. Verify the gazette and any sector rules.
- Bangladesh device regulator: DGDA — confirm AI/software rules before pilot.

## 3. Bangladesh context (if the first market is Bangladesh)
- GLOBOCAN 2022: ~167,256 new cases, 116,598 deaths; newer estimate ~187,000 new cases/year. No population-based cancer registry, so true burden uncertain.
- Workforce (Financial Express, Feb 2026): ~250 radiation oncologists, **22 medical oncologists**, 47 paediatric oncologists, 70 medical physicists. A column estimates need of ~2,000 clinical oncologists.
- Molecular testing: only one or two dedicated cancer molecular labs; samples often sent to India. **icddr,b Genome Centre launched NGS cancer diagnostics (April 2026)** for breast, lung, colon, ovarian and blood cancers.
- Implication: an AI assistant that multiplies scarce specialist time has strong value; the platform must ingest external PDF lab reports, work in Bangla, and keep data in-country.

## 4. Evidence on monitoring biomarkers
- ctDNA/MRD: strong prognostic marker. Randomised support for ctDNA-guided adjuvant therapy in bladder cancer (IMvigor011) and stage II colon cancer; PEGASUS missed its primary endpoint; reviews say escalation/de-escalation solely on ctDNA is not yet supported outside trials.

## 5. Data standards
- mCODE STU4 (v4.0.0): ~30 FHIR profiles, six groups; genomics derived from HL7 Genomics Reporting IG STU2 (HGVS or VCF-style variants). CodeX accelerator drives adoption; radiotherapy IG extends mCODE.

## 6. What this means for the product (conclusions)
1. Lead with **clinical decision support**: monitoring, test advice, genomic interpretation, guideline + trial matching, tumor-board preparation — evidence and regulation support this now.
2. Treat **structure prediction** as an *explanation* and *research-prioritisation* tool; keep licences clean.
3. Treat **drug design** as a **partnership/research pipeline** (target dossiers → partner engines → preclinical → trials), never as same-week treatment.
4. Build **HITL, audit and evaluation** first; they are the product's moat and its regulatory path.

## 7. Global burden (GLOBOCAN 2022, IARC)
- ~20 million new cancer cases and 9.7 million deaths in 2022; projected 35.3 million new cases by 2050 (mostly population growth and ageing).
- Lung cancer: 2,480,675 new cases (12.4 %, #1) and 1,817,469 deaths (18.7 %, #1); projected 4.62 million cases by 2050.
- Breast ~2.31 million and colorectal ~1.93 million new cases (GLOBOCAN 2022, Bray et al. 2024).
- Bangladesh: 167,256 new cases, 116,598 deaths (2022); breast is #1 in women (12,989 cases); in men the top three are oesophagus, lip/oral cavity and lung. No national registry yet.

## 8. Which cancer first — data availability
| Criterion | NSCLC | Breast | Colorectal |
|---|---|---|---|
| AACR GENIE samples (2025 release, >268,000 samples total) | 38,000+ | 21,000+ | 23,000+ |
| Global new cases 2022 | 2.48 M (#1) | 2.31 M | 1.93 M |
| Deaths 2022 | 1.82 M (#1) | lower | ~0.9 M |
| Actionable/oncogenic drivers | 40–60 % of adenocarcinomas (EGFR, ALK, ROS1, BRAF, KRAS G12C, MET, RET, NTRK, HER2) | HR/HER2/PIK3CA/BRCA — fewer distinct targeted lines | KRAS/BRAF/MSI/HER2 — fewer |
| Targeted approvals | ~30 new NSCLC drugs since 2011; 7 targeted approvals/indications in 2024 | many, mostly HR/HER2 | fewer |
| Public multi-omics/imaging | TCGA LUAD/LUSC (~1,000 patients with slides), CPTAC LUAD proteogenomics (~110 tumours), NLST CT (26,254 subjects, 11.3 TB; 53,454 enrolled) | TCGA BRCA, METABRIC, mammography sets | TCGA COAD/READ |
| Resistance biology + 3D structures | extensively mapped (EGFR T790M/C797S, ALK); many PDB structures | moderate | moderate |
| Bangladesh relevance | top-3 male cancer; EGFR rate between Western and East-Asian levels (single-centre study); icddr,b NGS covers lung | #1 female cancer; covered by icddr,b | covered by icddr,b |
**Decision:** NSCLC first (best data + most actionable + best fit for the protein/structure story), breast second, colorectal third.
EGFR prevalence context: Asia pooled 38.4 %; India 20–39.6 % by region; no national Bangladesh figure.

## 9. Therapy levels — can it be "100 % possible"? (evidence)
No medical system is 100 % accurate. What the evidence says, by level:
- **L1 Select:** in-indication guideline matching works; off-label molecular matching is weak — SHIVA randomised phase 2 (Lancet Oncol 2015) showed no PFS benefit; NCI-MATCH: ~38 % had an actionable alteration, ~18 % assigned, most subprotocols missed the 16 % ORR bar; I-PREDICT (Nat Med 2019): higher matching score → better disease control, PFS, OS (matching rate 49 %).
- **L2 Personalise dose:** CURATE.AI PRECISE feasibility — 10 patients, recommendations accepted in 26 of 27 considered decisions, mean dose −20 % vs projected standard; no randomised outcome yet. EXALT functional (ex-vivo) testing — 30/56 (54 %) reached PFS ratio ≥ 1.3; EXALT-2 randomised ongoing.
- **L3 Modify / new molecule:**
  - Per-mutation redesign: 4th-gen EGFR inhibitors vs C797S — BH-30643 ORR 45 % (95 % CI 29–62 %) in 40 patients (SOLARA phase 1/2, 2026); HS-10504 phase 1; JIN-A02 phase 1/2; none approved. Daraxonrasib (RAS(ON) multi-selective) RASolute 302 phase 3: median OS 13.2 vs 6.7 months, HR 0.40, NEJM 2026; not yet approved.
  - Computational design success: zasocitinib (TYK2, psoriasis) phase 3 met all endpoints; NDA accepted, action expected Q1 2027 (secondary source).
  - AI-native molecules: phase I success 80–90 % (21/24), phase II ~40 % (4/10) (Jayatunga et al., Drug Discov Today 2024). Oncology LOA from phase I ≈ 5.1 % (BIO 2006–2015).
  - Per-patient custom medicines that exist: milasen ASO (treatment within ~1 year, NEJM 2019); baby KJ base editing (~6 months, NEJM 2025); autogene cevumeran (pancreatic; 8/16 immune responders, 6/8 responders disease-free at 3 years; ~90 % of responders alive at 6 years per AACR 2026); intismeran phase 3 (−42 % recurrence/death).
  - Prediction accuracy: AF3 PoseBusters pose success ~76 % (<2 Å), ~90 % with pocket specified (secondary); Boltz-2 affinity Pearson 0.66 vs FEP+ 0.78 on FEP+ benchmark.
- **Conclusion:** L1 and L2 can be built now with clinician sign-off. L3 is real and accelerating but is a research pipeline measured in years per molecule; per-patient custom therapies exist for programmable modalities (mRNA, ASO, gene editing, cell therapy), not yet for newly synthesised small molecules.

## 10. AI-discovered molecules — leaders and failures (Nov 2026)
Pipeline: ~173–175 AI-originated programs in human trials (early 2026; ~94 phase I, ~56 phase II, ~15 phase III — secondary trackers). No new AI-discovered molecule FDA-approved yet.
Leaders:
- Zasocitinib (TAK-279, TYK2, psoriasis; Nimbus/Schrödinger computational design) — phase 3 met all endpoints, reportedly beat Sotyktu head-to-head (Jun 2026); NDA priority review, action expected Q1 2027 (secondary).
- Baricitinib for COVID-19 — AI-identified repurposing (BenevolentAI, early 2020); EUA Nov 2020; COV-BARRIER −38 % deaths; full FDA approval May 2022. Only AI-found treatment already approved, but an existing drug.
- Rentosertib (Insilico, TNIK, IPF; AI target + AI molecule) — phase 2a Nature Medicine 2025; phase 3 (320 patients) 2026.
- GB-0895 (Generate:Biomedicines, AI-designed antibody, severe asthma) — phase 3 SOLAIRIA-1 from Dec 2025.
- Oncology: zovegalisib (RLY-2608, Relay, mutant-selective PI3Kα, breast) — phase 1/2 median PFS 11.1 months; phase 3 ReDiscover-2 enrolling to mid-2027; FDA Breakthrough. IAM1363 (Iambic, HER2) ~28 % response in heavily pretreated patients (secondary). ISM6331 (Insilico, pan-TEAD) Fast Track, mesothelioma. REC-617 (Recursion, CDK7) early partial response.
Failures: DSP-1181 (Exscientia/Sumitomo, OCD; first AI-designed drug in trials) stopped after phase I (2022); BEN-2293 (BenevolentAI, atopic dermatitis) missed efficacy Apr 2023; REC-994 (Recursion) dropped May 2025 (efficacy not sustained); EXS-21546 (Exscientia, oncology) wound down.
Pattern: AI molecules pass safety (phase I 80–90 %) but phase II efficacy (~40 %) matches industry — failures are biology (wrong target/patient), not chemistry.

## 11. Without AI vs with AI — comparison numbers used in the brief
- Discovery time to preclinical candidate: traditional 2.5–4 years (some sources 4.5–6) vs Insilico 12–18 months average across 22 candidates (2021–24); rentosertib preclinical cost ~US$2.6 M vs US$15–25 M conventional (secondary).
- Phase transition (BIO 2006–2015): phase I 63.2 % (n=3,582), phase II 30.7 % (n=3,862); AI-native: phase I 21/24 (87.5 %), phase II 4/10 (40 %).
- Trial screening: TrialGPT (Nature Communications 2024) — 42.6 % less screening time in an NCI pilot, criterion accuracy 87.3 %.
- Tumor-board case summary: Northside Hospital pilot — 20–30 → 10–15 min per case, some inaccuracies (Roche summary, 2025).
- Biomarker testing before first-line therapy, NSCLC (US): ~45 % with evidence of testing (JAMA Netw Open 2025;8(7):e2519963, via Targeted Oncology).
- Workload: Bangladesh 167,256 new cases ÷ 22 medical oncologists ≈ 7,603; ÷ ~272 medical + radiation oncologists ≈ 615. US >2 M new cases (ACS 2026) ÷ 14,547 haem/med oncologists billing Medicare in 2024 (ASCO, JCO OP 2025) ≈ 137. Definitions differ — rough comparison.
- Sources: https://pmc.ncbi.nlm.nih.gov/articles/PMC11574183 · https://diagnostics.roche.com/global/en/healthcare-transformers/article/ai-in-oncology-tumor-boards.html · https://join.targetedonc.com/view/genomic-profiling-underused-in-advanced-cancer-no-added-cost-burden · https://ascopost.com/news/october-2025/state-of-the-hematology-and-medical-oncologist-workforce-in-the-united-states/ · https://www.biopharminternational.com/view/clinical-development-success-rates-examined-new-bio-report

## Sources
- IntuitionLabs — AI-discovered drugs in clinical trials 2026: https://intuitionlabs.ai/articles/ai-discovered-drugs-clinical-trials-2026
- IntuitionLabs — AI drug discovery and FDA approvals: https://intuitionlabs.ai/articles/ai-drug-discovery-fda-approvals
- Insilico rentosertib phase III: https://www.artificialintelligence-news.com/news/insilico-medicine-advances-ai-drug-for-ipf-to-phase-iii-trials/
- Endpoints — first AI-designed drugs fall short: https://endpts.com/?p=431986
- Relay Q3 2026 update (zovegalisib): https://finviz.com/news/415858/relay-therapeutics-reports-third-quarter-2026-financial-results-and-corporate-updates
- Targeted Oncology — zovegalisib + fulvestrant PFS: https://www.targetedonc.com/view/zovegalisib-plus-fulvestrant-shows-durable-pfs-in-pi3k--mutated-hr-her2-metastatic-breast-cancer
- BioSpace — baricitinib EUA after BenevolentAI hypothesis: https://www.biospace.com/fda-grants-emergency-use-authorisation-for-baricitinib-in-hospitalised-covid-19-patients-nine-months-after-initial-hypothesis-was-published-by-benevolentai
- BioSpace — COV-BARRIER 38 % fewer deaths: https://www.biospace.com/benevolentai-data-from-eli-lilly-s-cov-barrier-trial-shows-baricitinib-reduced-deaths-in-hospitalised-covid-19-patients-by-38-percent
- UVA — FDA approves baricitinib for COVID-19 (2022): https://med.virginia.edu/emergency-medicine/2022/05/20/us-fda-approves-baricitinib-emro-recognized-for-their-participation/
- Let's Data Science — AI drug discovery 2026 test: https://letsdatascience.com/news/ai-driven-drug-discovery-faces-2026-test-859792ad
- GLOBOCAN 2022 lung cancer burden and 2050 projections: https://pubmed.ncbi.nlm.nih.gov/39536404/
- UICC — GLOBOCAN 2022 summary: https://www.uicc.org/news/globocan-2022-latest-global-cancer-data-shows-rising-incidence-and-stark-inequities
- Healio — 35 million cases by 2050: https://cm.healio.com/news/hematology-oncology/20240404/new-cancer-diagnoses-projected-to-reach-35-million-worldwide-in-2050
- Cancer burden in Bangladesh (WAOCP): https://journal.waocp.org/article_92265.html
- AACR Project GENIE (annual report 2025): https://annualreport2025.aacr.org/project_genie.php
- Ten years of AACR Project GENIE: https://leadingdiscoveries.aacr.org/ten-years-of-aacr-project-genie/
- EGFR prevalence meta-analysis: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC5346692/
- EGFR in Bangladeshi lung adenocarcinoma: https://pure.fujita-hu.ac.jp/en/publications/frequency-of-epidermal-growth-factor-receptor-mutations-in-bangla/
- NSCLC actionable alterations review: https://pmc.ncbi.nlm.nih.gov/articles/PMC11528205
- CPTAC LUAD proteogenomics (Cell 2020): https://pubmed.ncbi.nlm.nih.gov/32649874/
- TCIA NLST: https://wiki.cancerimagingarchive.net/x/awFp
- SHIVA (Institut Curie): https://institut-curie.org/publications/molecularly-targeted-therapy-based-tumour-molecular-profiling-versus-conventional-therapy-advanced
- NCI-MATCH reanalysis: https://pmc.ncbi.nlm.nih.gov/articles/PMC7676884
- I-PREDICT (NIH Director's blog): https://directorsblog.nih.gov/tag/i-predict/
- CURATE.AI (NUS Medicine): https://medicine.nus.edu.sg/news/right-patient-right-dose-right-time/
- EXALT functional precision medicine: https://pmc.ncbi.nlm.nih.gov/articles/PMC8852353
- Jayatunga et al. AI-discovered molecules success rates: https://garymarklevin.substack.com/p/how-successful-are-ai-discovered
- BIO clinical development success rates: https://www.bio.org/press-release/bio-releases-largest-study-ever-clinical-development-success-rates
- OncLive — HS-10504 C797S: https://www.onclive.com/view/hs-10504-shows-promising-activity-in-egfr-c797s-mutant-nsclc-after-tki-resistance
- BH-30643 SOLARA: https://pharmacally.com/?p=23747
- Daraxonrasib RASolute 302 (Targeted Oncology): https://www.targetedonc.com/view/daraxonrasib-nearly-doubles-os-versus-chemotherapy-in-metastatic-pdac
- Zasocitinib phase 3 (BioSpace): https://www.biospace.com/drug-development/takedas-4b-nimbus-bet-pays-off-with-best-in-class-phase-iii-plaque-psoriasis-data
- Zasocitinib NDA (HCPLive): https://www.hcplive.com/view/q-a-zasocitinib-role-beyond-topicals-moderate-severe-psoriasis
- Milasen (Harvard): https://compgen.hms.harvard.edu/publications/patient-customized-oligonucleotide-therapy-rare-genetic-disease
- Baby KJ base editing (GEN): https://www.genengnews.com/topics/genome-editing/asgct-2025-worlds-first-patient-treated-with-personalized-crispr-therapy/
- Autogene cevumeran (AACR): https://www.aacr.org/about-the-aacr/newsroom/news-releases/immune-response-to-investigational-rna-vaccine-for-pancreatic-cancer-continues-to-correlate-with-clinical-benefit/
- Autogene cevumeran 6-year (MSK): https://www.mskcc.org/news/can-mrna-vaccines-fight-pancreatic-cancer-msk-clinical-researchers-are-trying-find-out
- AF3 and affinity ranking: https://www.biorxiv.org/content/10.1101/2025.05.27.656341.full.pdf
- Isomorphic Labs — IsoDDE announcement: https://www.isomorphiclabs.com/articles/the-isomorphic-labs-drug-design-engine-unlocks-a-new-frontier
- The Decoder on IsoDDE: https://the-decoder.com/googles-ai-drug-discovery-spinoff-isomorphic-labs-claims-major-leap-beyond-alphafold-3/
- Sacra — Isomorphic Labs profile: https://sacra.com/c/isomorphic-labs
- EMBL-EBI — AlphaFold 2 vs 3 licensing: https://www.ebi.ac.uk/training/online/courses/alphafold/alphafold-3-and-alphafold-server/introducing-alphafold-3/should-i-use-alphafold-2-or-alphafold-3
- AlphaFold 3 GitHub: https://github.com/google-deepmind/alphafold3
- Foley Hoag — AI drug discovery tool terms (Sep 2026): https://www.foleyhoag.com/news-and-insights/publications/alerts-and-updates/2026/september/the-ai-tools-speeding-up-drug-discovery-come-with-risky-fine-print/
- Tumor-board-inspired AI system (JCO CCI 2026 coverage): https://oncologynews.com.au/?p=60332
- CoMMa preprint: https://arxiv.org/html/2602.09159
- AACR — AI agents as doctors' deputies (Jun 2026): https://aacr.org/blog/2026/06/10/eye-on-ai-ai-agents-as-doctors-deputies-in-the-cancer-clinic
- UroWeb — tumour boards in the age of AI: https://uroweb.org/news/multidisciplinary-gu-tumour-boards-in-the-age-of-ai-obsolete-ritual-or-more-essential-than-ever
- Fierce Healthcare — Microsoft agent orchestrator: https://www.fiercehealthcare.com/ai-and-machine-learning/microsoft-rolls-out-agentic-ai-orchestrator-begins-cancer-care
- Becker's — Stanford & Microsoft: https://www.beckershospitalreview.com/healthcare-information-technology/digital-health/stanford-taps-microsoft-to-streamline-cancer-case-prep
- Covington — FDA CDS guidance 2026: https://www.cov.com/en/news-and-insights/insights/2026/01/5-key-takeaways-from-fdas-revised-clinical-decision-support-cds-software-guidance
- Ketryx — FDA 2026 CDS guidance: https://ketryx.com/blog/understanding-the-fdas-2026-clinical-decision-support-software-guidance-what-medical-device-companies-need-to-know
- Healio — intismeran 42 % recurrence reduction: https://www.healio.com/news/hematology-oncology/20261023/personalized-mrna-vaccine-reduced-melanoma-recurrence-risk-42-after-surgery
- Pharmaphorum — INTerpath-001 Phase 3: https://pharmaphorum.com/news/msd-moderna-skin-cancer-vaccine-scores-historic-phase-3-win
- RAPS — FDA plausible mechanism pathway: https://www.raps.org/resource/fda-proposes-plausible-mechanism-pathway-for-ultra.html
- Arnold & Porter — plausible mechanism framework: https://www.arnoldporter.com/en/perspectives/advisories/2026/02/fda-advances-a-plausible-mechanism-framework-for-rare-disease-drug-development-and-shifts-to
- AI-discovered drugs state of play 2026: https://lifesciencedaily.news/ai-discovered-drugs-2026/
- CIViC evidence levels: https://civic.readthedocs.io/en/latest/model/evidence/level.html
- Illumina — actionability crosswalk: https://help.connected.illumina.com/connected-insights/interpret-and-report/viewdetails-introduction/viewdetails-actionability
- VarSome — AMP somatic classification: https://varsome.com/about/resources/amp-implementation
- mCODE IG: https://hl7.org/fhir/us/mcode/
- mCODE genomics: https://build.fhir.org/ig/HL7/fhir-mCODE-ig/group-genomics.html
- Financial Express — future of cancer care in Bangladesh: https://today.thefinancialexpress.com.bd/print/future-of-cancer-care-in-bangladesh-1770225596
- TBS — icddr,b NGS cancer diagnostics: https://www.tbsnews.net/bangladesh/health/icddrb-launches-advanced-genome-sequencing-based-cancer-diagnostic-services
- Dhaka Tribune — GLOBOCAN figures: https://www.dhakatribune.com/bangladesh/health/422759/global-breast-cancer-deaths-could-rise-68%25-by
- Prothom Alo — cancer burden: https://en.prothomalo.com/amp/story/bangladesh/x8hoknflcw
- Daily Star — PDPO 2025 takeaways: https://www.thedailystar.net/tech-startup/news/bangladeshs-personal-data-protection-ordinance-2025-key-takeaways-4015401
- TBS — PDPO gazette: https://www.tbsnews.net/node/1281356
- Mahbub & Co — PDPO highlights: https://mahbub-law.com/key-highlights-of-the-personal-data-protection-ordinance-2025-for-businesses
- Dove Press — post-IMvigor011 ctDNA strategies: https://www.dovepress.com/post-imvigor011-era-ctdna-guided-postoperative-adjuvant-treatment-stra-peer-reviewed-fulltext-article-CMAR
- Targeted Oncology — PEGASUS: https://targetedonc.com/view/ctdna-guided-adjuvant-therapy-misses-primary-end-point-in-colon-cancer-trial
- OncLive — ctDNA stage II colon: https://www.onclive.com/view/ctdna-guided-adjuvant-chemotherapy-improves-dfs-reduces-disease-recurrence-in-stage-ii-colon-cancer
- PulmoFoundation preprint: https://arxiv.org/pdf/2605.25878
- Tempus NSCLC H&E LDT validation: https://www.tempus.com/publications/validation-of-he-based-laboratory-development-test-predicting-molecular-alterations-in-non-small-cell-lung-cancer/
