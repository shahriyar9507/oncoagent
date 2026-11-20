import cache from "./cache/civic.json";

// CIViC (civicdb.org) public GraphQL API. Evidence is CC0-licensed.
const CIVIC_URL = "https://civicdb.org/api/graphql";

export interface CivicEvidence {
  id: number;
  level: string;
  type: string;
  significance: string;
  direction: string;
  rating: number | null;
  disease: string;
  therapies: string[];
  pmid?: string;
  url: string;
}

export interface CivicResult {
  query: string;
  profileName?: string;
  profileId?: number;
  totalEvidence: number;
  lungEvidence: CivicEvidence[];
  source: "live" | "cache" | "none";
  fetchedAt: string;
}

const QUERY = `query($name: String!) {
  molecularProfiles(name: $name, first: 3) {
    nodes {
      id
      name
      evidenceItems(first: 60) {
        totalCount
        nodes {
          id evidenceLevel evidenceType significance evidenceDirection evidenceRating
          disease { name }
          therapies { name }
          source { citationId sourceType }
        }
      }
    }
  }
}`;

interface RawNode {
  id: number;
  name: string;
  evidenceItems: {
    totalCount: number;
    nodes: {
      id: number;
      evidenceLevel: string;
      evidenceType: string;
      significance: string;
      evidenceDirection: string;
      evidenceRating: number | null;
      disease: { name: string } | null;
      therapies: { name: string }[];
      source: { citationId: string; sourceType: string } | null;
    }[];
  };
}

const LEVEL_ORDER: Record<string, number> = { A: 0, B: 1, C: 2, D: 3, E: 4 };

export function profileName(gene: string, alteration: string): string {
  return alteration.includes("::") ? alteration : `${gene} ${alteration}`;
}

export function summariseCivic(query: string, nodes: RawNode[], source: CivicResult["source"]): CivicResult {
  const exact = nodes.find((n) => n.name.toLowerCase() === query.toLowerCase()) ?? nodes[0];
  if (!exact) return { query, totalEvidence: 0, lungEvidence: [], source, fetchedAt: new Date().toISOString() };
  const lung = exact.evidenceItems.nodes
    .filter((e) => (e.disease?.name ?? "").toLowerCase().includes("lung"))
    .map<CivicEvidence>((e) => ({
      id: e.id,
      level: e.evidenceLevel,
      type: e.evidenceType,
      significance: e.significance,
      direction: e.evidenceDirection,
      rating: e.evidenceRating,
      disease: e.disease?.name ?? "",
      therapies: e.therapies.map((t) => t.name),
      pmid: e.source?.sourceType === "PUBMED" ? e.source.citationId : undefined,
      url: `https://civicdb.org/evidence/${e.id}/summary`,
    }))
    .sort((a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9) || (b.rating ?? 0) - (a.rating ?? 0));
  return {
    query,
    profileName: exact.name,
    profileId: exact.id,
    totalEvidence: exact.evidenceItems.totalCount,
    lungEvidence: lung.slice(0, 8),
    source,
    fetchedAt: new Date().toISOString(),
  };
}

export async function fetchCivicRaw(name: string, timeoutMs = 12000): Promise<RawNode[]> {
  const res = await fetch(CIVIC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query: QUERY, variables: { name } }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`CIViC HTTP ${res.status}`);
  const json = (await res.json()) as { data?: { molecularProfiles?: { nodes: RawNode[] } }; errors?: unknown };
  if (!json.data?.molecularProfiles) throw new Error("CIViC returned no data");
  return json.data.molecularProfiles.nodes;
}

/** Evidence for a molecular profile: live first, cached snapshot if the API is unreachable. */
export async function interpretVariant(gene: string, alteration: string): Promise<CivicResult> {
  const name = profileName(gene, alteration);
  try {
    const nodes = await fetchCivicRaw(name);
    return summariseCivic(name, nodes, "live");
  } catch {
    const cached = (cache as Record<string, RawNode[]>)[name];
    if (cached) return summariseCivic(name, cached, "cache");
    return { query: name, totalEvidence: 0, lungEvidence: [], source: "none", fetchedAt: new Date().toISOString() };
  }
}
