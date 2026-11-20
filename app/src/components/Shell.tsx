"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DatourMark, DatourWord } from "./Logo";
import { IconGauge, IconGrid, IconInbox, IconLayers, IconPlug, IconShield, IconUsers, IconGithub, IconEdit } from "./icons";
import { useAudit, useLiveRuns } from "@/lib/hooks";
import { useCases } from "@/lib/cases";
import { Toaster } from "./DecisionDialog";
import { dataMode, setDataMode, useSessionUser, type DataMode } from "@/lib/remote";

export interface NavPatient {
  id: string;
  name: string;
  recist: string;
  status: string;
  cardIds: string[];
}

const PLATFORM = [
  { href: "/mcp", label: "MCP server", icon: IconPlug },
  { href: "/evaluation", label: "Evaluation", icon: IconGauge },
  { href: "/architecture", label: "How it works", icon: IconLayers },
];

export function Shell({ children, nav, storeMode }: { children: ReactNode; nav: NavPatient[]; storeMode: DataMode }) {
  // The storage mode is fixed per deployment; set it before any child hook reads it.
  setDataMode(storeMode);
  const path = usePathname() || "/";
  if (path === "/login") {
    return (
      <>
        {children}
        <Toaster />
      </>
    );
  }
  return <Workspace nav={nav} path={path}>{children}</Workspace>;
}

