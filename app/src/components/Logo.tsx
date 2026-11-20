// DatourX mark: outlined rounded "T" form with the brand mint dot.
export function DatourMark({ size = 28 }: { size?: number }) {
  return (
    <svg viewBox="0 0 132 124" width={size} height={(size * 124) / 132} aria-hidden="true">
      <g stroke="#7d8f86" strokeWidth={6} strokeLinejoin="round">
        <rect x="-8" y="-14" width="112" height="28" rx="12" transform="translate(32 38) rotate(41)" />
        <rect x="-4" y="-14" width="52" height="28" rx="12" transform="translate(66 74) rotate(141)" />
      </g>
      <g fill="#e9f2ed">
        <rect x="-8" y="-14" width="112" height="28" rx="12" transform="translate(32 38) rotate(41)" />
        <rect x="-4" y="-14" width="52" height="28" rx="12" transform="translate(66 74) rotate(141)" />
      </g>
      <circle cx="106" cy="25" r="22" fill="#17ff88" />
    </svg>
  );
}

export function DatourWord() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
      <DatourMark size={16} />
      Datour<span style={{ background: "#17ff88", color: "#041a0d", padding: "0 3px", borderRadius: 2, marginLeft: -6 }}>X</span>
    </span>
  );
}
