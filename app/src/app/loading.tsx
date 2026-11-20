// Shown while a server-rendered screen streams in.
export default function Loading() {
  return (
    <div className="skeleton-page" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="sk sk-title" />
      <div className="sk-row"><div className="sk sk-card" /><div className="sk sk-card" /><div className="sk sk-card" /></div>
      <div className="sk sk-block" />
    </div>
  );
}
