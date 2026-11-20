"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { DatourMark, DatourWord } from "./Logo";
import { IconGauge, IconGrid, IconInbox, IconLayers, IconPlug, IconShield, IconUsers, IconGithub } from "./icons";
import { patients } from "@/lib/data/patients";

const NAV = [
  { group: "Workspace", items: [
    { href: "/", label: "Overview", icon: IconGrid },
    { href: "/patients/P-001", label: "Patients", icon: IconUsers, match: "/patients" },
    { href: "/queue", label: "Decision queue", icon: IconInbox },
  ] },
  { group: "Platform", items: [
    { href: "/mcp", label: "MCP server", icon: IconPlug },
    { href: "/evaluation", label: "Evaluation", icon: IconGauge },
    { href: "/architecture", label: "How it works", icon: IconLayers },
  ] },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname() || "/";
  const crumbs = crumbFor(path);
  return (
    <div className="shell">
      <a href="#main" className="skip">Skip to content</a>
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand" aria-label="OncoAgent home">
          <span className="product" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <DatourMark size={26} />
            <span>Onco<b>Agent</b></span>
          </span>
          <span className="by">by <DatourWord /></span>
        </Link>
        {NAV.map((g) => (
          <nav className="nav-group" key={g.group} aria-label={g.group}>
            <span className="nav-label">{g.group}</span>
            {g.items.map((it) => {
              const active = it.href === "/" ? path === "/" : path.startsWith(it.match ?? it.href);
              const Icon = it.icon;
              return (
                <Link key={it.href} href={it.href} className={`nav-item${active ? " active" : ""}`} aria-current={active ? "page" : undefined}>
                  <Icon />
                  {it.label}
                  {it.href === "/patients/P-001" && <span className="count">{patients.length}</span>}
                </Link>
              );
            })}
          </nav>
        ))}
        <div className="sidebar-foot">
          <div className="notice">
            <b>Fictional patients only</b>
            Every case here is synthetic. Not medical advice.
          </div>
          <div className="notice">
            <b style={{ display: "flex", alignItems: "center", gap: 6 }}><IconShield width={14} height={14} /> AI proposes</b>
            A clinician approves, modifies or rejects every card.
          </div>
          <a className="nav-item" href="https://github.com/shahriyar9507/oncoagent" target="_blank" rel="noreferrer"><IconGithub /> Source code</a>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link href="/">OncoAgent</Link>
            {crumbs.map((c) => (
              <span key={c} style={{ display: "contents" }}>
                <span className="sep">/</span>
                <span className="here">{c}</span>
              </span>
            ))}
          </nav>
          <div className="top-right">
            <span className="chip mint"><span className="dot" /> Agents online</span>
            <div className="user" aria-label="Signed-in clinician (demo)">
              <span className="who"><b>Dr. Demo</b><span>Medical oncology</span></span>
              <span className="avatar" aria-hidden="true">DD</span>
            </div>
          </div>
        </header>
        <main id="main" className="content">{children}</main>
      </div>
    </div>
  );
}

function crumbFor(path: string): string[] {
  if (path === "/") return ["Overview"];
  if (path.startsWith("/patients/")) {
    const id = path.split("/")[2];
    const p = patients.find((x) => x.id === id);
    return ["Patients", p ? `${p.displayName} · ${p.id}` : id];
  }
  const map: Record<string, string> = { "/queue": "Decision queue", "/mcp": "MCP server", "/evaluation": "Evaluation", "/architecture": "How it works" };
  return [map[path] ?? path.slice(1)];
}
