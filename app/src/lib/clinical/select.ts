import type { KnowledgeSelection, KnowledgeSelectionInput } from "../types";

// Deterministic choice of the knowledge-pack entry for a clinician-entered case.
// It never proposes treatment itself: it only picks which curated entry (if any) the agents should read,
// and says why in plain words. Unknown or uncovered settings return key: null so no option is guessed.
//
// Rules in brief:
// 1. Find the driver by precedence: EGFR (exon 19 deletion / L858R, then exon 20 insertion), ALK, ROS1, BRAF V600E,
//    MET exon 14 skipping, RET, NTRK, KRAS G12C, ERBB2 mutation. Co-mutations (TP53, STK11, KEAP1, …) are not drivers.
// 2. Prior regimens are read in the order given (oldest first). Radiotherapy and surgery alone are not systemic lines.
//    "Failed" lines are all prior regimens when progression on the current line is recorded; otherwise all but the
//    most recent one (which is treated as the current, still-working line).
// 3. The entry is the one for the next decision after the failed lines; settings the pack does not cover return null.

type DriverKind =
  | "EGFR_COMMON"
  | "EGFR_EX20"
  | "EGFR_RESISTANCE_ONLY"
  | "EGFR_UNCOMMON"
  | "ALK"
  | "ROS1"
  | "BRAF_V600E"
  | "MET_EX14"
  | "RET"
  | "NTRK"
  | "KRAS_G12C"
  | "ERBB2_MUT";

const PRECEDENCE: DriverKind[] = ["EGFR_COMMON", "EGFR_EX20", "ALK", "ROS1", "BRAF_V600E", "MET_EX14", "RET", "NTRK", "KRAS_G12C", "ERBB2_MUT", "EGFR_RESISTANCE_ONLY", "EGFR_UNCOMMON"];

const DRIVER_LABEL: Record<DriverKind, string> = {
  EGFR_COMMON: "EGFR exon 19 deletion / L858R",
  EGFR_EX20: "EGFR exon 20 insertion",
  EGFR_RESISTANCE_ONLY: "EGFR resistance mutation without a sensitising mutation entered",
  EGFR_UNCOMMON: "uncommon EGFR mutation",
  ALK: "ALK fusion",
  ROS1: "ROS1 fusion",
  BRAF_V600E: "BRAF V600E",
  MET_EX14: "MET exon 14 skipping",
  RET: "RET fusion",
  NTRK: "NTRK fusion",
  KRAS_G12C: "KRAS G12C",
  ERBB2_MUT: "ERBB2 (HER2) mutation",
};

const TRIAL_TERM: Record<DriverKind, string> = {
  EGFR_COMMON: "EGFR",
  EGFR_EX20: "EGFR exon 20 insertion",
  EGFR_RESISTANCE_ONLY: "EGFR",
  EGFR_UNCOMMON: "EGFR uncommon mutation",
  ALK: "ALK",
  ROS1: "ROS1",
  BRAF_V600E: "BRAF V600E",
  MET_EX14: "MET exon 14",
  RET: "RET fusion",
  NTRK: "NTRK fusion",
  KRAS_G12C: "KRAS G12C",
  ERBB2_MUT: "HER2 mutation",
};

const NO_DRIVER_TERM = "non-small cell lung cancer PD-L1";

// ---------- variant normalisation ----------

const AA3: Record<string, string> = {
  ala: "a", arg: "r", asn: "n", asp: "d", cys: "c", gln: "q", glu: "e", gly: "g", his: "h", ile: "i",
  leu: "l", lys: "k", met: "m", phe: "f", pro: "p", ser: "s", thr: "t", trp: "w", tyr: "y", val: "v",
};
const AA3_RE = Object.keys(AA3).join("|");

