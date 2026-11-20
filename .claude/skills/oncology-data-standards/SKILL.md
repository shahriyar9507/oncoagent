---
name: oncology-data-standards
description: Data models, terminologies and file formats for the oncology platform — HL7 FHIR R4, mCODE STU4, Genomics Reporting IG, OMOP CDM, DICOM, HGVS/VCF, ICD-10/ICD-O-3, SNOMED CT, LOINC, RxNorm, TNM staging. Use when designing schemas, APIs, ingestion, integrations or any data exchange.
---

# Oncology data standards

## Clinical exchange
- **HL7 FHIR R4** as the operational API. Server: HAPI FHIR (open source) or a managed FHIR service.
- **mCODE (minimal Common Oncology Data Elements), STU4 / v4.0.0** — ~30 profiles in six groups: Patient, Disease (primary/secondary cancer condition, TNM staging), Assessment (tumor markers, ECOG/Karnofsky, disease status), Genomics, Treatment (procedures, radiotherapy, medications), Outcome. Check hl7.org/fhir/us/mcode for current version before implementing.
- **Genomics Reporting IG (GRIG) STU2** — variant, haplotype, genotype, therapeutic implication observations; variants via HGVS or VCF-style components.
- **SMART on FHIR** for EHR-launched apps; **CDS Hooks** for in-workflow suggestion cards (maps well to our recommendation cards).

## Research / analytics
- **OMOP CDM v5.4** + Oncology extension for cohort studies; ETL from FHIR.

## Terminologies
- Diagnosis: ICD-10-CM / ICD-10 (WHO), **ICD-O-3** topography + morphology for tumours.
- Clinical findings/procedures: SNOMED CT (licence per country).
- Labs: LOINC. Drugs: RxNorm (US) / ATC (international); keep a local Bangladesh brand→generic map.
- Staging: AJCC TNM 8th/9th edition (record edition).
- Genes: HGNC symbols; variants HGVS (c./p.), transcripts MANE Select; genome build GRCh38 only.

## Files
- Sequencing: FASTQ → BAM/CRAM → VCF (somatic: MAF also). Store with checksum + pipeline version.
- Imaging: DICOM; viewer via DICOMweb (Orthanc server for dev). Pathology whole-slide images: DICOM-WSI or vendor formats via OpenSlide.
- Structures: mmCIF/PDB.

## Identity and consent
- Master patient index; pseudonymous research IDs; consent as FHIR Consent resources (scope: treatment, research, data sharing, re-contact).

## Synthetic/public data for development
Synthea (with oncology modules), TCGA/GDC open-access, cBioPortal public studies, TCIA imaging collections (check each collection licence).
