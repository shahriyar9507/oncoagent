"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DatourMark, DatourWord } from "./Logo";
import { IconGauge, IconGrid, IconInbox, IconLayers, IconPlug, IconShield, IconUsers, IconGithub } from "./icons";
import { useAudit, useLiveRuns } from "@/lib/hooks";
import { Toaster } from "./DecisionDialog";

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

export function Shell({ children, nav }: { children: ReactNode; nav: NavPatient[] }) {
  const path = usePathname() || "/";
  const crumbs = crumbFor(path, nav);
  const { decisions } = useAudit();
  const runs = useLiveRuns(nav.map((p) => p.id));
  const pending = useMemo(
    () => nav.reduce((n, p) => n + (runs[p.id]?.cards.map((c) => c.id) ?? p.cardIds).filter((id) => !decisions[id]).length, 0),
    [nav, runs, decisions],
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
            <div className="user" aria-label="Signed-in clinician (demo)">
              <span className="who"><b>Dr. Demo</b><span>Medical oncology</span></span>
              <span className="avatar" aria-hidden="true">DD</span>
            </div>
          </div>
        </header>
        <main id="main" className="content">{children}</main>
      </div>
      <Toaster />
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
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((j: Health) => alive && setH(j))
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
          <p className="footer-note" style={{ marginTop: 8 }}>Checked when this page loaded. Agents fall back to dated snapshots, never to empty data.</p>
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
  if (path.startsWith("/patients/")) {
    const id = path.split("/")[2];
    const p = nav.find((x) => x.id === id);
    const out: { label: string; href?: string }[] = [{ label: "Patients", href: "/patients" }, { label: p ? `${p.name} · ${p.id}` : id, href: `/patients/${id}` }];
    if (path.endsWith("/report")) out.push({ label: "Tumour-board report" });
    return out;
  }
  const map: Record<string, string> = { "/queue": "Decision queue", "/mcp": "MCP server", "/evaluation": "Evaluation", "/architecture": "How it works" };
  return [{ label: map[path] ?? path.slice(1) }];
}