/** Lower-case, strips "p.", and turns three-letter protein notation into one-letter ("Gly12Cys" → "g12c"). */
function normAlteration(alteration: string): string {
  let a = alteration.trim().toLowerCase().replace(/^p\./, "").replace(/\(p\.([^)]*)\)/g, "$1");
  a = a.replace(new RegExp(`(${AA3_RE})(\\d+)(${AA3_RE})`, "g"), (_m, x: string, n: string, y: string) => `${AA3[x]}${n}${AA3[y]}`);
  a = a.replace(new RegExp(`(${AA3_RE})(\\d+)(?=_|del|dup|ins|fs|\\*)`, "g"), (_m, x: string, n: string) => `${AA3[x]}${n}`);
  return a;
}

function normGene(gene: string): string {
  const g = gene.trim().toUpperCase().replace(/^C-?MET$/, "MET");
  if (g === "HER2" || g === "HER-2" || g === "NEU") return "ERBB2";
  return g;
}

type InputVariant = KnowledgeSelectionInput["variants"][number];

interface NormVariant {
  genes: Set<string>;
  gene: string;
  alt: string;
  kind: InputVariant["kind"];
  isFusion: boolean;
  isAmplification: boolean;
  original: string;
}

function normalise(v: InputVariant): NormVariant {
  const gene = normGene(v.gene);
  const alt = normAlteration(v.alteration);
  const isFusion = v.kind === "fusion" || /fusion|::|rearrang|translocation/.test(alt);
  const isAmplification = v.kind === "CNV" || /amplif|\bamp\b|copy number gain/.test(alt);
  const genes = new Set([gene]);
  // Fusion partners named in the alteration, e.g. gene "EML4" with alteration "EML4::ALK", or "CD74-ROS1 fusion".
  if (isFusion) for (const t of v.alteration.toUpperCase().split(/[^A-Z0-9]+/)) if (t) genes.add(normGene(t));
  return { genes, gene, alt, kind: v.kind, isFusion, isAmplification, original: `${v.gene} ${v.alteration}` };
}

const has = (v: NormVariant, ...genes: string[]) => genes.some((g) => v.genes.has(g));
const isNtrk = (v: NormVariant) => Array.from(v.genes).some((g) => /^NTRK[123]?$/.test(g));

function egfrClass(v: NormVariant): DriverKind | null {
  if (v.gene !== "EGFR" || v.isAmplification || v.isFusion) return null;
  const a = v.alt;
  if (/l858r/.test(a)) return "EGFR_COMMON";
  const ex19 = /(exon\s*19|ex\s*19)/.test(a) && /del/.test(a);
  if (ex19 || /\b19\s*del|\bdel\s*19\b|ex19del/.test(a) || /^[a-z]7(4[5-9]|5\d)_[a-z]?\d{3}(del|delins)/.test(a)) return "EGFR_COMMON";
  const ex20 = (/(exon\s*20|ex\s*20)/.test(a) && /ins|dup/.test(a)) || /ex20ins/.test(a) || /^[a-z]7(6[2-9]|7[0-5])(_[a-z]?\d{3})?(ins|dup)/.test(a);
  if (ex20) return "EGFR_EX20";
  if (/t790m|c797|l718|g724|l792|g796/.test(a)) return "EGFR_RESISTANCE_ONLY";
  return "EGFR_UNCOMMON";
}

// ---------- prior-regimen parsing ----------

type DrugClass =
  | "osimertinib" | "egfrEarly" | "egfrUnnamed" | "amivantamab" | "lazertinib" | "egfrEx20"
  | "alk" | "ros1" | "braf" | "met" | "ret" | "trk" | "krasG12c" | "her2Tki" | "tdxd"
  | "io" | "platinum" | "chemo" | "docetaxel";

