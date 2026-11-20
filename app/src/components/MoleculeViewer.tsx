"use client";

import { useEffect, useRef, useState } from "react";
import type { StructureInfo } from "@/lib/data/structures";
import { IconExternal, IconRefresh } from "./icons";

// Mol* (molstar, MIT licence) loaded from jsDelivr on demand; coordinates come from RCSB PDB.
// The scene is described with MolViewSpec: protein as cartoon, the drug and the clinically relevant residues as sticks with labels.
const MOLSTAR = "https://cdn.jsdelivr.net/npm/molstar@4.18.0/build/viewer";

export const ROLE_COLOR: Record<string, string> = { driver: "#17ff88", resistance: "#ff6f61", site: "#ffc65c", ligand: "#e9f2ed" };
const CARTOON = "#2b9c84";

type Canvas3D = { setProps: (p: unknown) => void };
type MolstarViewer = {
  loadPdb: (id: string) => Promise<unknown>;
  loadMvsData?: (data: string, format: "mvsj") => Promise<unknown>;
  plugin: { canvas3d?: Canvas3D; managers?: { camera?: { reset: () => void } } };
  dispose?: () => void;
};
type MolstarGlobal = { Viewer: { create: (el: HTMLElement, opts: Record<string, unknown>) => Promise<MolstarViewer> } };

let loading: Promise<MolstarGlobal> | null = null;
function loadMolstar(): Promise<MolstarGlobal> {
  const w = window as unknown as { molstar?: MolstarGlobal };
  if (w.molstar) return Promise.resolve(w.molstar);
  if (loading) return loading;
  loading = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${MOLSTAR}/molstar.css`;
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = `${MOLSTAR}/molstar.js`;
    s.async = true;
    s.onload = () => (w.molstar ? resolve(w.molstar) : reject(new Error("Mol* did not initialise")));
    s.onerror = () => {
      loading = null;
      reject(new Error("Mol* could not be loaded"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

type Node = { kind: string; params?: Record<string, unknown>; children?: Node[] };
const node = (kind: string, params: Record<string, unknown> = {}, children?: Node[]): Node => (children ? { kind, params, children } : { kind, params });

function sceneFor(s: StructureInfo) {
  const sticks = (selector: Record<string, unknown>, color: string, text: string) =>
    node("component", { selector }, [node("representation", { type: "ball_and_stick" }, [node("color", { color })]), node("label", { text })]);
  const ligandSel = { auth_asym_id: s.ligand.chain, auth_seq_id: s.ligand.seq };
  return {
    metadata: { version: "1", title: s.title, timestamp: "2026-11-20T00:00:00Z" },
    root: node("root", {}, [
      node("canvas", { background_color: "#060a08" }),
      node("download", { url: `https://files.rcsb.org/download/${s.pdbId}.cif` }, [
        node("parse", { format: "mmcif" }, [
          node("structure", { type: "model" }, [
            node("component", { selector: "polymer" }, [node("representation", { type: "cartoon" }, [node("color", { color: CARTOON })])]),
            sticks(ligandSel, ROLE_COLOR.ligand, s.ligand.name),
            ...s.highlights.map((h) => sticks({ auth_asym_id: h.chain, auth_seq_id: h.seq }, ROLE_COLOR[h.role], h.label)),
            // Frame the drug together with the highlighted residues, so the pocket and its context are in view.
            node("component", { selector: [ligandSel, ...s.highlights.map((h) => ({ auth_asym_id: h.chain, auth_seq_id: h.seq }))] }, [node("focus", { radius_extent: 8 })]),
          ]),
        ]),
      ]),
    ]),
  };
}

