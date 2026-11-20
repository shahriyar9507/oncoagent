import cache from "./cache/trials.json";

// ClinicalTrials.gov API v2 (public). Only recruiting interventional studies are returned.
const CTGOV = "https://clinicaltrials.gov/api/v2/studies";

export interface TrialSummary {
  nctId: string;
  title: string;
  phases: string[];
  status: string;
  sponsor: string;
  countries: string[];
  startDate?: string;
  url: string;
  matchNotes: string[];
}

export interface TrialSearchResult {
  condition: string;
  term: string;
  total: number;
  trials: TrialSummary[];
  source: "live" | "cache" | "none";
  fetchedAt: string;
}

interface RawStudy {
  protocolSection: {
    identificationModule: { nctId: string; briefTitle: string };
    statusModule?: { overallStatus?: string; startDateStruct?: { date?: string } };
    designModule?: { phases?: string[] };
    sponsorCollaboratorsModule?: { leadSponsor?: { name?: string } };
    contactsLocationsModule?: { locations?: { country?: string }[] };
    conditionsModule?: { conditions?: string[]; keywords?: string[] };
  };
}

const SOUTH_ASIA = ["Bangladesh", "India", "Pakistan", "Sri Lanka", "Nepal"];

export function summariseStudies(condition: string, term: string, studies: RawStudy[], total: number, source: TrialSearchResult["source"]): TrialSearchResult {
  const termWords = term.toLowerCase().split(/\s+/);
  const trials = studies.map<TrialSummary>((s) => {
    const ps = s.protocolSection;
    const countries = Array.from(new Set((ps.contactsLocationsModule?.locations ?? []).map((l) => l.country).filter((c): c is string => !!c)));
    const haystack = [ps.identificationModule.briefTitle, ...(ps.conditionsModule?.conditions ?? []), ...(ps.conditionsModule?.keywords ?? [])].join(" ").toLowerCase();
    const matchNotes: string[] = [];
    if (termWords.every((w) => haystack.includes(w))) matchNotes.push(`Mentions ${term} in title or keywords`);
    const near = countries.filter((c) => SOUTH_ASIA.includes(c));
    if (near.length) matchNotes.push(`Sites in ${near.join(", ")}`);
    return {
      nctId: ps.identificationModule.nctId,
      title: ps.identificationModule.briefTitle,
      phases: ps.designModule?.phases ?? [],
      status: ps.statusModule?.overallStatus ?? "UNKNOWN",
      sponsor: ps.sponsorCollaboratorsModule?.leadSponsor?.name ?? "",
      countries,
      startDate: ps.statusModule?.startDateStruct?.date,
      url: `https://clinicaltrials.gov/study/${ps.identificationModule.nctId}`,
      matchNotes,
    };
  });
  return { condition, term, total, trials, source, fetchedAt: new Date().toISOString() };
}

export async function fetchTrialsRaw(condition: string, term: string, pageSize = 6, timeoutMs = 12000): Promise<{ studies: RawStudy[]; total: number }> {
  const params = new URLSearchParams({
    "query.cond": condition,
    "query.term": term,
    "filter.overallStatus": "RECRUITING",
    pageSize: String(pageSize),
    countTotal: "true",
    sort: "LastUpdatePostDate:desc",
    fields: "NCTId,BriefTitle,OverallStatus,StartDate,Phase,LeadSponsorName,LocationCountry,Condition,Keyword",
  });
  const res = await fetch(`${CTGOV}?${params}`, { signal: AbortSignal.timeout(timeoutMs), headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`ClinicalTrials.gov HTTP ${res.status}`);
  const json = (await res.json()) as { studies?: RawStudy[]; totalCount?: number };
  return { studies: json.studies ?? [], total: json.totalCount ?? json.studies?.length ?? 0 };
}

export async function searchTrials(condition: string, term: string, pageSize = 6): Promise<TrialSearchResult> {
  try {
    const { studies, total } = await fetchTrialsRaw(condition, term, pageSize);
    return summariseStudies(condition, term, studies, total, "live");
  } catch {
    const key = `${condition}|${term}`;
    const cached = (cache as Record<string, { studies: RawStudy[]; total: number }>)[key];
    if (cached) return summariseStudies(condition, term, cached.studies.slice(0, pageSize), cached.total, "cache");
    return { condition, term, total: 0, trials: [], source: "none", fetchedAt: new Date().toISOString() };
  }
}

export const NCT_PATTERN = /^NCT\d{8}$/;
