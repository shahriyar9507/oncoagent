// Deterministic molecular-report extractor for case intake (NGS / PCR / FISH / IHC report text → structured alterations).
//
// A clinician pastes report text; this module proposes CIViC-style alterations that the clinician then confirms.
// Rules only (regular expressions), no language model, nothing leaves the browser. Conservative by design: an
// alteration is returned only when a gene and a specific change are both stated and the statement is not negated,
// hedged ("pending", "recommended"), labelled VUS/benign, or written as general commentary ("C797S confers
// resistance…"). Anything unclear becomes a warning for the clinician, never a variant.

import type { ExtractedVariant, ReportExtraction, Variant } from "../types";

type Kind = Variant["kind"];

// ───────────────────────────── genes ─────────────────────────────

/** Genes the extractor recognises, with protein length (aa, longest common isoform) to reject impossible positions. */
const GENE_LENGTH = new Map<string, number>([
  ["EGFR", 1210], ["ERBB2", 1255], ["KRAS", 189], ["NRAS", 189], ["HRAS", 189], ["BRAF", 807], ["MET", 1408],
  ["ALK", 1620], ["ROS1", 2347], ["RET", 1114], ["NTRK1", 796], ["NTRK2", 838], ["NTRK3", 839], ["NRG1", 640],
  ["TP53", 393], ["STK11", 433], ["KEAP1", 624], ["PIK3CA", 1068], ["SMARCA4", 1647], ["CDKN2A", 173], ["PTEN", 403],
  ["RB1", 928], ["MAP2K1", 393], ["AKT1", 480], ["FGFR1", 822], ["FGFR2", 822], ["FGFR3", 808], ["NF1", 2839],
]);

const GENE_ALIASES = new Map<string, string>([
  ["HER2", "ERBB2"], ["HER2NEU", "ERBB2"], ["NEU", "ERBB2"], ["HER1", "EGFR"], ["ERBB1", "EGFR"], ["CMET", "MET"],
  ["HGFR", "MET"], ["ROS", "ROS1"], ["TRKA", "NTRK1"], ["TRKB", "NTRK2"], ["TRKC", "NTRK3"], ["TRK", "NTRK"],
  ["LKB1", "STK11"], ["P53", "TP53"], ["P16", "CDKN2A"], ["INK4A", "CDKN2A"], ["P16INK4A", "CDKN2A"],
  ["BRG1", "SMARCA4"], ["MEK1", "MAP2K1"],
]);

/** Genes whose clinically relevant alteration is a fusion/rearrangement ("ALK positive" means ALK fusion). */
const FUSION_DRIVERS = new Set(["ALK", "ROS1", "RET", "NTRK1", "NTRK2", "NTRK3", "NTRK", "NRG1"]);

/** Canonical HGNC-style symbol: HER2 → ERBB2, c-MET → MET, case-insensitive, trimmed. Unknown names are upper-cased. */
export function normaliseGene(name: string): string {
  const trimmed = name.trim().toUpperCase();
  const compact = trimmed.replace(/[^A-Z0-9]/g, "");
  const alias = GENE_ALIASES.get(compact);
  if (alias) return alias;
  if (GENE_LENGTH.has(compact) || compact === "NTRK") return compact;
  return trimmed;
}

function isKnownGene(symbol: string): boolean {
  const g = normaliseGene(symbol);
  return GENE_LENGTH.has(g) || g === "NTRK";
}

// ───────────────────────────── protein notation ─────────────────────────────

const AA3_TO_1: Record<string, string> = {
  Ala: "A", Arg: "R", Asn: "N", Asp: "D", Cys: "C", Gln: "Q", Glu: "E", Gly: "G", His: "H", Ile: "I", Leu: "L", Lys: "K",
  Met: "M", Phe: "F", Pro: "P", Ser: "S", Thr: "T", Trp: "W", Tyr: "Y", Val: "V", Ter: "*", Sec: "U", Pyl: "O", Xaa: "X",
};
const AA3_CODES = Object.keys(AA3_TO_1).join("|");
const AA3_START_RE = new RegExp(`^(?:${AA3_CODES})\\d`, "i");
const AA3_ANY_RE = new RegExp(AA3_CODES, "gi");

/**
 * Protein change to one-letter form: p.Leu858Arg → L858R, p.Gly12Cys → G12C, p.Arg213Ter → R213*,
 * p.Glu746_Ala750del → E746_A750del, p.Asp770_Asn771insSerValAsp → D770_N771insSVD. One-letter input is
 * returned in canonical case (p.l858r → L858R).
 */
export function threeToOne(protein: string): string {
  let s = protein.trim().replace(/^p\.\s*/i, "").trim();
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1).trim();
  if (AA3_START_RE.test(s)) {
    s = s.replace(AA3_ANY_RE, (code) => AA3_TO_1[code[0].toUpperCase() + code.slice(1).toLowerCase()] ?? code);
  } else {
    s = s.replace(/Ter/g, "*");
  }
  const m = /^([A-Za-z*])(\d+)(?:_([A-Za-z])(\d+))?(.*)$/.exec(s);
  if (!m) return s;
  const head = `${m[1].toUpperCase()}${m[2]}${m[3] ? `_${m[3].toUpperCase()}${m[4]}` : ""}`;
  const rest = m[5];
  const indel = /^(delins|del|dup|ins)(.*)$/i.exec(rest);
  if (indel) return head + indel[1].toLowerCase() + indel[2].toUpperCase();
  const fs = /^([A-Za-z]?)fs(.*)$/i.exec(rest);
  if (fs) return `${head}${fs[1].toUpperCase()}fs${fs[2].toUpperCase()}`;
  return head + rest.toUpperCase();
}

// ───────────────────────────── regular expressions ─────────────────────────────
// Target is ES2017: no look-behind, no named groups, no "s" flag. Sticky ("y") patterns are matched at a position.

const AA3 = "Ala|Arg|Asn|Asp|Cys|Gln|Glu|Gly|His|Ile|Leu|Lys|Met|Phe|Pro|Ser|Thr|Trp|Tyr|Val";
const AA1 = "[ACDEFGHIKLMNPQRSTVWY]";
const AAX = `(?:${AA3}|${AA1})`;
const PROTEIN_TOKEN = [
  `${AAX}\\d{2,4}_${AAX}\\d{2,4}(?:delins(?:${AAX})+|del(?:${AAX})*|dup|ins(?:${AAX})+)`,
  `${AAX}\\d{2,4}(?:delins(?:${AAX})+|del|dup)`,
  `${AAX}\\d{2,4}(?:${AAX})?fs(?:\\*|Ter|X)?(?:\\d+|\\?)?`,
  `${AAX}\\d{2,4}(?:${AA3}|Ter|${AA1}|X|\\*)`,
].join("|");
const PROTEIN_RE = new RegExp(`(\\bp\\.\\s?\\(?\\s?)?\\b(${PROTEIN_TOKEN})\\)?(?![A-Za-z0-9_*])`, "gi");
const PROTEIN_WHOLE_RE = new RegExp(`^(?:${PROTEIN_TOKEN})$`, "i");

const GENE_TOKENS = [
  "NTRK\\s?-?[123](?:\\s?(?:\\/|,|-|&|and|or)\\s?[123])+", "NTRK\\s?-?[123]", "NTRK",
  "HER-?2(?:\\s?\\/\\s?neu)?", "ERBB-?2", "ERBB-?1", "HER-?1", "EGFR", "KRAS", "NRAS", "HRAS", "BRAF", "c-?MET", "MET",
  "ALK", "ROS-?1", "RET", "NRG-?1", "TP53", "STK11", "LKB1", "KEAP1", "PIK3CA", "SMARCA4", "CDKN2A", "PTEN", "RB1",
  "MAP2K1", "MEK1", "AKT1", "FGFR[123]", "NF1",
];
const GENE_RE = new RegExp(`\\b(${GENE_TOKENS.join("|")})(?:(?![A-Za-z0-9])|(?=ex(?:on)?\\s?\\d))`, "gi");

/** An upper-case symbol directly followed by a protein change: a gene the extractor does not cover (e.g. "ATM p.V2424G"). */
const UNKNOWN_GENE_RE = new RegExp(
  `\\b([A-Z][A-Z0-9]{1,9})(?=\\s?[:|(]?\\s?(?:p\\.\\s?\\(?)?(?:(?:${AA3})\\d|${AA1}\\d{2,4}(?:[A-Z*](?![A-Za-z0-9])|_|del|dup|ins|fs)))`,
  "g",
);
const UNKNOWN_STOP = new Set([
  "AND", "OR", "NOT", "THE", "WITH", "ALSO", "FOR", "VAF", "AF", "MAF", "NGS", "DNA", "RNA", "IHC", "FISH", "PCR", "TPS",
  "CPS", "FFPE", "VUS", "SNV", "CNV", "MSI", "TMB", "NM", "NP", "HGVS", "EXON", "PD", "CDX", "FDA", "EMA", "NCCN", "ESMO",
  "TKI", "TKIS", "TIER", "LOH", "HRD", "ID", "MUT", "WT", "POS", "NEG", "NO", "YES", "CT", "PET", "MRI", "EBUS", "TBNA",
  "COSMIC", "AMP", "ASCO", "CAP", "ACMG", "IA", "IB", "II", "IIA", "IIB", "III", "IV", "GENE", "NOTE", "SEE", "PLUS",
]);

const DRIVER_SRC = "ALK|ROS-?1|RET|NTRK[123]|NRG-?1";
const EXON_TAG = "(?:\\s?\\(\\s?(?:exon|ex|[A-Z])?\\s?\\d{1,2}\\s?\\)|\\s(?:exon|ex)\\s?\\d{1,2})";
const FUSION_RE = new RegExp(`\\b([A-Za-z][A-Za-z0-9]{1,9})(${EXON_TAG})?\\s?(::|-|\\/|:)\\s?(${DRIVER_SRC})(${EXON_TAG})?(?![A-Za-z0-9])`, "gi");
const FUSION_REV_RE = new RegExp(`\\b(${DRIVER_SRC})(${EXON_TAG})?\\s?(::|-)\\s?([A-Za-z][A-Za-z0-9]{1,9})(${EXON_TAG})?(?![A-Za-z0-9])`, "gi");
const KNOWN_PARTNERS = new Set([
  "EML4", "KIF5B", "CCDC6", "NCOA4", "CD74", "SLC34A2", "SDC4", "EZR", "TPM3", "TPM4", "ETV6", "LMNA", "TPR", "HIP1",
  "KLC1", "STRN", "TFG", "GOPC", "FIG", "LRIG3", "CLTC", "MYO5A", "SQSTM1", "PRKAR1A", "TRIM24", "TRIM33", "ERC1",
  "AKAP13", "ZCCHC8", "SLC3A2", "ATP1B1", "VAMP2", "IRF2BP2", "BCR", "PPFIBP1", "CCDC88C", "KIF1B", "DCTN1", "PPL",
  "SPECC1L", "MPRIP", "CHTOP", "NFASC", "BCAN", "PAN3", "AFAP1", "QKI", "NACC2", "TPD52L1", "MYH9", "CD47",
]);
const FUSION_STOP = new Set([...UNKNOWN_STOP, "TKI", "IHC", "FISH", "NGS", "RT", "D5F3", "5A4", "D4D6", "SP384", "VENTANA", "RNA", "DNA"]);