const CLASS_PATTERNS: [DrugClass, RegExp][] = [
  ["osimertinib", /osimertinib|tagrisso/],
  ["egfrEarly", /gefitinib|iressa|erlotinib|tarceva|afatinib|gilotrif|giotrif|dacomitinib|vizimpro|icotinib/],
  ["egfrUnnamed", /egfr[\s-]*(tki|inhibitor)/],
  ["amivantamab", /amivantamab|rybrevant/],
  ["lazertinib", /lazertinib|lazcluze/],
  ["egfrEx20", /sunvozertinib|zegfrovy|mobocertinib|zipalertinib/],
  ["alk", /alectinib|alecensa|lorlatinib|lorbrena|brigatinib|alunbrig|crizotinib|xalkori|ceritinib|zykadia|ensartinib|ensacove|neladalkib|alk[\s-]*(tki|inhibitor)/],
  ["ros1", /crizotinib|xalkori|entrectinib|rozlytrek|repotrectinib|augtyro|taletrectinib|ibtrozi|zidesamtinib|lorlatinib|ceritinib|ros1[\s-]*(tki|inhibitor)/],
  ["braf", /dabrafenib|tafinlar|trametinib|mekinist|encorafenib|braftovi|binimetinib|mektovi|vemurafenib/],
  ["met", /capmatinib|tabrecta|tepotinib|tepmetko|savolitinib|crizotinib|xalkori|met[\s-]*(tki|inhibitor)/],
  ["ret", /selpercatinib|retevmo|pralsetinib|gavreto|ret[\s-]*(tki|inhibitor)/],
  ["trk", /larotrectinib|vitrakvi|entrectinib|rozlytrek|repotrectinib|augtyro|trk[\s-]*(tki|inhibitor)/],
  ["krasG12c", /sotorasib|lumakras|adagrasib|krazati|divarasib|glecirasib|garsorasib|fulzerasib|olomorasib|g12c[\s-]*inhibitor/],
  ["her2Tki", /zongertinib|hernexeos|sevabertinib|hyrnuo|poziotinib|pyrotinib/],
  ["tdxd", /trastuzumab[\s-]*deruxtecan|t-?dxd|enhertu/],
  ["io", /pembrolizumab|keytruda|nivolumab|opdivo|atezolizumab|tecentriq|durvalumab|imfinzi|cemiplimab|libtayo|ipilimumab|yervoy|tremelimumab|tislelizumab|sintilimab|camrelizumab|toripalimab|serplulimab|immunotherapy|checkpoint|pd-?l?1\b/],
  ["platinum", /carboplatin|cisplatin|platinum/],
  ["docetaxel", /docetaxel|taxotere/],
  ["chemo", /chemo|pemetrexed|paclitaxel|docetaxel|gemcitabine|vinorelbine|etoposide|carboplatin|cisplatin|platinum/],
];

const TARGETED: DrugClass[] = ["osimertinib", "egfrEarly", "egfrUnnamed", "amivantamab", "lazertinib", "egfrEx20", "alk", "ros1", "braf", "met", "ret", "trk", "krasG12c", "her2Tki", "tdxd"];

const LOCAL_ONLY = /radiotherap|radiation|\brt\b|sbrt|\bsrs\b|stereotactic|wbrt|gamma\s*knife|surgery|resection|lobectomy|pneumonectomy|segmentectomy|wedge|thoracotomy|vats|pleurodesis|biopsy/;

interface Line {
  text: string;
  classes: Set<DrugClass>;
}

function parseLines(priorRegimens: string[]): { lines: Line[]; skipped: string[] } {
  const lines: Line[] = [];
  const skipped: string[] = [];
  for (const raw of priorRegimens) {
    const text = raw.trim();
    if (!text) continue;
    const lower = text.toLowerCase();
    const classes = new Set(CLASS_PATTERNS.filter(([, re]) => re.test(lower)).map(([c]) => c));
    if (!classes.size && LOCAL_ONLY.test(lower)) {
      skipped.push(text);
      continue;
    }
    lines.push({ text, classes });
  }
  return { lines, skipped };
}

