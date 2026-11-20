---
name: clinical-data-science
description: Data science and analytics methods for the oncology platform — cohort building, survival analysis, predictive model development and validation, calibration, fairness, reporting standards (TRIPOD+AI, CONSORT-AI, SPIRIT-AI, DECIDE-AI), operational KPIs and real-world evidence. Use for any model training, statistical analysis, dashboard metric or study design.
---

# Clinical data science

## Analysis toolkit
- Python: pandas/polars, scikit-learn, lifelines / scikit-survival, statsmodels, PyTorch, MONAI, SHAP. R: survival, survminer, tidyverse.
- Cohorts: OMOP CDM + ATLAS-style definitions; always report inclusion/exclusion flow.

## Survival and outcomes
Kaplan–Meier with numbers at risk, Cox PH (check proportional hazards), competing risks (Fine–Gray) where death from other causes matters, RECIST 1.1 response, PFS/OS/DFS definitions stated explicitly.

## Predictive models — required validation
- Discrimination (AUROC/C-index with 95 % CI), **calibration** (plot + slope/intercept), decision-curve analysis.
- External / temporal validation before any clinical use; subgroup performance (sex, age, site, ethnicity, Bangladesh vs foreign training data).
- Data leakage checks (patient-level splits, time-ordered splits).
- Report with **TRIPOD+AI**; trials with **CONSORT-AI / SPIRIT-AI**; early live evaluation with **DECIDE-AI**.

## Monitoring after deployment
Input drift, output drift, performance on adjudicated cases, override rate, alert acceptance, equity dashboard. Retraining requires change control (see regulatory-compliance, predetermined change control plan).

## Platform KPIs
- Clinical: time from symptom/abnormal result to diagnosis; time diagnosis→treatment start; % patients with guideline-indicated biomarker testing; trial screening rate; contraindication catches.
- AI quality: concordance with tumor board, citation precision, unsupported-claim rate, override reasons.
- Ops: clinician minutes saved per case, queue age, alert burden per clinician.

## Rules
Never report a metric without its denominator and CI. Never train on real patient data without ethics approval and data-use agreement.