export function MoleculeViewer({ structure }: { structure: StructureInfo }) {
  const ref = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<MolstarViewer | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [msg, setMsg] = useState("");
  const [spin, setSpin] = useState(true);
  const [mode, setMode] = useState<"annotated" | "plain">("annotated");
  const { pdbId } = structure;

  useEffect(() => {
    let viewer: MolstarViewer | undefined;
    let cancelled = false;
    async function go() {
      if (!ref.current) return;
      setState("loading");
      try {
        const molstar = await loadMolstar();
        if (cancelled || !ref.current) return;
        viewer = await molstar.Viewer.create(ref.current, {
          layoutIsExpanded: false,
          layoutShowControls: false,
          layoutShowRemoteState: false,
          layoutShowSequence: false,
          layoutShowLog: false,
          layoutShowLeftPanel: false,
          viewportShowExpand: false,
          viewportShowControls: false,
          viewportShowSettings: false,
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
          viewportShowTrajectoryControls: false,
          collapseLeftPanel: true,
          pdbProvider: "rcsb",
        });
        viewerRef.current = viewer;
        try {
          viewer.plugin.canvas3d?.setProps({ renderer: { backgroundColor: 0x060a08 }, camera: { helper: { axes: { name: "off", params: {} } } } });
        } catch {
          /* cosmetic only */
        }
        if (viewer.loadMvsData) {
          try {
            await viewer.loadMvsData(JSON.stringify(sceneFor(structure)), "mvsj");
            if (!cancelled) setMode("annotated");
          } catch {
            await viewer.loadPdb(pdbId);
            if (!cancelled) setMode("plain");
          }
        } else {
          await viewer.loadPdb(pdbId);
          if (!cancelled) setMode("plain");
        }
        try {
          viewer.plugin.canvas3d?.setProps({ camera: { helper: { axes: { name: "off", params: {} } } }, trackball: { animate: { name: "spin", params: { speed: 0.25 } } } });
        } catch {
          /* spin is optional */
        }
        if (!cancelled) setState("ready");
      } catch (e) {
        if (!cancelled) {
          setState("error");
          setMsg((e as Error).message);
        }
      }
    }
    go();
    return () => {
      cancelled = true;
      viewerRef.current = null;
      try {
        viewer?.dispose?.();
      } catch {
        /* ignore */
      }
    };
  }, [pdbId, structure]);

  function toggleSpin() {
    const next = !spin;
    setSpin(next);
    try {
      viewerRef.current?.plugin.canvas3d?.setProps({ trackball: { animate: next ? { name: "spin", params: { speed: 0.25 } } : { name: "off", params: {} } } });
    } catch {
      /* ignore */
    }
  }

  function resetView() {
    try {
      viewerRef.current?.plugin.managers?.camera?.reset();
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <div className="mol" aria-label={`3D structure ${pdbId}: ${structure.title}. Drag to rotate, scroll to zoom.`}>
        <div ref={ref} style={{ position: "absolute", inset: 0 }} />
        {state !== "ready" && (
          <div className="mol-fallback">
            {state === "error" ? (
              <span>3D viewer unavailable ({msg}). Open <a href={`https://www.rcsb.org/3d-view/${pdbId}`} target="_blank" rel="noreferrer" style={{ color: "#6dffb6", textDecoration: "underline" }}>PDB {pdbId} on RCSB</a>.</span>
            ) : (
              <span className="pulse">Loading PDB {pdbId} into Mol*…</span>
            )}
          </div>
        )}
        {state === "ready" && (
          <div className="mol-tools">
            <button type="button" className="chip as-btn" onClick={toggleSpin} aria-pressed={spin}>{spin ? "Pause spin" : "Spin"}</button>
            <button type="button" className="chip as-btn" onClick={resetView}><IconRefresh /> Reset</button>
          </div>
        )}
      </div>
      <div className="mol-legend">
        <span className="ml"><i style={{ background: ROLE_COLOR.ligand }} />{structure.ligand.name} <span className="muted mono">{structure.ligand.code}</span></span>
        {structure.highlights.map((h) => (
          <span key={h.label} className="ml" title={h.note}><i style={{ background: ROLE_COLOR[h.role] }} />{h.label} <span className="muted">{h.role === "driver" ? "driver" : h.role === "resistance" ? "resistance" : "gatekeeper"}</span></span>
        ))}
        <a className="ml link" href={`https://www.rcsb.org/structure/${pdbId}`} target="_blank" rel="noreferrer"><IconExternal width={12} height={12} /> RCSB {pdbId}</a>
      </div>
      {mode === "plain" && state === "ready" && <p className="footer-note" style={{ marginTop: 6 }}>Annotated view unavailable in this browser; showing the plain structure.</p>}
      <ul className="hl-notes">
        {structure.highlights.map((h) => (
          <li key={h.label}><i style={{ background: ROLE_COLOR[h.role] }} /><span><b>{h.label}</b>{h.note}</span></li>
        ))}
      </ul>
    </div>
  );
}