const anyClass = (lines: Line[], ...cs: DrugClass[]) => lines.some((l) => cs.some((c) => l.classes.has(c)));

// ---------- selection ----------

export function selectKnowledgeKey(input: KnowledgeSelectionInput): KnowledgeSelection {
  const variants = input.variants.map(normalise);
  const { lines, skipped } = parseLines(input.priorRegimens);
  const progressed = input.progressedOnCurrentLine;
  const failed = progressed ? lines : lines.slice(0, -1);
  const current = !progressed && lines.length ? lines[lines.length - 1] : undefined;

  // Drivers present, by kind.
  const found = new Map<DriverKind, string[]>();
  const add = (k: DriverKind, v: NormVariant) => found.set(k, [...(found.get(k) ?? []), v.original]);
  const priorAlk = anyClass(lines, "alk");
  const priorRos1 = anyClass(lines, "ros1");
  const priorRet = anyClass(lines, "ret");
  const notes: string[] = [];
  for (const v of variants) {
    const e = egfrClass(v);
    if (e) add(e, v);
    if (has(v, "ALK") && (v.isFusion || (priorAlk && !v.isAmplification))) add("ALK", v);
    if (has(v, "ROS1") && (v.isFusion || (priorRos1 && !v.isAmplification))) add("ROS1", v);
    if (has(v, "RET") && (v.isFusion || (priorRet && !v.isAmplification))) add("RET", v);
    if (isNtrk(v) && v.isFusion) add("NTRK", v);
    if (v.gene === "BRAF" && /v600e/.test(v.alt)) add("BRAF_V600E", v);
    else if (v.gene === "BRAF" && !v.isAmplification) notes.push(`${v.original} is not V600E; BRAF approvals in NSCLC cover V600E only.`);
    if (v.gene === "MET" && !v.isAmplification && /exon\s*14|ex\s*14|skip|splice|d1010|y1003/.test(v.alt)) add("MET_EX14", v);
    else if (v.gene === "MET" && v.isAmplification) notes.push(`${v.original} is noted but not used as a driver for selection (MET inhibitor approvals are for exon 14 skipping; after an EGFR inhibitor it may be a bypass-resistance mechanism).`);
    if (v.gene === "KRAS" && /g12c/.test(v.alt)) add("KRAS_G12C", v);
    else if (v.gene === "KRAS" && !v.isAmplification) notes.push(`${v.original} has no approved targeted drug in NSCLC; it is handled as driver-negative (consider trials).`);
    if (v.gene === "ERBB2" && !v.isAmplification && !v.isFusion && !/overexpress|ihc|positive/.test(v.alt)) add("ERBB2_MUT", v);
    else if (v.gene === "ERBB2") notes.push(`${v.original} is not a HER2 mutation; HER2 mutation approvals do not apply.`);
  }
  const coMut = variants.filter((v) => ["TP53", "STK11", "KEAP1", "SMARCA4", "CDKN2A", "PIK3CA"].includes(v.gene)).map((v) => v.original);
  if (coMut.length) notes.push(`Co-mutation(s) ${coMut.join(", ")} do not change the pathway.`);

  const priorEgfr = anyClass(lines, "osimertinib", "egfrEarly", "egfrUnnamed", "lazertinib", "amivantamab");
  let drivers = PRECEDENCE.filter((k) => found.has(k));
  // An EGFR resistance alteration after an EGFR inhibitor keeps the case on the EGFR pathway, ahead of other drivers
  // (e.g. an acquired KRAS or MET change at progression).
  if (!found.has("EGFR_COMMON") && found.has("EGFR_RESISTANCE_ONLY") && priorEgfr) drivers = ["EGFR_RESISTANCE_ONLY", ...drivers.filter((d) => d !== "EGFR_RESISTANCE_ONLY")];
  const res = found.get("EGFR_RESISTANCE_ONLY");
  if (res && found.has("EGFR_COMMON")) notes.push(`Resistance alteration(s) reported: ${res.join(", ")}.`);
  const primary = drivers[0];
  const others = drivers.slice(1).filter((d) => !d.startsWith("EGFR_") || !primary?.startsWith("EGFR_"));
  if (primary && others.length) notes.push(`Additional driver(s) also reported (${others.map((d) => DRIVER_LABEL[d]).join(", ")}): discuss at tumour board; the pathway follows ${DRIVER_LABEL[primary]}.`);
  if (progressed && !lines.length) notes.push("Progression is recorded but no prior systemic regimen was entered; treated as first line — check the treatment history.");
  if (skipped.length) notes.push(`Not counted as systemic lines: ${skipped.join("; ")}.`);
  if (current) notes.push(`No progression recorded, so "${current.text}" is treated as the current line; if it has stopped (progression or intolerance), mark the line as ended to see next-line options.`);

  const done = (key: string | null, why: string, trialTerm: string): KnowledgeSelection => ({
    key,
    reason: [why, ...notes].join(" "),
    trialTerm,
  });
  const notCovered = (why: string, term: string) => done(null, `Not covered by the knowledge pack: ${why} Check the current label and NCCN/ESMO guideline; consider a clinical trial.`, term);
  const failedSystemic = failed.length > 0;

  // ---------- driver pathways ----------
  if (primary === "EGFR_COMMON" || (primary === "EGFR_RESISTANCE_ONLY" && priorEgfr)) {
    const term = res?.some((x) => /c797/i.test(x)) ? "EGFR C797S" : variants.some((v) => v.gene === "MET" && v.isAmplification) ? "EGFR MET amplification" : TRIAL_TERM.EGFR_COMMON;
    if (primary === "EGFR_RESISTANCE_ONLY") notes.unshift("Only an EGFR resistance alteration was entered; the earlier sensitising mutation is assumed — confirm it from the first molecular report.");
    if (!anyClass(failed, "osimertinib", "egfrEarly", "egfrUnnamed", "amivantamab", "lazertinib")) {
      if (res && !priorEgfr) notes.push("A resistance alteration is reported but no prior EGFR inhibitor is recorded — check the treatment history.");
      return done("EGFR_COMMON_1L", `${DRIVER_LABEL.EGFR_COMMON}: no EGFR inhibitor has failed${failedSystemic ? " (prior chemotherapy/immunotherapy only)" : ""}, so the EGFR-inhibitor-naive first-line entry applies.`, term);
    }
    if (anyClass(failed, "amivantamab")) return notCovered("progression after an amivantamab-containing regimen in EGFR-mutant NSCLC (later lines include datopotamab deruxtecan after EGFR-directed therapy and platinum).", term);
    if (anyClass(failed, "osimertinib", "lazertinib")) {
      if (anyClass(failed, "platinum")) return notCovered("progression on osimertinib after platinum chemotherapy has already been given; the post-osimertinib entry assumes platinum-naive disease because its options are platinum-based (later lines include datopotamab deruxtecan after EGFR-directed therapy and platinum).", term);
      return done("EGFR_PROGRESSION", `${DRIVER_LABEL.EGFR_COMMON}: progression on a third-generation EGFR inhibitor without prior platinum chemotherapy.`, term);
    }
    if (anyClass(failed, "egfrEarly")) return notCovered("progression on a first- or second-generation EGFR inhibitor; test for T790M (tissue or plasma) — osimertinib is approved for T790M-positive disease (AURA3).", "EGFR T790M");
    return notCovered("the failed EGFR inhibitor is not named; enter the drug name so the line of therapy can be determined.", term);
  }

  if (primary === "EGFR_EX20") {
    if (anyClass(failed, "platinum", "amivantamab", "egfrEx20")) return notCovered("EGFR exon 20 insertion after platinum chemotherapy or amivantamab; amivantamab monotherapy (if not given) and sunvozertinib are approved after platinum.", TRIAL_TERM.EGFR_EX20);
    return done("EGFR_EX20_1L", `${DRIVER_LABEL.EGFR_EX20}: no platinum chemotherapy or amivantamab has failed, so the first-line entry applies.`, TRIAL_TERM.EGFR_EX20);
  }

  if (primary === "EGFR_RESISTANCE_ONLY") {
    return notCovered(`${(res ?? []).join(", ")} is an EGFR resistance alteration, but no sensitising mutation or prior EGFR inhibitor is recorded; check the first molecular report and the treatment history.`, TRIAL_TERM.EGFR_COMMON);
  }
  if (primary === "EGFR_UNCOMMON") {
    return notCovered(`${(found.get(primary) ?? []).join(", ")} is an uncommon EGFR alteration (e.g. G719X, L861Q, S768I, exon 18); afatinib or osimertinib are guideline options, but the pack has no entry.`, TRIAL_TERM.EGFR_UNCOMMON);
  }

  const targeted: [DriverKind, DrugClass, string, string][] = [
    ["ALK", "alk", "ALK_1L_STD", "progression on an ALK inhibitor (next-line options such as lorlatinib or newer ALK inhibitors depend on the prior drug and resistance testing)."],
    ["ROS1", "ros1", "ROS1_1L", "progression on a ROS1 inhibitor (repotrectinib, taletrectinib and newer agents have post-inhibitor indications; resistance testing guides the choice)."],
    ["BRAF_V600E", "braf", "BRAF_V600E_1L", "progression on BRAF/MEK inhibition."],
    ["MET_EX14", "met", "MET_EX14_1L", "progression on a MET inhibitor."],
    ["RET", "ret", "RET_1L", "progression on a selective RET inhibitor."],
    ["NTRK", "trk", "NTRK_1L", "progression on a TRK inhibitor (repotrectinib is approved after prior treatment; resistance testing guides the choice)."],
  ];
  for (const [kind, cls, key, uncovered] of targeted) {
    if (primary !== kind) continue;
    if (anyClass(failed, cls)) return notCovered(`${DRIVER_LABEL[kind]}: ${uncovered}`, TRIAL_TERM[kind]);
    return done(key, `${DRIVER_LABEL[kind]}: no matching targeted inhibitor has failed${failedSystemic ? " (prior chemotherapy/immunotherapy only; targeted therapy is still indicated)" : ""}, so the inhibitor-naive entry applies.`, TRIAL_TERM[kind]);
  }

  if (primary === "KRAS_G12C") {
    if (anyClass(failed, "krasG12c")) return notCovered("KRAS G12C after progression on a G12C inhibitor; switching G12C inhibitors has no established benefit.", TRIAL_TERM.KRAS_G12C);
    if (failedSystemic) return done("KRAS_G12C_POST", `${DRIVER_LABEL.KRAS_G12C}: at least one prior systemic therapy has failed, so the post-therapy entry applies (G12C inhibitors are approved after prior systemic therapy).`, TRIAL_TERM.KRAS_G12C);
    notes.unshift("KRAS G12C inhibitors are approved only after prior systemic therapy (see KRAS_G12C_POST at progression).");
    return noDriver(input, failed, done, notCovered, TRIAL_TERM.KRAS_G12C, DRIVER_LABEL.KRAS_G12C);
  }

  if (primary === "ERBB2_MUT") {
    if (anyClass(failed, "tdxd")) return notCovered("HER2-mutant NSCLC after progression on trastuzumab deruxtecan.", TRIAL_TERM.ERBB2_MUT);
    if (failedSystemic) {
      if (anyClass(failed, "her2Tki")) notes.push("A HER2 tyrosine-kinase inhibitor has already failed; sequencing HER2 inhibitors has no established benefit.");
      return done("ERBB2_MUT_POST", `${DRIVER_LABEL.ERBB2_MUT}: prior systemic therapy has failed, so the post-therapy entry applies (trastuzumab deruxtecan after prior systemic therapy).`, TRIAL_TERM.ERBB2_MUT);
    }
    if (input.histology === "squamous") {
      notes.unshift("HER2 inhibitor first-line approvals are for non-squamous NSCLC; squamous histology follows the driver-negative pathway.");
      return noDriver(input, failed, done, notCovered, TRIAL_TERM.ERBB2_MUT, DRIVER_LABEL.ERBB2_MUT);
    }
    return done("ERBB2_MUT_1L", `${DRIVER_LABEL.ERBB2_MUT}: treatment-naive non-squamous NSCLC; confirm it is a tyrosine-kinase-domain activating mutation for the HER2 inhibitors.`, TRIAL_TERM.ERBB2_MUT);
  }

  const targetedHistory = lines.filter((l) => TARGETED.some((c) => l.classes.has(c)));
  if (targetedHistory.length)
    return notCovered(`targeted therapy is in the history (${targetedHistory.map((l) => l.text).join("; ")}) but no matching driver was entered; enter the driver from the molecular report.`, NO_DRIVER_TERM);
  if (!input.variants.length) notes.unshift("No variants were entered: confirm the full driver panel was tested before choosing immunotherapy.");
  else if (input.variants.every((v) => v.sample === "plasma")) notes.unshift("Driver-negative on plasma only: a negative plasma result should be confirmed on tissue.");
  return noDriver(input, failed, done, notCovered, NO_DRIVER_TERM, "No actionable driver");
}

