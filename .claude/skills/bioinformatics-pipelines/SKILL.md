---
name: bioinformatics-pipelines
description: Clinical cancer genomics pipelines for the oncology platform — tumour/normal DNA sequencing, somatic and germline variant calling, annotation, CNV, fusions, TMB, MSI, HRD, RNA expression, ctDNA/MRD tracking, QC and reproducibility. Use when building, reviewing or explaining any sequencing-data workflow or variant interpretation step.
---

# Bioinformatics pipelines

## Principles
- Reproducible: **Nextflow + nf-core** pipelines, containerised (Docker/Singularity), pinned versions, GRCh38, MANE Select transcripts.
- Every result carries: sample ID, pipeline name + version + commit, reference build, QC summary, run date.
- Clinical-grade use needs a CAP/CLIA (or ISO 15189) validated lab; the platform **interprets lab outputs** and runs research pipelines — it does not replace an accredited lab report.

## Standard flows
| Input | Pipeline (starting point) | Key outputs |
|---|---|---|
| Tumour–normal WES/WGS/panel | nf-core/sarek (Mutect2, Strelka2, Manta, ASCAT/CNVkit) | somatic SNV/indel VCF, CNV, SV |
| Germline | nf-core/sarek germline (HaplotypeCaller/DeepVariant) | germline VCF → ACMG classification |
| RNA-seq | nf-core/rnaseq; fusions nf-core/rnafusion (Arriba, STAR-Fusion) | expression, fusions |
| Annotation | Ensembl VEP + gnomAD + ClinVar + COSMIC (licence) + OncoKB/CIViC | annotated MAF |
| Biomarkers | TMB (mut/Mb, panel-size aware), MSI (MSIsensor-pro), HRD scores | biomarker panel |
| ctDNA / MRD | tumour-informed variant tracking, VAF trend | MRD status timeline |
| Single-cell / spatial (research) | scanpy / Seurat, squidpy | cell states, niches |

## QC gates (block downstream interpretation if failed)
Coverage depth and uniformity, tumour purity/ploidy estimate, contamination, sample-swap check (tumour–normal concordance), duplication rate, strand bias, VAF thresholds by assay limit of detection.

## Interpretation hand-off
1. Filter: PASS calls, population AF < 1 % (gnomAD), assay LoD.
2. Classify oncogenicity (ClinGen/CGC/VICC SOP) and actionability (OncoKB level, AMP tier, ESCAT) — see `clinical-evidence-standards`.
3. Germline-suspicious findings (e.g., BRCA1/2, Lynch genes, TP53 at ~50 % VAF) → flag for `cancer-geneticist` and germline confirmation.
4. Output a FHIR GRIG-compliant report + a human-readable summary for the tumor board.

## ctDNA guidance (evidence as of 2026)
ctDNA is a strong prognostic marker. Randomised support for ctDNA-guided adjuvant decisions exists in bladder cancer (IMvigor011) and stage II colon cancer; escalation/de-escalation elsewhere is not yet proven outside trials — the platform shows MRD trends as information, not as an automatic treatment trigger.

## Tooling
Python (pysam, cyvcf2, pandas, polars), R/Bioconductor (maftools, DESeq2), bcftools/samtools, IGV/igv.js for review.
