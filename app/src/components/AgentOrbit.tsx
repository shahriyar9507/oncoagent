// Hero illustration: nine agents around the clinician. Pure SVG + CSS animation (disabled with reduced motion).
const AGENTS = ["Sentinel", "Genomics", "Tests", "Guideline", "Interactions", "Trials", "Dose", "Claude", "Critic"];

export function AgentOrbit() {
  const cx = 230;
  const cy = 200;
  const r = 132;
  const nodes = AGENTS.map((name, i) => {
    const a = (i / AGENTS.length) * Math.PI * 2 - Math.PI / 2;
    return { name, x: cx + r * Math.cos(a), y: cy + r * Math.sin(a), lx: cx + (r + 30) * Math.cos(a), ly: cy + (r + 30) * Math.sin(a), cos: Math.cos(a), i };
  });
  return (
    <svg className="orbit" viewBox="0 0 460 400" role="img" aria-label="Nine AI agents around the clinician, who makes every decision">
      <defs>
        <radialGradient id="orb-core" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#17ff88" stopOpacity="0.35" />
          <stop offset="1" stopColor="#17ff88" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx={cx} cy={cy} r={r + 52} fill="none" stroke="rgba(140,255,200,0.06)" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(140,255,200,0.14)" />
      <circle className="orbit-run" cx={cx} cy={cy} r={r} fill="none" stroke="#17ff88" strokeWidth="2" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r={r - 52} fill="none" stroke="rgba(140,255,200,0.07)" strokeDasharray="2 6" />
      {nodes.map((n) => (
        <line key={`l${n.name}`} x1={cx} y1={cy} x2={n.x} y2={n.y} stroke="rgba(140,255,200,0.08)" />
      ))}
      <circle cx={cx} cy={cy} r="92" fill="url(#orb-core)" />
      <circle cx={cx} cy={cy} r="50" fill="#07110c" stroke="#17ff88" strokeWidth="1.5" className="orbit-core" />
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fontWeight="600" fill="#e9f2ed">Doctor</text>
      <text x={cx} y={cy + 13} textAnchor="middle" fontSize="11" fill="#6dffb6">decides</text>
      {nodes.map((n) => (
        <g key={n.name} className="orbit-node" style={{ animationDelay: `${n.i * 0.45}s` }}>
          <circle cx={n.x} cy={n.y} r="15" fill="#0b1712" stroke={n.name === "Critic" ? "#ffc65c" : n.name === "Claude" ? "#17ff88" : "#3fd7c4"} strokeWidth="1.4" />
          <circle cx={n.x} cy={n.y} r="4" fill={n.name === "Critic" ? "#ffc65c" : n.name === "Claude" ? "#17ff88" : "#3fd7c4"} />
          <text x={n.lx} y={n.ly + 4} textAnchor={n.cos > 0.25 ? "start" : n.cos < -0.25 ? "end" : "middle"} fontSize="11.5" fill="#b0c0b7">{n.name}</text>
        </g>
      ))}
    </svg>
  );
}