function noDriver(
  input: KnowledgeSelectionInput,
  failed: Line[],
  done: (key: string | null, why: string, term: string) => KnowledgeSelection,
  notCovered: (why: string, term: string) => KnowledgeSelection,
  term: string,
  label: string,
): KnowledgeSelection {
  const sq = input.histology === "squamous";
  if (!failed.length) {
    const pdl1 = input.pdl1Tps;
    if (pdl1 !== undefined && pdl1 >= 50) return done("NO_DRIVER_PDL1_HIGH", `${label}, first line, PD-L1 TPS ${pdl1}% (≥ 50%).`, term);
    const pdl1Text = pdl1 === undefined ? "PD-L1 not reported (test it: TPS ≥ 50% would allow immunotherapy alone)" : `PD-L1 TPS ${pdl1}% (< 50%)`;
    if (sq) return done("NO_DRIVER_SQ", `${label}, first line, squamous histology, ${pdl1Text}.`, term === NO_DRIVER_TERM ? "squamous non-small cell lung cancer" : term);
    return done("NO_DRIVER_NONSQ", `${label}, first line, non-squamous histology${input.histology === "nsclc-nos" ? " (NSCLC NOS treated as non-squamous)" : ""}, ${pdl1Text}.`, term);
  }
  const secondTerm = term === NO_DRIVER_TERM ? "previously treated" : term;
  if (anyClass(failed, "docetaxel")) return notCovered(`${label} after docetaxel (third line or later).`, secondTerm);
  const io = anyClass(failed, "io");
  const platinum = anyClass(failed, "platinum");
  if (io && platinum) return done("SECOND_LINE_NO_DRIVER", `${label}: platinum chemotherapy and a PD-1/PD-L1 inhibitor have failed.`, secondTerm);
  if (platinum) return done("SECOND_LINE_IO_NAIVE", `${label}: platinum chemotherapy has failed and no PD-1/PD-L1 inhibitor has been given.`, secondTerm);
  if (io) return notCovered(`${label} after first-line immunotherapy without platinum; platinum-based chemotherapy is usual next, but the pack has no separate entry.`, secondTerm);
  return notCovered(`${label}: the failed regimen(s) (${failed.map((l) => l.text).join("; ")}) were not recognised as platinum chemotherapy or immunotherapy.`, secondTerm);
}