// Exon-level wording. No leading \b so "EGFRex19del" and "METex14" work; the start is checked in code.
const EX19_RE = /(?:(?:exon|ex|e)\.?\s?-?\s?19\s?-?\s?(?:in[\s-]?frame\s+)?(deletions?|dels?|delins|indels?)|(deletions?|dels?)\s+(?:in|of|within)\s+exon\s?19|del\s?19|19\s?(?:deletions?|del))(?![A-Za-z0-9])/gi;
const EX20_RE = /(?:(?:exon|ex|e)\.?\s?-?\s?20\s?-?\s?(?:in[\s-]?frame\s+)?(insertions?|ins|dup(?:lication)?s?)|(insertions?|dup(?:lication)?s?)\s+(?:in|of|within)\s+exon\s?20|ins\s?20|20\s?(?:insertions?|ins))(?![A-Za-z0-9])/gi;
const EX14_RE = /(?:(?:exon|ex|e)\.?\s?-?\s?14\s?-?\s?(?:skipping|skip(?:ped)?|splice[\s-]?site|splicing|splice)(?:\s+(?:mutation|alteration|variant)s?)?|(?:exon|ex)\.?\s?-?\s?14\s?-?\s?(mutations?|alterations?|variants?|deletions?)|skipping\s+of\s+exon\s?14|(?:Δ|delta\s?)\s?ex(?:on)?\s?14|ex14(?:\s?skip(?:ping)?)?|(exon\s?14))(?![A-Za-z0-9])/gi;
const AMP_RE = /\b(?:(?:high|low)[\s-]?level\s+|focal\s+|gene\s+)?(amplifications?|amplified|amp|copy[\s-]?number\s+(?:gains?|amplifications?)|cn\s?gains?)(?![A-Za-z0-9])/gi;

// Result words, checked at the position right after a gene / alteration (and its descriptors).
const NEG_Y = /(?:negative|neg|not\s+detected|undetected|non-?detected|none\s+detected|not\s+identified|not\s+found|not\s+present|not\s+seen|not\s+observed|absent|wild[\s-]?type|wt|unaltered|normal|no\s+evidence(?:\s+of)?|no(?:\s+[a-z][a-z-]*){0,3}?\s+(?:(?:was|were|is|are)\s+)?(?:detected|identified|found|seen|observed|present)|no(?=\s*(?:$|[|;,.)])))(?![A-Za-z])/iy;
const HEDGE_Y = /(?:not\s+(?:performed|done|tested|assessed|evaluated|evaluable|available|interpretable|reportable|assessable)|pending|awaited|awaiting|requested|ordered|recommended|suggested|advised|to\s+follow|to\s+be\s+[a-z]+|failed|failure|insufficient|inconclusive|indeterminate|equivocal|borderline|uninformative|invalid|qns|unable|cannot|could\s+not|n\/a|unknown|in\s+progress)(?![A-Za-z])/iy;
const POS_Y = /(?:positive|pos|detected|present|identified|found|confirmed|seen|observed|noted|harbou?r(?:s|ed|ing)?|yes)(?![A-Za-z])/iy;
const MUT_Y = /(?:mutated|mutant|mutation[\s-]positive)(?![A-Za-z])/iy;
const PLUS_Y = /\+(?!\d)/y;
const SEP_Y = /[\s:=|/\-()[\]*•·]+/y;
const CONNECTOR_Y = /(?:is|was|were|are|has\s+been|have\s+been|appears?(?:\s+to\s+be)?|reported\s+as|reported|results?|resulted|status|interpretation|call|showed|shows|revealed|reveals)(?![A-Za-z])/iy;
const NOT_FINDING_Y = /(?:inhibitors?|tkis?|targeted|directed|selective|therap(?:y|ies)|drugs?|agents?|antibod(?:y|ies)|blockade)(?![A-Za-z])/iy;
const FOR_Y = /\s*for\s*:?\s*/iy;
const RESULT_WORD_RE = new RegExp(`\\b(?:${[NEG_Y, HEDGE_Y, POS_Y, MUT_Y].map((r) => r.source).join("|")})`, "i");
const PCT_Y = /(\d{1,3}(?:\.\d+)?)\s?%/y;
const CLONE_Y = /(?=[A-Z0-9-]*\d)(?=[0-9-]*[A-Z])[A-Z0-9][A-Z0-9-]{1,7}(?![A-Za-z0-9])/y;
const DESCRIPTOR_Y = new RegExp(
  `(?:${[
    "c\\.[^\\s,;|()]+", "g\\.[^\\s,;|()]+", "NM_\\d+(?:\\.\\d+)?", "ENST\\d+(?:\\.\\d+)?", "chr[0-9XY]{1,2}:[^\\s,;|()]+",
    "exons?\\s?\\d{1,2}(?:\\s?(?:-|to|and|\\/)\\s?\\d{1,2})*", "ex\\d{1,2}", "codons?\\s?\\d{1,4}(?:\\s?(?:-|to|and|\\/)\\s?\\d{1,4})*",
    "kinase\\s+domain", "tier\\s?(?:IV|I{1,3}|[1-4])[AB]?", "class\\s?[1-5]", "(?:likely\\s+)?(?:pathogenic|oncogenic)",
    "somatic", "subclonal", "clonal", "heterozygous", "homozygous", "hotspot", "in\\s+cis", "in\\s+trans", "cis", "trans",
    "fusions?", "rearrangements?", "rearranged", "translocations?", "translocated", "break-?apart", "split(?:\\s+signals?)?",
    "signals?", "probes?", "copy[\\s-]number(?:\\s+(?:variation|alteration|status|analysis))?", "cnv", "high[\\s-]level",
    "low[\\s-]level", "focal", "point\\s+mutations?", "mutations?", "mutational", "variants?", "snvs?", "indels?",
    "changes?", "substitutions?", "alterations?", "aberrations?", "abnormalit(?:y|ies)", "genes?", "testing", "tested",
    "tests?", "analysis", "analyses", "assay", "panel", "method", "screen(?:ing)?", "next[\\s-]generation\\s+sequencing",
    "sequencing", "immunohistochemistry", "ihc", "fish", "ngs", "rt-?pcr", "q?pcr", "ddpcr", "real[\\s-]time", "cobas",
    "idylla", "therascreen", "ventana", "pharmdx", "cdx", "rna", "dna", "ct\\s?dna", "cf\\s?dna", "tissue", "plasma",
    "sample", "specimen", "expression", "protein", "staining", "by", "via", "using", "with", "on", "in", "from", "of",
    "the", "an?", "for",
  ].join("|")})(?![A-Za-z0-9])`,
  "iy",
);

