"use client";

import { useState } from "react";
import type { CtdnaPoint } from "@/lib/types";
import type { RecistAssessment } from "@/lib/clinical/recist";
import { PD_THRESHOLD, PR_THRESHOLD } from "@/lib/clinical/recist";

// Hand-built SVG charts: one axis, thin marks, recessive grid, per-point hover and a table twin.
const W = 640;
const H = 250;
const M = { l: 46, r: 24, t: 18, b: 36 };

function niceMax(v: number, step: number) {
  return Math.max(step, Math.ceil((v * 1.15) / step) * step);
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button type="button" className="btn sm" onClick={onToggle} aria-pressed={open}>
      {open ? "Show chart" : "Show table"}
    </button>
  );
}

export function RecistChart({ points }: { points: RecistAssessment[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (!points.length) return <p className="empty">No measurements yet.</p>;
  const maxX = Math.max(1, ...points.map((p) => p.months));
  const maxY = niceMax(Math.max(...points.map((p) => p.sumMm)), 10);
  const x = (m: number) => M.l + (m / maxX) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / maxY) * (H - M.t - M.b);
  const yTicks = Array.from({ length: 5 }, (_, i) => Math.round((maxY / 4) * i));
  const xTicks = Array.from(new Set([0, ...points.map((p) => Math.round(p.months))]));
  const baseline = points[0].sumMm;
  const prLine = baseline * (1 + PR_THRESHOLD / 100);
  const last = points[points.length - 1];
  const pdLine = last.nadirMm * (1 + PD_THRESHOLD / 100);
  const nadirIdx = points.findIndex((p) => p.sumMm === Math.min(...points.map((q) => q.sumMm)));
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.months).toFixed(1)},${y(p.sumMm).toFixed(1)}`).join(" ");
  const area = `${path} L${x(last.months).toFixed(1)},${y(0)} L${x(points[0].months).toFixed(1)},${y(0)} Z`;

  return (
    <div style={{ position: "relative" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="chart-legend">
          <span><span className="swatch" style={{ color: "#17ff88" }} />Sum of target lesions (mm)</span>
          {points.length > 1 && <span><span className="swatch dash" style={{ color: "#3fd7c4" }} />Partial response (−30% from baseline)</span>}
          {points.length > 1 && <span><span className="swatch dash" style={{ color: "#ff6f61" }} />Progression (+20% from nadir)</span>}
        </div>
        <TableToggle open={table} onToggle={() => setTable(!table)} />
      </div>
      {table ? (
        <div className="table-wrap">
          <table className="data stackable">
            <thead><tr><th>Date</th><th>Month</th><th>Sum (mm)</th><th>From baseline</th><th>From nadir</th><th>RECIST</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}>
                  <td className="num" data-label="Date">{p.date}</td><td className="num" data-label="Month">{p.months}</td><td className="num strong" data-label="Sum (mm)">{p.sumMm}</td>
                  <td className="num" data-label="From baseline">{p.changeFromBaselinePct.toFixed(1)}%</td><td className="num" data-label="From nadir">{p.changeFromNadirPct.toFixed(1)}%</td>
                  <td data-label="RECIST">{p.category}{p.newLesions ? " · new lesion" : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Tumour size over time: ${points.map((p) => `${p.sumMm} mm at month ${p.months}`).join(", ")}. Latest category ${last.category}.`}>
          <defs>
            <linearGradient id="rc-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="#17ff88" stopOpacity="0.18" />
              <stop offset="1" stopColor="#17ff88" stopOpacity="0" />
            </linearGradient>
          </defs>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="rgba(140,255,200,0.08)" />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7a8c82">{t}</text>
            </g>
          ))}
          {xTicks.map((t) => (
            <text key={t} x={x(t)} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="#7a8c82">{t}</text>
          ))}
          <text x={W - M.r} y={H - 4} textAnchor="end" fontSize="11" fill="#7a8c82">months from baseline</text>
          {points.length > 1 && (
            <>
              <line x1={M.l} x2={W - M.r} y1={y(prLine)} y2={y(prLine)} stroke="#3fd7c4" strokeDasharray="5 5" strokeWidth="1.5" opacity="0.8" />
              <line x1={x(points[nadirIdx].months)} x2={W - M.r} y1={y(pdLine)} y2={y(pdLine)} stroke="#ff6f61" strokeDasharray="5 5" strokeWidth="1.5" opacity="0.85" />
              <path d={area} fill="url(#rc-area)" />
              <path d={path} fill="none" stroke="#17ff88" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" style={{ filter: "drop-shadow(0 0 6px rgba(23,255,136,0.5))" }} />
            </>
          )}
          {points.map((p, i) => {
            const isLast = i === points.length - 1;
            const color = p.category === "PD" ? "#ff6f61" : "#17ff88";
            return (
              <g key={p.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} role="img" aria-label={`${p.date}: ${p.sumMm} mm, ${p.category}`}>
                <circle cx={x(p.months)} cy={y(p.sumMm)} r="14" fill="transparent" />
                <circle cx={x(p.months)} cy={y(p.sumMm)} r={hover === i ? 6 : 4.5} fill={color} stroke="#050807" strokeWidth="2" />
                {isLast && (
                  <text x={points.length === 1 ? x(p.months) + 10 : x(p.months) - 8} y={y(p.sumMm) - 12} textAnchor={points.length === 1 ? "start" : "end"} fontSize="12" fontWeight="600" fill="#e9f2ed">
                    {p.sumMm} mm · {p.category}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      )}
      {points.length === 1 && <p className="footer-note" style={{ marginTop: 6 }}>Baseline only. Response is calculated from the first restaging scan.</p>}
      {!table && hover !== null && (
        <div className="tooltip" style={{ left: `${(x(points[hover].months) / W) * 100}%`, top: 0, transform: "translate(-50%, -8px)" }}>
          <b>{points[hover].sumMm} mm</b>
          {points[hover].date} · {points[hover].category}
          <br />
          {points[hover].changeFromBaselinePct.toFixed(1)}% from baseline · {points[hover].changeFromNadirPct.toFixed(1)}% from nadir
        </div>
      )}
    </div>
  );
}

export function CtdnaChart({ points }: { points: CtdnaPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (!points.length) return <p className="empty">No ctDNA series for this patient.</p>;
  const maxX = Math.max(1, ...points.map((p) => p.months));
  const maxV = Math.max(...points.map((p) => p.vafPercent ?? 0));
  const step = maxV > 10 ? 10 : maxV > 2 ? 1 : 0.5;
  const maxY = niceMax(maxV, step);
  const x = (m: number) => M.l + (m / maxX) * (W - M.l - M.r);
  const y = (v: number) => H - M.b - (v / maxY) * (H - M.t - M.b);
  const yTicks = Array.from({ length: 5 }, (_, i) => +((maxY / 4) * i).toFixed(2));
  const path = points.map((p, i) => `${i ? "L" : "M"}${x(p.months).toFixed(1)},${y(p.vafPercent ?? 0).toFixed(1)}`).join(" ");
  const marker = points[0].marker;

  return (
    <div style={{ position: "relative" }}>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="chart-legend">
          <span><span className="swatch" style={{ color: "#3fd7c4" }} />{marker} variant allele fraction (%)</span>
          <span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4" fill="none" stroke="#7a8c82" strokeWidth="1.5" /></svg>Not detected</span>
        </div>
        <TableToggle open={table} onToggle={() => setTable(!table)} />
      </div>
      {table ? (
        <div className="table-wrap">
          <table className="data stackable">
            <thead><tr><th>Date</th><th>Month</th><th>Marker</th><th>VAF</th></tr></thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.date}><td className="num" data-label="Date">{p.date}</td><td className="num" data-label="Month">{p.months}</td><td data-label="Marker">{p.marker}</td><td className="num strong" data-label="VAF">{p.vafPercent === null ? "Not detected" : `${p.vafPercent}%`}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${marker} ctDNA over time: ${points.map((p) => `${p.vafPercent ?? "not detected"} at month ${p.months}`).join(", ")}`}>
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={M.l} x2={W - M.r} y1={y(t)} y2={y(t)} stroke="rgba(140,255,200,0.08)" />
              <text x={M.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#7a8c82">{t}</text>
            </g>
          ))}
          {Array.from(new Set([0, ...points.map((p) => Math.round(p.months))])).map((t) => (
            <text key={t} x={x(t)} y={H - M.b + 18} textAnchor="middle" fontSize="11" fill="#7a8c82">{t}</text>
          ))}
          <text x={W - M.r} y={H - 4} textAnchor="end" fontSize="11" fill="#7a8c82">months from baseline</text>
          {points.length > 1 && <path d={path} fill="none" stroke="#3fd7c4" strokeWidth="2.2" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(63,215,196,0.45))" }} />}
          {points.map((p, i) => (
            <g key={p.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0} role="img" aria-label={`${p.date}: ${p.vafPercent === null ? "not detected" : p.vafPercent + "%"}`}>
              <circle cx={x(p.months)} cy={y(p.vafPercent ?? 0)} r="14" fill="transparent" />
              {p.vafPercent === null ? (
                <circle cx={x(p.months)} cy={y(0)} r="4.5" fill="#050807" stroke="#7a8c82" strokeWidth="1.8" />
              ) : (
                <circle cx={x(p.months)} cy={y(p.vafPercent)} r={hover === i ? 6 : 4.5} fill="#3fd7c4" stroke="#050807" strokeWidth="2" />
              )}
              {i === points.length - 1 && p.vafPercent !== null && (
                <text x={x(p.months) - 8} y={y(p.vafPercent) - 12} textAnchor="end" fontSize="12" fontWeight="600" fill="#e9f2ed">{p.vafPercent}%</text>
              )}
            </g>
          ))}
        </svg>
      )}
      {!table && hover !== null && (
        <div className="tooltip" style={{ left: `${(x(points[hover].months) / W) * 100}%`, top: 0, transform: "translate(-50%, -8px)" }}>
          <b>{points[hover].vafPercent === null ? "Not detected" : `${points[hover].vafPercent}%`}</b>
          {points[hover].date} · {points[hover].marker}
        </div>
      )}
    </div>
  );
}
