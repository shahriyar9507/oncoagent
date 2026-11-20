// Domain types for OncoAgent. All patient data in this repository is synthetic.

export type Sex = "F" | "M";

export interface Variant {
  gene: string;
  /** Protein-level alteration or fusion name, e.g. "L858R", "C797S", "G12C", "EML4::ALK". */
  alteration: string;
  kind: "SNV" | "fusion" | "indel" | "CNV";
  hgvsP?: string;
  vafPercent?: number;
  origin: "somatic" | "germline-suspected";
  sample: "tissue" | "plasma";
  reportedOn: string;
  lab: string;
}

export type EventKind =
  | "referral"
  | "imaging"
  | "pathology"
  | "molecular"
  | "treatment"
  | "tumor-board"
  | "lab"
  | "symptom"
  | "decision";

export interface TimelineEvent {
  id: string;
  date: string;
  kind: EventKind;
  title: string;
  detail: string;
  source: string;
}

export interface RecistPoint {
  date: string;
  months: number;
  /** Sum of target-lesion diameters in mm. */
  sumMm: number;
  newLesions: boolean;
  note?: string;
}

export interface CtdnaPoint {
  date: string;
  months: number;
  /** Variant allele fraction in percent; null means not detected. */
  vafPercent: number | null;
  marker: string;
}

export interface TherapyLine {
  line: number;
  regimen: string;
  start: string;
  end?: string;
  bestResponse?: string;
  stopReason?: string;
}

export interface Medication {
  name: string;
  indication: string;
  /** Tags used by the interaction checker, e.g. "qt-prolonging", "strong-cyp3a-inducer". */
  tags: string[];
}

export interface Patient {
  id: string;
  /** Fictional display name. Never sent to the language model. */
  displayName: string;
  age: number;
  sex: Sex;
  smoking: string;
  diagnosis: string;
  histology: string;
  stage: string;
  ecog: number;
  weightKg: number;
  heightCm: number;
  serumCreatinineMgDl: number;
  creatinineDate: string;
  pdl1Tps?: number;
  variants: Variant[];
  medications: Medication[];
  allergies: string[];
  therapyLines: TherapyLine[];
  events: TimelineEvent[];
  recist: RecistPoint[];
  ctdna: CtdnaPoint[];
  /** The event the agents are asked to act on now. */
  question: string;
  /** Short label for the patient list. */
  status: string;
  /** Which biomarker key in the knowledge pack applies now. */
  biomarkerKey: string;
  trialQuery: { condition: string; term: string };
}

export type CardKind = "test" | "treatment" | "trial" | "safety" | "dose" | "monitoring" | "summary";
export type Confidence = "high" | "moderate" | "low";

export interface EvidenceItem {
  id: string;
  kind: "guideline" | "label" | "civic" | "trial" | "calculator" | "patient";
  label: string;
  detail: string;
  url?: string;
}

export interface RecommendationCard {
  id: string;
  patientId: string;
  agent: string;
  kind: CardKind;
  proposal: string;
  why: string[];
  evidenceIds: string[];
  confidence: Confidence;
  confidenceReason: string;
  uncertain: string;
  alternatives: string[];
  changesIf: string;
  safety: string[];
  origin: "rules" | "claude";
  critic: { verdict: "pass" | "flag"; notes: string[] };
}

export interface AgentRunResult {
  patientId: string;
  ranAt: string;
  mode: "rules-only" | "claude";
  model?: string;
  steps: { agent: string; status: "done" | "skipped" | "error"; note: string; ms: number }[];
  evidence: EvidenceItem[];
  cards: RecommendationCard[];
  boardSummary?: string;
  warnings: string[];
  usage?: { inputTokens: number; outputTokens: number };
}

export type DecisionAction = "approve" | "modify" | "reject";

export interface AuditEntry {
  seq: number;
  at: string;
  actor: string;
  action: DecisionAction | "agent-run";
  cardId?: string;
  patientId: string;
  reasonCode?: string;
  reasonText?: string;
  prevHash: string;
  hash: string;
}