/** Negation written before a gene / alteration ("No", "Negative for:", "No pathogenic variants were detected in"). */
const NEG_PREFIX_RE = /(?:\bno|\bwithout|\babsence\s+of|\bnegative(?:\s+(?:result\s+)?for)?|\bnegatives|\bnot\s+detected(?:\s+(?:in|for))?|\bnone\s+detected(?:\s+(?:in|for))?|\bwild[\s-]?type(?:\s+for)?|\bno\s+evidence\s+of|\bruled\s+out|\bexcluded|\bneg)\s*[:-]?\s*(?:(?:an?|any|the)\s+)?(?:(?:pathogenic|likely\s+pathogenic|actionable|oncogenic|clinically\s+(?:significant|relevant)|reportable|targetable|detectable|known|other|additional|further|somatic)\s+)*(?:(?:mutations?|alterations?|variants?|fusions?|rearrangements?|amplifications?|changes?|abnormalit(?:y|ies))\s+(?:(?:were|was|are|is)\s+)?(?:(?:detected|identified|found|seen|observed)\s+)?(?:in|of|involving|for|affecting)\s+(?:the\s+)?)?(?:genes?\s*:?\s*)?$/i;
/** Hedges written before a gene / alteration: testing advice, not a result. */
const HEDGE_PREFIX_RE = /(?:\b(?:testing|tests?|tested|screen(?:ing|ed)?|assess(?:ment|ed)?|evaluat(?:e|ed|ion)|look(?:ing)?|send|sent|request(?:ed)?|order(?:ed)?)\s+for|\brule\s+out|\br\/o|\bconsider(?:ing)?|\brecommend(?:ed|s)?|\bsuggest(?:ed|s)?|\breflex(?:\s+(?:to|for))?|\bif|\bwhether|\bsuspected|\bquery|\?|\bpending|\bawaiting)\s*:?\s*(?:(?:an?|any|the)\s+)?$/i;
const SEP_ONLY_RE = /^[\s,/&|]*(?:(?:and|or|nor|as\s+well\s+as)\s*)?[\s,/&|]*$/i;
const OWNER_AFTER_RE = /^\s*(?:[([]\s*)?(?:(?:mutation|variant|alteration|deletion|insertion)\s+)?(?:(?:in|of|on|within|at)\s+)?(?:the\s+)?$/i;
const NOT_VAF_AFTER_RE = /^\s*(?:of\s+(?:the\s+)?(?:\d+\s+)?(?:tumou?r\s+)?(?:cells|nuclei)|tumou?r|tps|cps|cellularity|content|purity|nuclei|cells|positive\s+(?:cells|nuclei))/i;

const VAF_LABEL = "(VAF|MAF|AF|(?:variant|mutant|mutation)\\s+allele\\s+(?:frequency|fraction|freq\\.?)|allele\\s+(?:frequency|fraction|freq\\.?)|allelic\\s+(?:frequency|fraction)|variant\\s+(?:frequency|fraction))";
const VAF_AFTER_SRC = `\\b${VAF_LABEL}\\s*(?:\\(\\s*%\\s*\\))?\\s*(?:[:=~]|of|was|is|at|approx\\.?|approximately|about)?\\s*(?:[:=~]\\s*)?(\\d{1,3}(?:\\.\\d+)?)\\s*(%|percent)?`;
const VAF_AFTER_RE = new RegExp(VAF_AFTER_SRC, "gi");
const VAF_Y = new RegExp(VAF_AFTER_SRC, "iy");
const VAF_BEFORE_RE = new RegExp(`(\\d{1,3}(?:\\.\\d+)?)\\s*%\\s*(?:\\(\\s*)?${VAF_LABEL}\\b`, "gi");

const VUS_RE = /\b(?:VUS|variants?\s+of\s+(?:uncertain|unknown|undetermined)\s+(?:clinical\s+)?significance|(?:uncertain|unknown)\s+(?:clinical\s+)?significance|tier\s?(?:III|3)(?![A-Za-z0-9]))/i;
const BENIGN_RE = /\b(?:likely\s+)?benign\b|\btier\s?(?:IV|4)(?![A-Za-z0-9])/i;
const NEG_HEADER_RE = /\b(?:negatives?|not\s+detected|wild[\s-]?type|no\s+(?:[a-z-]+\s+){0,3}(?:detected|identified|found)|none\s+detected)\b/i;
const SKIP_HEADER_RE = /^\s*(?:methods?|methodology|limitations?|disclaimers?|references?|background|gene\s+(?:list|information|descriptions?|background)|genes?\s+(?:tested|analy[sz]ed|covered|included|assessed|evaluated|targeted|on\s+(?:the\s+)?panel)|test\s+(?:description|information|details|methodology)|about\s+(?:this|the)\s+test|assay\s+(?:description|information|details)|panel\s+(?:content|genes|description)|technical\s+(?:notes?|information)|quality\s+metrics)\b/i;
const SECTION_START_RE = /^\s*(?:results?|interpretation|comments?|summary|conclusions?|findings|biomarkers?|recommendations?|pertinent\s+negatives?|clinically\s+significant|detected\s+(?:alterations?|variants?|mutations?)|reportable|pd-?\s?l1|tier\s+(?:I|II|1|2)(?![A-Za-z0-9]))/i;
const COMMENTARY_RE = /\b(?:confers?|conferring|mechanisms?|associated\s+with|has\s+been|have\s+been|studies|literature|(?:is|are)\s+(?:an?\s+|the\s+)?(?:most\s+)?(?:known|common|frequent|rare|well|recogni[sz]ed|established|sensiti[sz]ing|activating|resistance|actionable|targetable|driver|oncogenic\s+driver)|occurs?\s+in|accounts?\s+for|reported\s+in|may\s+(?:confer|be|predict|indicate|respond|benefit)|might|could\s+(?:be|confer)|can\s+(?:be|confer|cause)|in\s+patients|patients\s+(?:with|whose|harbou?ring|who)|approved\s+for|indicated\s+for|eligible\s+for|such\s+as|for\s+example|detects|covers|includes|interrogates|designed\s+to|limit\s+of\s+detection|capable\s+of|predicts?|predictive\s+of|this\s+(?:assay|test|panel)|the\s+(?:assay|test|panel)\s+(?:detects|covers|includes|can))\b|\be\.g\./i;
const RESULT_CUE_RE = /\b(?:detected|positive|negative|identified|present|absent|wild[\s-]?type|VAF|allele\s+(?:frequency|fraction)|tier\s+(?:I{1,3}|IV|[1-4])|pathogenic|harbou?rs|carries)\b|\bp\.\s?\(?[A-Za-z]|\bc\.\d|\d\s?%/i;

const TPS_RE = /\b(?:TPS|tumou?r\s+proportion\s+score)(?:\s?\(\s?TPS\s?\))?\s?(?:[:=]|of|was|is|score|-)?\s?(?:[:=]\s?)?(<=|>=|≤|≥|<|>|~|approx(?:\.|imately)?)?\s?(\d{1,3}(?:\.\d+)?)\s?(?:(?:-|to)\s?(\d{1,3}(?:\.\d+)?)\s?)?(?:%|percent)/gi;
const TPS_BEFORE_RE = /(?:^|[^A-Za-z0-9.])(<=|>=|≤|≥|<|>|~)?\s?(\d{1,3}(?:\.\d+)?)\s?%\s*(?:TPS|tumou?r\s+proportion\s+score)\b/gi;
const PDL1_RE = /\bPD-?\s?L1\b/gi;
const PDL1_PCT_RE = /^[^%;]{0,40}?(?:^|[^A-Za-z0-9.])(<=|>=|≤|≥|<|>|~)?\s?(\d{1,3}(?:\.\d+)?)\s?(?:(?:-|to)\s?(\d{1,3}(?:\.\d+)?)\s?)?%/;

const PLASMA_RE = /\b(?:plasma|ct\s?DNA|cf\s?DNA|liquid\s+biops(?:y|ies)|cell[\s-]free\s+(?:tumou?r\s+)?DNA|circulating\s+tumou?r\s+DNA|blood[\s-]based)\b/i;
const TISSUE_RE = /\b(?:tissue(?![\s-]agnostic)|FFPE|formalin[\s-]fixed|paraffin|(?:biopsy|tissue|tumou?r|cell)\s+block|core\s+(?:needle\s+)?biops(?:y|ies)|resection|lobectomy|cytology|EBUS)\b/i;
const SPECIMEN_LINE_RE = /\b(?:specimen|sample|material|source)(?:\s+(?:type|source|site))?\s*[:-]\s*([^\n;|]{1,80})/i;
const TUMOUR_CONTENT_RE = /\b(tumou?r\s+(?:cell\s+)?(?:content|cellularity|purity|percentage|fraction)|neoplastic\s+(?:cell\s+)?(?:content|cellularity)|ct\s?DNA\s+(?:tumou?r\s+)?fraction|(?:estimated\s+)?tumou?r\s+%)\s*(?:\([^)]{0,20}\)\s*)?(?:[:=]|of|is|was|estimated(?:\s+at)?|approx(?:\.|imately)?|about|~)?\s*(?:[:=]\s*)?(<|≤|<=|~)?\s*(\d{1,3}(?:\.\d+)?)\s*%/i;
const LOW_QUALITY_RE = /\b(?:(?:low|limited|insufficient|suboptimal|inadequate|poor|reduced)\s+(?:coverage|sequencing\s+depth|depth|DNA|RNA|cfDNA|ctDNA|input|yield|quality|tumou?r\s+(?:content|cellularity|fraction)|cellularity|sample\s+quality|specimen)|QNS|quantity\s+not\s+sufficient|failed\s+(?:QC|quality(?:\s+control)?)|did\s+not\s+(?:meet|pass)\s+(?:QC|quality)|below\s+(?:the\s+)?(?:validated|minimum|recommended)\s+\w+|not\s+evaluable|uninformative)\b/i;

/** Hallmark alterations: an orphan change ("T790M detected") inherits the gene named earlier on the line only if it fits. */
const HALLMARK = new Map<string, RegExp>([
  ["EGFR", /^(?:G719[A-Z]|S768I|T790M|C797[A-Z]|L858R|L861[A-Z]|E709[A-Z]|L718[A-Z]|G724S|L792[A-Z]|G796[A-Z]|T854A)$/],
  ["KRAS", /^(?:G12|G13|Q61|A146|K117|A59)[A-Z]$/],
  ["NRAS", /^(?:G12|G13|Q61|A146|K117|A59)[A-Z]$/],
  ["BRAF", /^(?:V600|G469|K601|L597|D594|G466|N581)[A-Z]$/],
  ["ERBB2", /^(?:S310|V777|L755|V842|D769|R678|L869|T798)[A-Z]$/],
  ["MET", /^(?:D1228|Y1230|H1094|D1246|Y1248|F1200|L1195|G1163|D1010)[A-Z]$/],
  ["ALK", /^(?:G1202|L1196|I1171|F1174|C1156|G1269|L1198|F1245|R1275|V1180|D1203|E1210|S1206|G1128|T1151|L1152|R1192)[A-Z]$/],
  ["ROS1", /^(?:G2032|D2033|L2026|S1986|L2155|G2101|L1951|F2004)[A-Z]$/],
  ["RET", /^(?:G810|V804|M918|C634|L730|Y806|S904|E762)[A-Z]$/],
  ["PIK3CA", /^(?:E542|E545|H1047|E726|C420|Q546|M1043|N345|G1049|E453|R88)[A-Z]$/],
]);
const EGFR_SENSITISING = new Set(["L858R", "Exon 19 Deletion", "L861Q", "L861R", "S768I", "G719X", "G719A", "G719C", "G719S", "G719D"]);

// ───────────────────────────── types ─────────────────────────────

type CandType = "fusion" | "ex19" | "ex20" | "ex14" | "protein" | "amp";
type Result = "pos" | "neg" | "hedge" | "mutated";
type Status = "pos" | "neg" | "hedge" | "skip";
type ClassTag = "fusion" | "fusion1" | "cnv" | "mutation";
type Section = "normal" | "skip" | "vus" | "benign" | "negList";
type Scope = { type: "all" } | { type: "kinds"; kinds: Kind[] } | { type: "alt"; alteration: string; specific: boolean };

interface Zone {
  end: number;
  result?: Result;
  resultEnd?: number;
  consumed: Cand[];
  classes: Set<ClassTag>;
  notFinding: boolean;
  forZone?: Zone;
  pct: Map<Cand, number>;
}

interface Mention {
  start: number;
  end: number;
  genes: string[];
  known: boolean;
  symbol: string;
  pseudo?: boolean;
  inFusion?: Cand;
  /** Alterations written before this gene ("T790M (EGFR): not detected"). */
  afterCands?: Cand[];
  zone?: Zone;
  result?: Result;
  negByPrefix?: boolean;
  hedgeByPrefix?: boolean;
  scopeFrom?: Mention;
}

interface Cand {
  type: CandType;
  start: number;
  end: number;
  plural: boolean;
  needsPos: boolean;
  fusionGene?: string;
  fusionName?: string;
  reversed?: boolean;
  one?: string;
  hgvsP?: string;
  owner?: Mention;
  ownerAfter?: boolean;
  unknownGene?: string;
  consumedBy?: Mention;
  consumedByFor?: boolean;
  status?: Status;
  explicit?: boolean;
  negByPrefix?: boolean;
  hedgeByPrefix?: boolean;
  zoneEnd?: number;
  resultEnd?: number;
  pct?: number;
}

interface Positive {
  gene: string;
  alteration: string;
  kind: Kind;
  hgvsP?: string;
  vafPercent?: number;
  vafs: number[];
  order: number;
  mStart: number;
  mEnd: number;
  tStart: number;
  tEnd: number;
  germline: boolean;
}

interface Negative {
  gene: string;
  scopes: Scope[];
  order: number;
}

interface Line {
  start: number;
  text: string;
}

interface LineCand {
  start: number;
  end: number;
  gene?: string;
  status?: Status;
  positive?: Positive;
  pct?: number;
}

interface TableHeader {
  vafIndex: number;
  percentHeader: boolean;
}

interface Ctx {
  orig: string;
  positives: Positive[];
  negatives: Negative[];
  warnings: string[];
  vus: string[];
  benign: string[];
  commentary: { gene: string; alteration: string; text: string }[];
  pdl1: number[];
  anyVaf: boolean;
  strong?: string;
  weak?: string;
  lastPositive?: Positive;
}

// ───────────────────────────── small helpers ─────────────────────────────

function at(re: RegExp, s: string, p: number): RegExpExecArray | null {
  re.lastIndex = p;
  return re.exec(s);
}

/** Replace typographic characters one-for-one so offsets in the normalised text match the original. */
function normaliseChars(t: string): string {
  return t.replace(/[‐-―−  -​ ‘’′∷：％­﻿⩽⩾]/g, (c) => {
    if (/[‐-―−]/.test(c)) return "-";
    if (/[‘’′]/.test(c)) return "'";
    if (c === "∷" || c === "：") return ":";
    if (c === "％") return "%";
    if (c === "⩽") return "≤";
    if (c === "⩾") return "≥";
    return " ";
  });
}

function splitLines(t: string): Line[] {
  const out: Line[] = [];
  let start = 0;
  for (let i = 0; i <= t.length; i++) {
    const ch = t[i];
    if (i === t.length || ch === "\n" || ch === "\r") {
      out.push({ start, text: t.slice(start, i) });
      if (ch === "\r" && t[i + 1] === "\n") i++;
      start = i + 1;
    }
  }
  return out;
}

/** Clauses within a line: split at ";", bullets and sentence ends (not at "p." or decimals). */
function splitSegments(line: Line): Line[] {
  const s = line.text;
  const out: Line[] = [];
  let from = 0;
  const push = (a: number, b: number) => {
    if (b > a && s.slice(a, b).trim()) out.push({ start: line.start + a, text: s.slice(a, b) });
  };
  for (const m of s.matchAll(/;|[•▪◦‣·]|\.(?=\s+[A-Z([])/g)) {
    const i = m.index ?? 0;
    if (m[0] === "." && /\b(?:approx|vs|no|dr|ca|cf|fig|ref|e\.g|i\.e|etc|al|p)$/i.test(s.slice(0, i))) continue;
    push(from, i);
    from = i + m[0].length;
  }
  push(from, s.length);
  return out;
}

function stripBullet(s: string): string {
  return s.replace(/^\s*(?:[-*•▪◦‣·]|\d{1,2}[.)])\s+/, "");
}

function isHeading(stripped: string): boolean {
  const t = stripped.trim();
  if (!t) return false;
  if (/:\s*$/.test(t)) return true;
  if (t.length <= 60 && !/[a-z]/.test(t) && /[A-Z]{4,}/.test(t) && !/\d/.test(t)) return true;
  return SECTION_START_RE.test(t);
}

function cut(s: string, n = 80): string {
  const t = s.trim().replace(/\s+/g, " ");
  return t.length <= n ? t : `${t.slice(0, n - 1).trimEnd()}…`;
}

function expandGenes(text: string): string[] {
  const up = text.toUpperCase();
  if (up.startsWith("NTRK")) {
    const tail = up.slice(4).replace(/^\s?-?\s?/, "");
    const range = /^([123])\s?-\s?([123])$/.exec(tail);
    let digits: number[];
    if (range) {
      digits = [];
      for (let d = Number(range[1]); d <= Number(range[2]); d++) digits.push(d);
    } else {
      digits = Array.from(new Set((tail.match(/[123]/g) ?? []).map(Number)));
    }
    if (digits.length === 0 || digits.length === 3) return ["NTRK"];
    return digits.map((d) => `NTRK${d}`);
  }
  return [normaliseGene(text)];
}

// ───────────────────────────── detection in one clause ─────────────────────────────

function findMentions(s: string, cands: Cand[]): Mention[] {
  const out: Mention[] = [];
  for (const m of s.matchAll(GENE_RE)) {
    const text = m[1];
    if (/^(?:met|ret)$/.test(text)) continue; // lower-case English words, not gene symbols
    const start = m.index ?? 0;
    out.push({ start, end: start + text.length, genes: expandGenes(text), known: true, symbol: text });
  }
  for (const m of s.matchAll(UNKNOWN_GENE_RE)) {
    const sym = m[1];
    const start = m.index ?? 0;
    const end = start + sym.length;
    if (out.some((k) => start < k.end && end > k.start)) continue;
    if (cands.some((c) => start < c.end && end > c.start)) continue;
    if (isKnownGene(sym) || UNKNOWN_STOP.has(sym) || PROTEIN_WHOLE_RE.test(sym)) continue;
    if (!/\d/.test(sym) && (sym.length < 3 || sym.length > 6)) continue;
    out.push({ start, end, genes: [], known: false, symbol: sym });
  }
  out.sort((a, b) => a.start - b.start);
  for (const c of cands) {
    if (c.type !== "fusion") continue;
    for (const m of out) if (m.start >= c.start && m.end <= c.end) m.inFusion = c;
  }
  return out;
}

function validPartner(written: string, sep: string): boolean {
  const up = written.toUpperCase();
  if (KNOWN_PARTNERS.has(up)) return true;
  if (sep === "/") return false;
  if (!/^[A-Z][A-Z0-9]{1,9}$/.test(written)) return false;
  if (FUSION_STOP.has(up) || isKnownGene(up)) return false;
  return /\d/.test(up) || up.length >= 3;
}

/** Fused-word starts ("EGFRex19del", "METex14") are allowed only right after a gene symbol. */
function startsCleanly(s: string, i: number): boolean {
  if (i === 0 || !/[A-Za-z0-9]/.test(s[i - 1])) return true;
  return /(?:EGFR|ERBB2|HER2|MET)$/i.test(s.slice(0, i));
}

function findCandidates(s: string): Cand[] {
  const out: Cand[] = [];
  const free = (a: number, b: number) => out.every((c) => b <= c.start || a >= c.end);
  const add = (c: Cand) => {
    if (free(c.start, c.end)) out.push(c);
  };
  const base = { plural: false, needsPos: false };

  for (const m of s.matchAll(FUSION_RE)) {
    const start = m.index ?? 0;
    if (!validPartner(m[1], m[3])) continue;
    const gene = normaliseGene(m[4]);
    add({ ...base, type: "fusion", start, end: start + m[0].length, fusionGene: gene, fusionName: `${m[1].toUpperCase()}::${gene}` });
  }
  for (const m of s.matchAll(FUSION_REV_RE)) {
    const start = m.index ?? 0;
    if (!KNOWN_PARTNERS.has(m[4].toUpperCase())) continue;
    const gene = normaliseGene(m[1]);
    add({ ...base, type: "fusion", start, end: start + m[0].length, fusionGene: gene, fusionName: `${gene}::${m[4].toUpperCase()}`, reversed: true });
  }
  for (const [re, type] of [[EX19_RE, "ex19"], [EX20_RE, "ex20"], [EX14_RE, "ex14"]] as const) {
    for (const m of s.matchAll(re)) {
      const start = m.index ?? 0;
      if (!startsCleanly(s, start)) continue;
      const word = (m[1] ?? m[2] ?? "").toLowerCase();
      const plural = /s$/.test(word) && word !== "delins" && word !== "ins";
      const needsPos = type === "ex14" && !!m[3];
      add({ type, start, end: start + m[0].length, plural, needsPos: needsPos || plural });
    }
  }
  for (const m of s.matchAll(PROTEIN_RE)) {
    const start = m.index ?? 0;
    const prefix = m[1] ?? "";
    const token = m[2];
    const end = start + m[0].length;
    const threeLetter = AA3_START_RE.test(token);
    const one = threeToOne(token);
    // HGVS kept as given (3-letter or 1-letter), in canonical letter case; bare 1-letter SNVs ("L858R") have none.
    const written = threeLetter ? token.replace(AA3_ANY_RE, (code) => code[0].toUpperCase() + code.slice(1).toLowerCase()) : one;
    let hgvsP: string | undefined;
    if (prefix) hgvsP = prefix.includes("(") && m[0].endsWith(")") ? `p.(${written})` : `p.${written}`;
    else if (threeLetter || /_|del|dup|ins|fs/i.test(token)) hgvsP = `p.${written}`;
    if (hgvsP && hgvsP.length > 40) hgvsP = undefined;
    if (/=$/.test(one)) continue; // synonymous
    add({ ...base, type: "protein", start, end, one, hgvsP });
  }
  for (const m of s.matchAll(AMP_RE)) {
    if (m[1] === "AMP") continue; // AMP/ASCO/CAP guideline, not "amplification"
    const start = m.index ?? 0;
    const plural = /s$/i.test(m[1]);
    add({ type: "amp", start, end: start + m[0].length, plural, needsPos: plural });
  }
  return out.sort((a, b) => a.start - b.start);
}

function classTag(word: string): ClassTag | undefined {
  const w = word.toLowerCase().trim();
  if (/^(?:fusion|rearrangement|rearranged|translocation|translocated)$/.test(w)) return "fusion1";
  if (/^(?:fusions|rearrangements|translocations|break-?apart|split)/.test(w)) return "fusion";
  if (/^(?:copy|cnv|high|low|focal)/.test(w)) return "cnv";
  if (/^(?:point|mutations?$|mutational|variants?$|snvs?$|indels?$|changes?$|substitutions?$|hotspot)/.test(w)) return "mutation";
  return undefined;
}

/**
 * Read what follows a gene or alteration: separators, methods ("(D5F3) IHC"), descriptors ("exon 21", "c.2573T>G"),
 * further alterations, labelled VAFs, then an optional result word. Stops at anything else (comma, "and", new text).
 */
function parseZone(s: string, from: number, limit: number, candAt: Map<number, Cand>, self?: Cand, skip?: { start: number; end: number }): Zone {
  const z: Zone = { end: from, consumed: [], classes: new Set(), notFinding: false, pct: new Map() };
  let p = from;
  let last = self;
  let clean = true;
  for (let guard = 0; p < limit && guard < 200; guard++) {
    if (skip && p >= skip.start && p < skip.end) {
      p = skip.end;
      continue;
    }
    const c = candAt.get(p);
    if (c && c !== self && c.end <= limit) {
      z.consumed.push(c);
      last = c;
      clean = true;
      p = c.end;
      continue;
    }
    // A parenthetical without results or alterations ("(D5F3, Ventana)") is skipped as one unit.
    if (s[p] === "(") {
      const close = s.indexOf(")", p);
      if (close > p && close - p <= 60 && close < limit) {
        const inner = s.slice(p + 1, close);
        let hasCand = false;
        for (const k of candAt.keys()) if (k > p && k < close) hasCand = true;
        if (!hasCand && !RESULT_WORD_RE.test(inner) && !/%|\bVAF\b|\bAF\b/i.test(inner)) {
          p = close + 1;
          continue;
        }
      }
    }
    let m = at(SEP_Y, s, p);
    if (m) {
      p += m[0].length;
      continue;
    }
    const results: [RegExp, Result][] = [[HEDGE_Y, "hedge"], [NEG_Y, "neg"], [MUT_Y, "mutated"], [POS_Y, "pos"], [PLUS_Y, "pos"]];
    let hit: Result | undefined;
    for (const [re, r] of results) {
      m = at(re, s, p);
      if (m) {
        hit = r;
        break;
      }
    }
    if (hit && m) {
      z.result = hit;
      p += m[0].length;
      z.resultEnd = p;
      if (hit === "neg") {
        const f = at(FOR_Y, s, p);
        if (f) {
          z.forZone = parseZone(s, p + f[0].length, limit, candAt);
          z.end = Math.max(p, z.forZone.end);
          return z;
        }
      }
      break;
    }
    m = at(VAF_Y, s, p);
    if (m) {
      p += m[0].length;
      continue;
    }
    m = at(PCT_Y, s, p);
    if (m) {
      const after = s.slice(p + m[0].length, p + m[0].length + 40);
      if (last && clean && !z.pct.has(last) && !NOT_VAF_AFTER_RE.test(after)) z.pct.set(last, Number(m[1]));
      clean = false;
      p += m[0].length;
      continue;
    }
    m = at(NOT_FINDING_Y, s, p);
    if (m) {
      z.notFinding = true;
      break;
    }
    m = at(CONNECTOR_Y, s, p) ?? at(DESCRIPTOR_Y, s, p) ?? at(CLONE_Y, s, p);
    if (m) {
      const tag = classTag(m[0]);
      if (tag) z.classes.add(tag);
      if (tag === "fusion1") z.classes.add("fusion");
      p += m[0].length;
      continue;
    }
    break;
  }
  z.end = Math.max(z.end, p);
  return z;
}

// ───────────────────────────── classification ─────────────────────────────

type Classified = { alteration: string; kind: Kind } | { problem: string };

function classifyProtein(gene: string, one: string): Classified {
  const m = /^([A-Z*])(\d+)(?:_([A-Z])(\d+))?(.*)$/.exec(one);
  if (!m) return { problem: `could not read "${one}"` };
  const first = Number(m[2]);
  const last = m[4] ? Number(m[4]) : first;
  const rest = m[5];
  const len = GENE_LENGTH.get(gene);
  if (len !== undefined && last > len) return { problem: `${gene} ${one}: position ${last} is beyond the ${gene} protein (${len} aa)` };
  const isDel = /^(?:delins|del)/.test(rest);
  const indel = isDel || /^(?:dup|ins)/.test(rest) || /fs/.test(rest);
  if (!indel) return { alteration: one, kind: "SNV" };
  const deleted = isDel ? last - first + 1 : 0;
  const insertedSeq = /^(?:delins|ins)([A-Z]+)/.exec(rest)?.[1] ?? "";
  const inserted = rest.startsWith("dup") ? last - first + 1 : insertedSeq.length;
  const netInsertion = inserted > deleted && !/fs/.test(rest);
  if (gene === "EGFR" && isDel && !netInsertion && first >= 729 && first <= 761) return { alteration: "Exon 19 Deletion", kind: "indel" };
  if (gene === "EGFR" && netInsertion && first >= 762 && first <= 775) return { alteration: "Exon 20 Insertion", kind: "indel" };
  if (gene === "ERBB2" && netInsertion && first >= 770 && first <= 785) return { alteration: "Exon 20 Insertion", kind: "indel" };
  return { alteration: one, kind: "indel" };
}

function classify(c: Cand, gene: string): Classified {
  switch (c.type) {
    case "fusion":
      return { alteration: c.fusionName ?? "Fusion", kind: "fusion" };
    case "ex19":
      return gene === "EGFR" ? { alteration: "Exon 19 Deletion", kind: "indel" } : { problem: `an exon 19 deletion is described for ${gene}, not EGFR` };
    case "ex20":
      return gene === "EGFR" || gene === "ERBB2" ? { alteration: "Exon 20 Insertion", kind: "indel" } : { problem: `an exon 20 insertion is described for ${gene}` };
    case "ex14":
      return gene === "MET" ? { alteration: "Exon 14 Skipping Mutation", kind: "indel" } : { problem: `exon 14 skipping is described for ${gene}, not MET` };
    case "amp":
      return { alteration: "Amplification", kind: "CNV" };
    case "protein":
      return classifyProtein(gene, c.one ?? "");
  }
}

function compatibleWithContext(gene: string, c: Cand): boolean {
  if (c.type === "ex19") return gene === "EGFR";
  if (c.type === "ex20") return gene === "EGFR" || gene === "ERBB2";
  if (c.type === "ex14") return gene === "MET";
  if (c.type === "protein") return HALLMARK.get(gene)?.test(c.one ?? "") ?? false;
  return false;
}

function candScope(c: Cand, gene: string): Scope {
  if (c.type === "fusion") return { type: "kinds", kinds: ["fusion"] };
  const cls = classify(c, gene);
  const alteration = "alteration" in cls ? cls.alteration : c.one ?? "";
  // Only amplification is a gene-level negative ("no MET amplification"); a negative for one change or one exon
  // ("T790M not detected", "exon 19 deletion not detected") does not make the whole gene tested-negative.
  return { type: "alt", alteration, specific: c.type !== "amp" };
}

function mentionScopes(m: Mention): Scope[] {
  let z = m.zone;
  if (!z) return [{ type: "all" }];
  const gene = m.genes[0] ?? "";
  if (z.forZone && (z.forZone.consumed.length || z.forZone.classes.size)) z = z.forZone;
  else if (!z.consumed.length && !z.classes.size && m.afterCands?.length) return m.afterCands.map((c) => candScope(c, gene));
  else if (!z.consumed.length && !z.classes.size && m.scopeFrom?.zone) z = m.scopeFrom.zone;
  if (z.consumed.length) return z.consumed.map((c) => candScope(c, gene));
  if (z.classes.has("fusion")) return [{ type: "kinds", kinds: ["fusion"] }];
  if (z.classes.has("cnv")) return [{ type: "kinds", kinds: ["CNV"] }];
  if (z.classes.has("mutation")) return [{ type: "kinds", kinds: ["SNV", "indel"] }];
  return [{ type: "all" }];
}

function covers(scopes: Scope[], alteration: string, kind: Kind): boolean {
  return scopes.some((sc) => sc.type === "all" || (sc.type === "kinds" && sc.kinds.includes(kind)) || (sc.type === "alt" && sc.alteration === alteration));
}

function scopeText(scopes: Scope[]): string {
  return scopes
    .map((sc) => (sc.type === "all" ? "all alterations" : sc.type === "kinds" ? (sc.kinds.includes("fusion") ? "fusion" : sc.kinds.includes("CNV") ? "amplification" : "mutations") : sc.alteration))
    .join(", ");
}

// ───────────────────────────── one clause ─────────────────────────────

function fragment(ctx: Ctx, a: number, b: number): string {
  return ctx.orig.slice(a, b).trim();
}

function warn(ctx: Ctx, w: string): void {
  if (!ctx.warnings.includes(w)) ctx.warnings.push(w);
}

function collectIgnored(ctx: Ctx, seg: Line, into: string[], strip: RegExp): void {
  const s = seg.text;
  const cands = findCandidates(s);
  const mentions = findMentions(s, cands);
  const items: string[] = [];
  for (const c of cands) {
    const prev = mentions.filter((m) => m.end <= c.start).pop();
    const gene = c.type === "fusion" ? "" : prev ? (prev.known ? prev.genes.join("/") : prev.symbol) : "";
    items.push(cut(`${gene} ${fragment(ctx, seg.start + c.start, seg.start + c.end)}`, 60));
  }
  if (!items.length) {
    const t = fragment(ctx, seg.start, seg.start + s.length).replace(strip, "").replace(/^[\s:,\-|()]+|[\s:,\-|()]+$/g, "");
    if (t && /[A-Za-z]/.test(t) && !/^(?:none|nil|n\/a|not\s+applicable|no\b)/i.test(t)) items.push(cut(t, 60));
  }
  for (const it of items) if (!into.includes(it)) into.push(it);
}

function parsePdl1(ctx: Ctx, s: string, isCommentary: (i: number) => boolean): void {
  const found: { idx: number; cmp?: string; v: number; hi?: number; text: string; assumed: boolean }[] = [];
  for (const m of s.matchAll(TPS_RE)) {
    const idx = m.index ?? 0;
    if (!isCommentary(idx)) found.push({ idx, cmp: m[1], v: Number(m[2]), hi: m[3] !== undefined ? Number(m[3]) : undefined, text: m[0].trim(), assumed: false });
  }
  if (!found.length) {
    for (const m of s.matchAll(TPS_BEFORE_RE)) {
      const idx = m.index ?? 0;
      if (!isCommentary(idx)) found.push({ idx, cmp: m[1], v: Number(m[2]), text: m[0].trim(), assumed: false });
    }
  }
  if (!found.length) {
    for (const m of s.matchAll(PDL1_RE)) {
      const idx = m.index ?? 0;
      if (isCommentary(idx)) continue;
      const after = s.slice(idx + m[0].length);
      const p = PDL1_PCT_RE.exec(after);
      if (p && /\b(?:CPS|IC)\b/i.test(after.slice(0, p[0].length + 10))) {
        warn(ctx, `PD-L1 reported as CPS or immune-cell score ("${cut(s, 60)}"); TPS not recorded.`);
      } else if (p) {
        found.push({ idx, cmp: p[1], v: Number(p[2]), hi: p[3] !== undefined ? Number(p[3]) : undefined, text: cut(`${m[0]}${p[0]}`, 60), assumed: !/\bTPS\b/i.test(s) });
      } else {
        const word = /\b(high|low|negative|positive|weak|strong|intermediate)\b/i.exec(after.slice(0, 40));
        if (word) warn(ctx, `PD-L1 described as "${word[1].toLowerCase()}" without a TPS value; not recorded.`);
      }
    }
  }
  for (const f of found) {
    if (f.v > 100 || (f.hi !== undefined && f.hi > 100)) continue;
    let value: number | undefined = f.v;
    if (f.hi !== undefined) {
      warn(ctx, `PD-L1 TPS given as a range ("${f.text}"); exact value not given, lower bound ${f.v}% recorded.`);
    } else if (f.cmp === "<" || f.cmp === "<=" || f.cmp === "≤") {
      if (f.v <= 1) {
        value = 0;
        if (f.cmp !== "<") warn(ctx, `PD-L1 TPS given as "${f.text}"; recorded as 0%.`);
      } else {
        value = undefined;
        warn(ctx, `PD-L1 TPS given as "${f.text}"; exact value not given, not recorded.`);
      }
    } else if (f.cmp === ">" || f.cmp === ">=" || f.cmp === "≥") {
      warn(ctx, `PD-L1 TPS given as "${f.text}": exact value not given, recorded as ${f.v}%.`);
    }
    if (value === undefined) continue;
    if (f.assumed) warn(ctx, `PD-L1 percentage read as TPS ("${f.text}"); confirm the scoring method.`);
    ctx.pdl1.push(value);
  }
}

function processSegment(ctx: Ctx, seg: Line, section: Section, lineCands: LineCand[], lineMentions: { at: number; genes: string[] }[]): void {
  const s = seg.text;
  const cue = COMMENTARY_RE.exec(s);
  const commentaryFrom = cue ? (RESULT_CUE_RE.test(s.slice(0, cue.index)) ? cue.index : -1) : Infinity;
  const isCommentary = (i: number) => commentaryFrom === -1 || i >= commentaryFrom;

  parsePdl1(ctx, s, isCommentary);
  if (VUS_RE.test(s)) return collectIgnored(ctx, seg, ctx.vus, new RegExp(VUS_RE.source, "gi"));
  if (BENIGN_RE.test(s)) return collectIgnored(ctx, seg, ctx.benign, new RegExp(BENIGN_RE.source, "gi"));

  const germline = /\bgermline\b/i.test(s);
  const cands = findCandidates(s);
  const mentions = findMentions(s, cands);
  if (ctx.strong && !mentions.some((m) => m.known)) {
    const lead = /^[\s\-*•·:|]*/.exec(s)?.[0].length ?? 0;
    mentions.unshift({ start: lead, end: lead, genes: [ctx.strong], known: true, symbol: ctx.strong, pseudo: true });
  }
  const candAt = new Map(cands.map((c) => [c.start, c] as const));

  // 1. Owner gene of each alteration: the gene named before it in this clause, a gene right after it ("L858R in
  //    EGFR"), or, for hallmark changes only, the gene named earlier on the line ("EGFR L858R. T790M detected.").
  for (const c of cands) {
    if (c.type === "fusion") continue;
    const prev = mentions.filter((m) => m.end <= c.start).pop();
    if (prev) {
      if (prev.known) c.owner = prev;
      else c.unknownGene = prev.symbol;
      continue;
    }
    const next = mentions.find((m) => m.start >= c.end);
    if (next?.known && !next.pseudo && OWNER_AFTER_RE.test(s.slice(c.end, next.start))) {
      c.owner = next;
      c.ownerAfter = true;
      (next.afterCands ??= []).push(c);
      continue;
    }
    if (ctx.weak && compatibleWithContext(ctx.weak, c)) {
      c.owner = { start: c.start, end: c.start, genes: [ctx.weak], known: true, symbol: ctx.weak, pseudo: true };
    }
  }

  // 2. Gene-level statements: "ALK negative", "No MET amplification", "Negative for: BRAF, KRAS", "ROS1 positive by FISH".
  let prevKnown: Mention | undefined;
  let prevEnd = 0;
  for (let i = 0; i < mentions.length; i++) {
    const m = mentions[i];
    if (!m.known) {
      prevKnown = undefined;
      prevEnd = m.end;
      continue;
    }
    const nextStart = mentions.slice(i + 1).find((n) => n.start >= m.end)?.start ?? s.length;
    const to = m.inFusion ? m.inFusion.start : m.start;
    const prefix = to >= prevEnd ? s.slice(prevEnd, to) : "";
    const sepOnly = SEP_ONLY_RE.test(prefix);
    const zone = parseZone(s, m.end, nextStart, candAt);
    m.zone = zone;
    const directNeg = NEG_PREFIX_RE.test(prefix);
    const chainNeg = !!prevKnown?.negByPrefix && sepOnly;
    let result = zone.result;
    if (directNeg || ((chainNeg || section === "negList") && result !== "pos")) {
      result = "neg";
      m.negByPrefix = true;
    } else if (HEDGE_PREFIX_RE.test(prefix) || (!!prevKnown?.hedgeByPrefix && sepOnly)) {
      m.hedgeByPrefix = true;
      if (result !== "pos" && result !== "neg") result = "hedge";
    }
    m.result = result;
    prevKnown = m;
    prevEnd = Math.max(m.end, zone.end);
  }
  // "EGFR, ALK and ROS1: negative" — a bare gene in a list takes the result of the gene after it.
  const knownList = mentions.filter((m) => m.known && m.zone);
  for (let i = knownList.length - 2; i >= 0; i--) {
    const m = knownList[i];
    const n = knownList[i + 1];
    if (m.result || !m.zone || m.zone.consumed.some((c) => c.type === "protein")) continue;
    if (!SEP_ONLY_RE.test(s.slice(m.zone.end, n.start))) continue;
    if (n.result === "neg" && !n.negByPrefix) {
      m.result = "neg";
      m.scopeFrom = n.scopeFrom ?? n;
    } else if (n.result === "hedge" && !n.hedgeByPrefix) {
      m.result = "hedge";
    }
  }
  for (const m of knownList) {
    for (const c of m.zone?.consumed ?? []) c.consumedBy = m;
    for (const c of m.zone?.forZone?.consumed ?? []) {
      c.consumedBy = m;
      c.consumedByFor = true;
    }
  }

  // 3. Alteration-level statements.
  let prevCand: Cand | undefined;
  for (const c of cands) {
    if (c.status) {
      prevCand = c;
      continue;
    }
    const by = c.consumedBy;
    if (by) {
      const r = by.result;
      if (c.consumedByFor || r === "neg") {
        c.status = "neg";
        c.negByPrefix = c.consumedByFor || !!by.negByPrefix;
      } else if (r === "hedge") c.status = "hedge";
      else if (by.zone?.notFinding) c.status = "skip";
      else if (r === "pos" || r === "mutated") {
        c.status = "pos";
        c.explicit = true;
      } else c.status = c.needsPos ? "skip" : "pos";
      c.resultEnd = by.zone?.resultEnd;
      c.pct = by.zone?.pct.get(c);
      prevCand = c;
      continue;
    }
    const owner = c.owner;
    if (owner?.result === "neg" && owner.zone) {
      const gene = owner.genes[0] ?? "";
      const cls = classify(c, gene);
      if ("alteration" in cls && covers(mentionScopes(owner), cls.alteration, cls.kind)) {
        c.status = "neg";
        c.negByPrefix = owner.negByPrefix;
        prevCand = c;
        continue;
      }
    }
    if (owner?.result === "hedge") {
      c.status = "hedge";
      prevCand = c;
      continue;
    }
    let boundary = 0;
    for (const m of mentions) {
      const e = m.zone ? Math.max(m.end, m.zone.end) : m.end;
      if (e <= c.start && e > boundary) boundary = e;
    }
    if (prevCand) boundary = Math.max(boundary, Math.min(prevCand.zoneEnd ?? prevCand.end, c.start));
    const prefix = s.slice(boundary, c.start);
    const sepOnly = SEP_ONLY_RE.test(prefix);
    if (NEG_PREFIX_RE.test(prefix) || (prevCand?.status === "neg" && prevCand.negByPrefix && sepOnly)) {
      c.status = "neg";
      c.negByPrefix = true;
    } else if (HEDGE_PREFIX_RE.test(prefix) || (prevCand?.hedgeByPrefix && sepOnly)) {
      c.status = "hedge";
      c.hedgeByPrefix = true;
    } else {
      const skip = c.ownerAfter && owner ? { start: owner.start, end: owner.end } : undefined;
      const limit = mentions.find((m) => m.start >= c.end && m !== (c.ownerAfter ? owner : undefined))?.start ?? s.length;
      const z = parseZone(s, c.end, limit, candAt, c, skip);
      c.zoneEnd = z.end;
      c.resultEnd = z.resultEnd;
      c.pct = z.pct.get(c);
      if (z.notFinding) c.status = "skip";
      else if (z.result === "neg") c.status = "neg";
      else if (z.result === "hedge") c.status = "hedge";
      else if (z.result === "pos" || z.result === "mutated") {
        c.status = "pos";
        c.explicit = true;
      } else c.status = c.needsPos ? "skip" : "pos";
      if (z.forZone) for (const fc of z.forZone.consumed) fc.status = fc.status ?? "neg";
      for (const zc of z.consumed) {
        if (zc.status) continue;
        zc.status = c.status === "pos" && zc.needsPos && !c.explicit ? "skip" : c.status;
        zc.explicit = c.explicit;
        zc.pct = z.pct.get(zc);
        zc.resultEnd = z.resultEnd;
      }
    }
    prevCand = c;
  }
  // "L858R and T790M: not detected" — the first change shares the negative result of the second.
  for (let i = cands.length - 2; i >= 0; i--) {
    const a = cands[i];
    const b = cands[i + 1];
    if (a.status !== "pos" || a.explicit || b.status !== "neg" || b.negByPrefix || a.owner !== b.owner) continue;
    if (/^\s*(?:and|or|\/|&)\s*$/i.test(s.slice(a.zoneEnd ?? a.end, b.start))) a.status = "neg";
  }

  // 4. Emit.
  const abs = (i: number) => seg.start + i;
  for (const m of mentions) if (m.known && !m.pseudo) lineMentions.push({ at: abs(m.start), genes: m.genes });
  for (const c of cands) {
    const owner = c.owner;
    const gene = c.type === "fusion" ? c.fusionGene : owner && owner.genes.length === 1 ? owner.genes[0] : undefined;
    const lc: LineCand = { start: abs(c.start), end: abs(c.end), gene, status: c.status, pct: c.pct };
    lineCands.push(lc);
    const text = fragment(ctx, abs(c.start), abs(c.end));
    if (isCommentary(c.start)) {
      lc.status = "skip";
      if (c.status === "pos" && gene) {
        const cls = classify(c, gene);
        if ("alteration" in cls) ctx.commentary.push({ gene, alteration: cls.alteration, text: cut(fragment(ctx, seg.start, seg.start + s.length), 80).replace(/[.;,\s]+$/, "") });
      }
      continue;
    }
    if (c.status === "neg") {
      if (gene) ctx.negatives.push({ gene, scopes: [candScope(c, gene)], order: abs(c.start) });
      continue;
    }
    if (c.status !== "pos") continue;
    if (c.unknownGene) {
      warn(ctx, `Alteration in a gene the reader does not cover, not extracted: "${cut(`${c.unknownGene} ${text}`, 60)}".`);
      continue;
    }
    if (!gene) {
      if (owner && owner.genes.length > 1) warn(ctx, `Alteration "${text}" follows a gene family (${owner.symbol}); gene not specified, not extracted.`);
      else if (c.type !== "amp") warn(ctx, `Alteration without a gene name, not extracted: "${cut(text, 60)}".`);
      continue;
    }
    const cls = classify(c, gene);
    if ("problem" in cls) {
      warn(ctx, `Not extracted: ${cls.problem}.`);
      continue;
    }
    const realOwner = owner && !owner.pseudo ? owner : undefined;
    const mStart = realOwner && realOwner.start < c.start ? (realOwner.inFusion?.start ?? realOwner.start) : c.start;
    const mEnd = Math.max(c.end, c.resultEnd ?? c.end, c.ownerAfter && realOwner ? realOwner.end : c.end);
    const pos: Positive = {
      gene,
      alteration: cls.alteration,
      kind: cls.kind,
      hgvsP: c.type === "protein" ? c.hgvsP : undefined,
      vafs: [],
      order: abs(c.start),
      mStart: abs(mStart),
      mEnd: abs(mEnd),
      tStart: abs(c.start),
      tEnd: abs(c.end),
      germline,
    };
    if (c.reversed) warn(ctx, `Fusion written gene-first ("${text}"); recorded as ${cls.alteration}. Confirm the 5′ partner.`);
    ctx.positives.push(pos);
    ctx.lastPositive = pos;
    lc.positive = pos;
  }

  for (const m of mentions) {
    if (!m.known || !m.zone || isCommentary(m.start)) continue;
    const label = m.genes.join("/");
    if (m.result === "neg") {
      const scopes = mentionScopes(m);
      for (const g of m.genes) ctx.negatives.push({ gene: g, scopes, order: abs(m.start) });
      continue;
    }
    const z = m.zone;
    const frag = cut(fragment(ctx, abs(m.inFusion?.start ?? m.start), abs(z.resultEnd ?? Math.max(z.end, m.end))), 60);
    if (m.result === "hedge") {
      if (!m.hedgeByPrefix) warn(ctx, `${label}: no positive or negative result given ("${frag}").`);
      continue;
    }
    if (z.notFinding) continue;
    const window = cands.filter((c) => c.owner === m);
    const fusionGene = m.genes.length > 0 && m.genes.every((g) => FUSION_DRIVERS.has(g));
    const barePositive = m.result === undefined && z.classes.has("fusion1") && !m.hedgeByPrefix;
    if (fusionGene && !z.consumed.length && !m.afterCands?.length && (m.result === "pos" || barePositive)) {
      const gene = m.genes.length === 1 ? m.genes[0] : "NTRK";
      if (m.genes.length > 1 || gene === "NTRK") warn(ctx, `NTRK fusion: the NTRK gene (1, 2 or 3) is not specified; recorded as NTRK.`);
      const start = abs(m.inFusion?.start ?? m.start);
      const end = abs(z.resultEnd ?? z.end);
      const pos: Positive = { gene, alteration: "Fusion", kind: "fusion", vafs: [], order: start, mStart: start, mEnd: end, tStart: abs(m.start), tEnd: abs(m.end), germline };
      ctx.positives.push(pos);
      ctx.lastPositive = pos;
    } else if ((m.result === "pos" || m.result === "mutated") && !window.length && !m.inFusion) {
      warn(ctx, `${label} reported as positive or mutated but no specific alteration was found ("${frag}"); enter it by hand if needed.`);
    }
  }

  const lastKnown = mentions.filter((m) => m.known && !m.pseudo && m.genes.length === 1).pop();
  if (lastKnown) ctx.weak = lastKnown.genes[0];
}

// ───────────────────────────── one line ─────────────────────────────

function splitCells(s: string): { text: string; start: number }[] {
  const sep = s.includes("|") ? /\|/g : s.includes("\t") ? /\t+/g : / {2,}/g;
  const cells: { text: string; start: number }[] = [];
  let from = 0;
  for (const m of s.matchAll(sep)) {
    const i = m.index ?? 0;
    cells.push({ text: s.slice(from, i), start: from });
    from = i + m[0].length;
  }
  cells.push({ text: s.slice(from), start: from });
  if (s.includes("|")) {
    if (cells.length && !cells[0].text.trim()) cells.shift();
    if (cells.length && !cells[cells.length - 1].text.trim()) cells.pop();
  }
  return cells;
}

function tableHeader(s: string): TableHeader | undefined {
  const cells = splitCells(s);
  if (cells.length < 3) return undefined;
  const geneIdx = cells.findIndex((c) => /^\s*genes?(?:\s+symbol)?\s*$/i.test(c.text));
  const vafIdx = cells.findIndex((c) => /^\s*(?:%\s*)?(?:VAF|MAF|AF|(?:variant\s+)?allele\s+(?:freq(?:uency)?|fraction))\s*(?:\(\s*%\s*\)|%)?\s*$/i.test(c.text));
  if (geneIdx < 0 || vafIdx < 0) return undefined;
  return { vafIndex: vafIdx, percentHeader: cells[vafIdx].text.includes("%") };
}

function attachVaf(ctx: Ctx, target: Positive | undefined, value: number, vStart: number, vEnd: number): void {
  if (!target || target.kind === "CNV") return;
  target.vafs.push(value);
  if (target.vafPercent === undefined) {
    target.vafPercent = value;
    // Extend the clinician-facing fragment to the VAF when it is on the same line (and close a "(VAF 31%" bracket).
    let end = vEnd;
    if (ctx.orig[end] === ")" && ctx.orig.lastIndexOf("(", vStart) >= target.mStart) end++;
    if (end - target.mStart <= 80 && vStart >= target.mStart && !/[\r\n]/.test(ctx.orig.slice(target.mStart, end))) target.mEnd = Math.max(target.mEnd, end);
  }
}

function processLine(ctx: Ctx, line: Line, section: Section, table: TableHeader | undefined): void {
  const lineCands: LineCand[] = [];
  const lineMentions: { at: number; genes: string[] }[] = [];
  for (const seg of splitSegments(line)) processSegment(ctx, seg, section, lineCands, lineMentions);

  // Labelled VAFs: "VAF 31%", "31% VAF", "allele frequency 1.2%", "(AF 2.1%)" → nearest preceding alteration on the line.
  const s = line.text;
  const vafs: { start: number; end: number; value: number; pct: boolean; label: string; text: string }[] = [];
  for (const m of s.matchAll(VAF_AFTER_RE)) {
    const start = m.index ?? 0;
    vafs.push({ start, end: start + m[0].length, value: Number(m[2]), pct: !!m[3], label: m[1], text: m[0] });
  }
  for (const m of s.matchAll(VAF_BEFORE_RE)) {
    const start = m.index ?? 0;
    const end = start + m[0].length;
    if (vafs.some((v) => start < v.end && end > v.start)) continue;
    vafs.push({ start, end, value: Number(m[1]), pct: true, label: m[2], text: m[0] });
  }
  vafs.sort((a, b) => a.start - b.start);
  for (const v of vafs) {
    const vStart = line.start + v.start;
    const vEnd = line.start + v.end;
    if (!v.pct) {
      if (/^VAF$|allele/i.test(v.label)) warn(ctx, `VAF without a % sign not recorded ("${cut(v.text, 40)}").`);
      continue;
    }
    if (v.value > 100) continue;
    ctx.anyVaf = true;
    if (/^\s*(?:,|and|\/|&)\s*\d{1,3}(?:\.\d+)?\s*%/.test(s.slice(v.end))) {
      warn(ctx, `Several VAFs listed together ("${cut(s.slice(v.start, v.end + 12), 40)}"); not assigned to alterations.`);
      continue;
    }
    let best: LineCand | undefined;
    for (const lc of lineCands) if (lc.start < vStart && (!best || lc.start > best.start)) best = lc;
    if (!best) {
      if (!lineCands.length && !lineMentions.length && ctx.strong && ctx.lastPositive?.vafPercent === undefined) attachVaf(ctx, ctx.lastPositive, v.value, vStart, vEnd);
      continue;
    }
    const b = best;
    if (lineMentions.some((m) => m.at > b.end && m.at < vStart && !m.genes.includes(b.gene ?? ""))) continue;
    if (b.status === "pos") attachVaf(ctx, b.positive, v.value, vStart, vEnd);
  }

  // Tables: a VAF column named in a header row ("Gene | Variant | VAF").
  if (table) {
    const cells = splitCells(s);
    const cell = cells[table.vafIndex];
    const m = cell ? /^\s*(\d{1,3}(?:\.\d+)?)\s*(%)?\s*$/.exec(cell.text) : null;
    if (cell && m && Number(m[1]) <= 100) {
      const value = Number(m[1]);
      const cStart = line.start + cell.start;
      let best: LineCand | undefined;
      for (const lc of lineCands) if (lc.start < cStart && lc.status === "pos" && lc.positive && (!best || lc.start > best.start)) best = lc;
      if (best?.positive && best.positive.vafPercent === undefined) {
        if (m[2] || table.percentHeader || value > 1) {
          attachVaf(ctx, best.positive, value, cStart, line.start + cell.start + cell.text.trimEnd().length);
          ctx.anyVaf = true;
        } else {
          warn(ctx, `VAF "${m[1]}" for ${best.positive.gene} ${best.positive.alteration} may be a fraction, not a percentage; not recorded.`);
        }
      }
    }
  }

  // A percentage written right after the change ("EGFR L858R 2.1%", "(31%)").
  for (const lc of lineCands) {
    const p = lc.positive;
    if (p && p.vafPercent === undefined && lc.pct !== undefined && (p.kind === "SNV" || p.kind === "indel")) {
      attachVaf(ctx, p, lc.pct, lc.end, lc.end);
      ctx.anyVaf = true;
    }
  }
}

// ───────────────────────────── whole report ─────────────────────────────

function detectSample(norm: string): ReportExtraction["sample"] {
  const spec = SPECIMEN_LINE_RE.exec(norm);
  if (spec) {
    const v = spec[1];
    const p = PLASMA_RE.exec(v);
    const t = TISSUE_RE.exec(v) ?? /\bbiops(?:y|ies)\b/i.exec(v.replace(/liquid\s+biops(?:y|ies)/gi, (x) => " ".repeat(x.length)));
    if (p && (!t || p.index <= t.index)) return "plasma";
    if (t) return "tissue";
  }
  const p = PLASMA_RE.exec(norm);
  const t = TISSUE_RE.exec(norm);
  if (p && (!t || p.index <= t.index)) return "plasma";
  if (t) return "tissue";
  return undefined;
}

function qualityWarnings(ctx: Ctx, line: Line, sample: ReportExtraction["sample"]): void {
  const s = line.text;
  const tc = TUMOUR_CONTENT_RE.exec(s);
  if (tc) {
    const value = Number(tc[3]);
    const fractionLabel = /fraction/i.test(tc[1]);
    const threshold = fractionLabel && (sample === "plasma" || /ct\s?dna/i.test(tc[1])) ? 1 : 20;
    if (value < threshold || (tc[2] && tc[2] !== "~" && value <= threshold)) {
      const text = cut(fragment(ctx, line.start + (tc.index ?? 0), line.start + (tc.index ?? 0) + tc[0].length), 50);
      warn(ctx, `Low tumour content ("${text}"): low tumour content can miss alterations, so negative results may be false negatives.`);
      return;
    }
  }
  const q = LOW_QUALITY_RE.exec(s);
  if (q) warn(ctx, `Report notes a sample or quality limitation ("${cut(fragment(ctx, line.start, line.start + s.length), 70)}"); negative results may be false negatives.`);
}

function finalise(ctx: Ctx, sample: ReportExtraction["sample"]): ReportExtraction {
  const warnings = ctx.warnings;

  // Positive statements contradicted elsewhere in the report are not extracted.
  const kept: Positive[] = [];
  for (const p of ctx.positives) {
    const neg = ctx.negatives.find((n) => n.gene === p.gene && covers(n.scopes, p.alteration, p.kind));
    if (neg) {
      warn(ctx, `Conflicting statements for ${p.gene} ${p.alteration} (reported as present and as negative); not extracted, please check the report.`);
      continue;
    }
    kept.push(p);
  }

  // Deduplicate: same gene + alteration once, keeping the entry with VAF / HGVS.
  const groups = new Map<string, Positive[]>();
  for (const p of kept) {
    const key = `${p.gene}|${p.alteration}`;
    const g = groups.get(key);
    if (g) g.push(p);
    else groups.set(key, [p]);
  }
  const namedFusionGenes = new Set(kept.filter((p) => p.kind === "fusion" && p.alteration !== "Fusion").map((p) => p.gene));
  const merged: { p: Positive; order: number }[] = [];
  for (const group of groups.values()) {
    const head = group[0];
    if (head.alteration === "Fusion" && namedFusionGenes.has(head.gene)) continue;
    const score = (p: Positive) => (p.vafPercent !== undefined ? 2 : 0) + (p.hgvsP ? 1 : 0);
    const best = group.reduce((a, b) => (score(b) > score(a) ? b : a));
    const out: Positive = {
      ...best,
      hgvsP: best.hgvsP ?? group.find((p) => p.hgvsP)?.hgvsP,
      vafPercent: best.vafPercent ?? group.find((p) => p.vafPercent !== undefined)?.vafPercent,
      germline: group.some((p) => p.germline),
    };
    const distinct = Array.from(new Set(group.map((p) => p.vafPercent).filter((v): v is number => v !== undefined)));
    if (distinct.length > 1) warn(ctx, `Different VAFs reported for ${out.gene} ${out.alteration} (${distinct.map((v) => `${v}%`).join(", ")}); ${out.vafPercent}% kept. Check which sample or date applies.`);
    merged.push({ p: out, order: head.order });
  }
  merged.sort((a, b) => a.order - b.order);
  const positives = merged.map((x) => x.p);

  // Genes tested negative: gene- or class-level negatives, minus genes with a kept alteration.
  const positiveGenes = new Set(positives.map((p) => p.gene));
  const negOrdered = ctx.negatives.slice().sort((a, b) => a.order - b.order);
  const testedNegative: string[] = [];
  const specificOnly = new Map<string, string[]>();
  for (const n of negOrdered) {
    const general = n.scopes.some((sc) => sc.type !== "alt" || !sc.specific);
    if (!general) {
      const list = specificOnly.get(n.gene) ?? [];
      for (const sc of n.scopes) if (sc.type === "alt" && !list.includes(sc.alteration)) list.push(sc.alteration);
      specificOnly.set(n.gene, list);
      continue;
    }
    if (positiveGenes.has(n.gene)) {
      const keptAlt = positives.filter((p) => p.gene === n.gene).map((p) => p.alteration).join(", ");
      if (!n.scopes.some((sc) => sc.type === "all")) {
        warn(ctx, `${n.gene}: ${keptAlt} kept; the report's negative statement covers only ${scopeText(n.scopes)}, so ${n.gene} is not listed as tested negative.`);
      }
      continue;
    }
    if (!testedNegative.includes(n.gene)) testedNegative.push(n.gene);
  }
  for (const [gene, alts] of specificOnly) {
    if (positiveGenes.has(gene) || testedNegative.includes(gene)) continue;
    warn(ctx, `${gene}: only specific changes were reported as not detected (${alts.join(", ")}); ${gene} is not listed as tested negative.`);
  }

  // Clinical consistency checks.
  const sensitising = positives.filter((p) => p.gene === "EGFR" && EGFR_SENSITISING.has(p.alteration)).map((p) => p.alteration);
  if (sensitising.length >= 2) {
    const n = ["", "", "Two", "Three", "Four"][sensitising.length] ?? String(sensitising.length);
    warn(ctx, `${n} EGFR sensitising mutations found (${sensitising.join(", ")}); please confirm.`);
  }
  const drivers = new Set<string>();
  for (const p of positives) {
    if (p.gene === "EGFR" && p.kind !== "CNV") drivers.add("EGFR");
    else if (p.gene === "KRAS" && /^(?:G12|G13|Q61)/.test(p.alteration)) drivers.add("KRAS");
    else if (FUSION_DRIVERS.has(p.gene) && p.kind === "fusion") drivers.add(p.gene);
    else if (p.gene === "BRAF" && p.alteration === "V600E") drivers.add("BRAF");
    else if (p.gene === "MET" && p.alteration === "Exon 14 Skipping Mutation") drivers.add("MET");
    else if (p.gene === "ERBB2" && p.kind !== "CNV") drivers.add("ERBB2");
  }
  if (drivers.size >= 2) warn(ctx, `Alterations in more than one main driver gene (${Array.from(drivers).join(", ")}); this is uncommon, please confirm against the report.`);
  for (const p of positives) if (p.germline) warn(ctx, `${p.gene} ${p.alteration}: the report mentions germline origin; confirm before use.`);
  if (ctx.anyVaf || sample === "plasma") {
    for (const p of positives) if ((p.kind === "SNV" || p.kind === "indel") && p.vafPercent === undefined) warn(ctx, `VAF not found for ${p.gene} ${p.alteration}.`);
  }
  for (const c of ctx.commentary) {
    if (positives.some((p) => p.gene === c.gene && p.alteration === c.alteration)) continue;
    if (ctx.negatives.some((n) => n.gene === c.gene && covers(n.scopes, c.alteration, "SNV"))) continue;
    warn(ctx, `Possible alteration in interpretive text, not extracted (please check): "${c.text}".`);
  }
  if (ctx.vus.length) warn(ctx, `Variant of uncertain significance ignored: ${ctx.vus.join("; ")}.`);
  if (ctx.benign.length) warn(ctx, `Variant labelled benign ignored: ${ctx.benign.join("; ")}.`);

  let pdl1Tps: number | undefined;
  if (ctx.pdl1.length) {
    pdl1Tps = ctx.pdl1[0];
    const distinct = Array.from(new Set(ctx.pdl1));
    if (distinct.length > 1) warn(ctx, `More than one PD-L1 TPS value found (${distinct.map((v) => `${v}%`).join(", ")}); the first (${pdl1Tps}%) is recorded.`);
  }

  const variants: ExtractedVariant[] = positives.map((p) => {
    let matched = fragment(ctx, p.mStart, p.mEnd);
    if (matched.length > 80) matched = fragment(ctx, p.tStart, p.tEnd);
    if (matched.length > 80) matched = matched.slice(0, 80).trim();
    const v: ExtractedVariant = { gene: p.gene, alteration: p.alteration, kind: p.kind, matched };
    if (p.hgvsP) v.hgvsP = p.hgvsP;
    if (p.vafPercent !== undefined) v.vafPercent = p.vafPercent;
    return v;
  });

  const out: ReportExtraction = { variants, testedNegative: testedNegative.slice(0, 20), warnings };
  if (pdl1Tps !== undefined) out.pdl1Tps = pdl1Tps;
  if (sample) out.sample = sample;
  return out;
}

/**
 * Read pasted molecular-report text into structured alterations for the clinician to confirm.
 * Deterministic; never invents a variant. See the file header for what is and is not recognised.
 */
export function extractReport(text: string): ReportExtraction {
  const orig = typeof text === "string" ? text : "";
  const norm = normaliseChars(orig);
  const ctx: Ctx = { orig, positives: [], negatives: [], warnings: [], vus: [], benign: [], commentary: [], pdl1: [], anyVaf: false };
  const sample = detectSample(norm);
  let section: Section = "normal";
  let sectionLines = 0;
  let table: TableHeader | undefined;

  for (const line of splitLines(norm)) {
    const body = line.text;
    if (!body.trim()) {
      ctx.strong = undefined;
      ctx.weak = undefined;
      table = undefined;
      // A list of negatives ends at a blank line; VUS / methods sections end at a blank line once they have content.
      if (section === "negList" || ((section === "vus" || section === "benign" || section === "skip") && sectionLines > 0)) section = "normal";
      continue;
    }
    const stripped = stripBullet(body);
    const heading = isHeading(stripped);

    const skipHead = SKIP_HEADER_RE.exec(stripped);
    if (skipHead) {
      if (!stripped.slice(skipHead[0].length).replace(/[\s:()]/g, "")) {
        section = "skip";
        sectionLines = 0;
      }
      ctx.strong = undefined;
      table = undefined;
      continue;
    }
    if (section === "skip") {
      if (!heading) {
        sectionLines++;
        continue;
      }
      section = "normal";
    }

    const lineCands = findCandidates(stripped);
    const lineMentions = findMentions(stripped, lineCands).filter((m) => m.known);
    const ignoredHeader = (VUS_RE.test(stripped) || BENIGN_RE.test(stripped)) && !lineCands.length && (/:\s*$/.test(stripped) || !stripped.includes(":"));
    if (ignoredHeader) {
      section = VUS_RE.test(stripped) ? "vus" : "benign";
      sectionLines = 0;
      ctx.strong = undefined;
      table = undefined;
      continue;
    }
    if (section === "vus" || section === "benign") {
      if (heading) section = "normal";
      else {
        const into = section === "vus" ? ctx.vus : ctx.benign;
        const strip = new RegExp((section === "vus" ? VUS_RE : BENIGN_RE).source, "gi");
        for (const seg of splitSegments(line)) collectIgnored(ctx, seg, into, strip);
        sectionLines++;
        continue;
      }
    }
    qualityWarnings(ctx, line, sample);

    if (!lineMentions.length && NEG_HEADER_RE.test(stripped) && /:\s*$/.test(stripped)) {
      section = "negList";
      ctx.strong = undefined;
      continue;
    }
    if (heading && !lineMentions.length) {
      section = "normal";
      ctx.strong = undefined;
      table = undefined;
    }
    const th = tableHeader(body);
    if (th) {
      table = th;
      continue;
    }

    // Header naming one gene ("EGFR mutation analysis (cobas):", "Gene: TP53") — the lines below belong to it.
    if (section !== "negList" && lineMentions.length === 1 && !lineCands.length) {
      const m = lineMentions[0];
      const before = stripped.slice(0, m.start);
      const after = stripped.slice(m.end);
      const zone = parseZone(stripped, m.end, stripped.length, new Map());
      const labelled = /^\s*(?:(?:gene|target|marker|biomarker)(?:\s+symbol)?\s*[:=]?\s*)?$/i.test(before);
      if (labelled && !zone.result && (/:\s*$/.test(stripped) || !after.trim() || /^\s*[:=]?\s*$/.test(after) || /^\s*(?:gene|target)/i.test(before))) {
        if (m.genes.length === 1) {
          ctx.strong = m.genes[0];
          ctx.weak = m.genes[0];
          ctx.lastPositive = undefined;
          continue;
        }
      }
    }
    if (lineMentions.length) ctx.strong = undefined;
    processLine(ctx, line, section, table);
  }
  return finalise(ctx, sample);
}