function Workspace({ children, nav, path }: { children: ReactNode; nav: NavPatient[]; path: string }) {
  const crumbs = crumbFor(path, nav);
  const { decisions } = useAudit();
  const cases = useCases();
  const runs = useLiveRuns([...nav.map((p) => p.id), ...cases.map((c) => c.id)]);
  const pending = useMemo(
    () =>
      nav.reduce((n, p) => n + (runs[p.id]?.cards.map((c) => c.id) ?? p.cardIds).filter((id) => !decisions[id]).length, 0) +
      cases.reduce((n, c) => n + (runs[c.id]?.cards ?? []).filter((card) => !decisions[card.id]).length, 0),
    [nav, cases, runs, decisions],
  );
  const isReport = path.endsWith("/report");

  return (
    <div className={`shell${isReport ? " shell-report" : ""}`}>
      <a href="#main" className="skip">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="OncoAgent home">
          <span className="product">
            <DatourMark size={24} />
            <span>Onco<b>Agent</b></span>
          </span>
          <span className="by">by <DatourWord /></span>
        </Link>

        <nav className="nav-group" aria-label="Workspace">
          <span className="nav-label">Workspace</span>
          <NavItem href="/" label="Overview" icon={<IconGrid />} active={path === "/"} />
          <NavItem href="/queue" label="Decision queue" icon={<IconInbox />} active={path.startsWith("/queue")} count={pending} />
          <NavItem href="/patients" label="Patients" icon={<IconUsers />} active={path === "/patients"} />
          <div className="nav-patients" aria-label="Patients">
            {nav.map((p) => {
              const active = path.startsWith(`/patients/${p.id}`);
              const tone = p.recist === "PD" ? "red" : p.recist === "PR" || p.recist === "CR" ? "" : "teal";
              return (
                <Link key={p.id} href={`/patients/${p.id}`} className={`nav-pt${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={`${p.name} · ${p.status}`}>
                  <span className={`dot ${tone}`} />
                  <span className="nm">{p.name}</span>
                  <span className="id">{p.id.replace("P-", "")}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <nav className="nav-group" aria-label="Your cases">
          <span className="nav-label">Your cases</span>
          <NavItem href="/cases/new" label="New case" icon={<IconEdit />} active={path === "/cases/new"} />
          {cases.length > 0 && (
            <div className="nav-patients nav-cases">
              {cases.slice(0, 3).map((c) => {
                const active = path.startsWith(`/cases/${c.id}`);
                return (
                  <Link key={c.id} href={`/cases/${c.id}`} className={`nav-pt${active ? " active" : ""}`} aria-current={active ? "page" : undefined} title={c.input.label || c.id}>
                    <span className={`dot ${runs[c.id] ? "" : "off"}`} />
                    <span className="nm">{c.input.label || `${c.input.age} ${c.input.sex} · ${c.input.variants[0] ? `${c.input.variants[0].gene} ${c.input.variants[0].alteration}` : "no driver"}`}</span>
                    <span className="id">{c.id.slice(2, 5)}</span>
                  </Link>
                );
              })}
              {cases.length > 3 && <Link href="/patients" className="nav-pt"><span className="nm muted">All {cases.length} cases</span></Link>}
            </div>
          )}
        </nav>

        <nav className="nav-group" aria-label="Platform">
          <span className="nav-label">Platform</span>
          {PLATFORM.map((it) => {
            const Icon = it.icon;
            return <NavItem key={it.href} href={it.href} label={it.label} icon={<Icon />} active={path.startsWith(it.href)} />;
          })}
        </nav>

        <div className="sidebar-foot">
          <div className="notice">
            <b><IconShield width={13} height={13} /> AI proposes, you decide</b>
            Fictional patients only. Not medical advice.
          </div>
          <a className="nav-item" href="https://github.com/shahriyar9507/oncoagent" target="_blank" rel="noreferrer"><IconGithub /> Source code</a>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">OncoAgent</Link>
            {crumbs.map((c, i) => (
              <span key={c.label} style={{ display: "contents" }}>
                <span className="sep">/</span>
                {c.href && i < crumbs.length - 1 ? <Link href={c.href}>{c.label}</Link> : <span className="here">{c.label}</span>}
              </span>
            ))}
          </nav>
          <div className="top-right">
            <HealthChip />
            <UserMenu />
          </div>
        </header>
        <main id="main" className="content">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}

function UserMenu() {
  const me = useSessionUser();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const initials = (me?.name ?? "··").replace(/^Dr\.?\s*/i, "").split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  async function signOut() {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- full load drops all cached data
      window.location.assign("/login");
    }
  }
  return (
    <div className="health" ref={ref}>
      <button type="button" className="user" onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="menu" aria-label={me ? `Signed in as ${me.name}` : "Account"}>
        <span className="who"><b>{me?.name ?? "Signing in…"}</b><span>{me ? (me.role === "clinician" ? "Medical oncology" : me.role) : " "}</span></span>
        <span className="avatar" aria-hidden="true">{initials || "··"}</span>
      </button>
      {open && (
        <div className="popover" role="menu" aria-label="Account">
          <p className="eyebrow">Signed in</p>
          <div className="hrow"><span className="dot" /><span><b>{me?.name}</b><span>{me?.username} · {me?.role}</span></span></div>
          <div className="hrow"><span className={`dot${dataMode() === "server" ? "" : " teal"}`} /><span><b>Data storage</b><span>{dataMode() === "server" ? "Server database (per account)" : "This browser only (no database connected)"}</span></span></div>
          <button type="button" className="btn sm danger" role="menuitem" onClick={signOut} disabled={busy}>{busy ? "Signing out…" : "Sign out"}</button>
        </div>
      )}
    </div>
  );
}

function NavItem({ href, label, icon, active, count }: { href: string; label: string; icon: ReactNode; active: boolean; count?: number }) {
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
      {icon}
      {label}
      {count !== undefined && count > 0 && <span className="count" aria-label={`${count} awaiting decision`}>{count}</span>}
    </Link>
  );
}

interface Health {
  status?: "ok" | "degraded";
  version?: string;
  storage?: { mode: "server" | "browser"; ok: boolean; driver?: string; ms?: number };
  claude: { configured: boolean; model: string };
  civic: { live: boolean; ms: number };
  trials: { live: boolean; ms: number };
  checkedAt: string;
}

function HealthChip() {
  const [h, setH] = useState<Health | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/health", { cache: "no-store" })
      // 503 still carries the status body (for example storage down), so read it either way.
      .then((r) => r.json())
      .then((j: Health) => alive && (j?.claude ? setH(j) : setFailed(true)))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  let tone = "ghost";
  let label = "Checking agents";
  if (failed) {
    tone = "amber";
    label = "Status unknown";
  } else if (h) {
    const all = h.claude.configured && h.civic.live && h.trials.live;
    tone = all ? "mint" : "amber";
    label = all ? "Agents online" : !h.claude.configured ? "Rules-only mode" : "Snapshot mode";
  }

  return (
    <div className="health" ref={ref}>
      <button type="button" className={`chip ${tone}`} onClick={() => setOpen(!open)} aria-expanded={open} aria-haspopup="dialog">
        <span className={`dot${tone === "amber" ? " amber" : tone === "ghost" ? " off pulse" : ""}`} /> {label}
      </button>
      {open && (
        <div className="popover" role="dialog" aria-label="Agent status">
          <p className="eyebrow">Live status</p>
          <Row ok={!!h?.claude.configured} name="Claude synthesis" detail={h ? (h.claude.configured ? h.claude.model : "not configured: rules only") : "checking"} />
          <Row ok={!!h?.civic.live} name="CIViC evidence" detail={h ? (h.civic.live ? `live · ${h.civic.ms} ms` : "down: stored snapshot used") : "checking"} />
          <Row ok={!!h?.trials.live} name="ClinicalTrials.gov" detail={h ? (h.trials.live ? `live · ${h.trials.ms} ms` : "down: stored snapshot used") : "checking"} />
          <Row ok name="Rules and calculators" detail="deterministic · always on" />
          <Row ok={!h?.storage || h.storage.ok} name="Data storage" detail={!h?.storage ? "checking" : h.storage.mode === "browser" ? "this browser only · no database connected" : h.storage.ok ? `server database · ${h.storage.driver}${h.storage.ms !== undefined ? ` · ${h.storage.ms} ms` : ""}` : "database unreachable"} />
          <p className="footer-note" style={{ marginTop: 8 }}>Checked when this page loaded{h?.version ? ` · v${h.version}` : ""}. Agents fall back to dated snapshots, never to empty data.</p>
        </div>
      )}
    </div>
  );
}

function Row({ ok, name, detail }: { ok: boolean; name: string; detail: string }) {
  return (
    <div className="hrow">
      <span className={`dot${ok ? "" : " amber"}`} />
      <span><b>{name}</b><span>{detail}</span></span>
    </div>
  );
}

function crumbFor(path: string, nav: NavPatient[]): { label: string; href?: string }[] {
  if (path === "/") return [{ label: "Overview" }];
  if (path === "/patients") return [{ label: "Patients" }];
  if (path === "/cases/new") return [{ label: "Patients", href: "/patients" }, { label: "New case" }];
  if (path.startsWith("/cases/")) {
    const id = path.split("/")[2];
    const out: { label: string; href?: string }[] = [{ label: "Patients", href: "/patients" }, { label: `Case ${id}`, href: `/cases/${id}` }];
    if (path.endsWith("/report")) out.push({ label: "Tumour-board report" });
    return out;
  }
  if (path.startsWith("/patients/")) {
    const id = path.split("/")[2];
    const p = nav.find((x) => x.id === id);
    const out: { label: string; href?: string }[] = [{ label: "Patients", href: "/patients" }, { label: p ? `${p.name} · ${p.id}` : id, href: `/patients/${id}` }];
    if (path.endsWith("/report")) out.push({ label: "Tumour-board report" });
    return out;
  }
  const map: Record<string, string> = { "/queue": "Decision queue", "/mcp": "MCP server", "/evaluation": "Evaluation", "/architecture": "How it works" };
  // Unknown paths render the 404 page, whose HTML is prerendered once; a fixed label keeps hydration consistent.
  return [{ label: map[path] ?? "Page not found" }];
}
