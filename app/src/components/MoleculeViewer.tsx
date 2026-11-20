"use client";

import { useEffect, useRef, useState } from "react";

// Mol* (molstar, MIT licence) loaded from jsDelivr on demand; structures come from RCSB PDB.
const MOLSTAR = "https://cdn.jsdelivr.net/npm/molstar@4.18.0/build/viewer";

type MolstarViewer = { loadPdb: (id: string) => Promise<unknown>; plugin: { canvas3d?: { setProps: (p: unknown) => void } }; dispose?: () => void };
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
    s.onerror = () => reject(new Error("Mol* could not be loaded"));
    document.head.appendChild(s);
  });
  return loading;
}

export function MoleculeViewer({ pdbId, title }: { pdbId: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [msg, setMsg] = useState("");

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
          viewportShowSelectionMode: false,
          viewportShowAnimation: false,
          collapseLeftPanel: true,
          pdbProvider: "rcsb",
        });
        try {
          viewer.plugin.canvas3d?.setProps({ renderer: { backgroundColor: 0x060a08 } });
        } catch {
          /* cosmetic only */
        }
        await viewer.loadPdb(pdbId);
        try {
          viewer.plugin.canvas3d?.setProps({ trackball: { animate: { name: "spin", params: { speed: 0.35 } } } });
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
      try {
        viewer?.dispose?.();
      } catch {
        /* ignore */
      }
    };
  }, [pdbId]);

  return (
    <div className="mol" aria-label={`3D structure ${pdbId}: ${title}`}>
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
    </div>
  );
}
