import Link from "next/link";

export const metadata = { title: "Not found · OncoAgent" };

export default function NotFound() {
  return (
    <div className="panel status-page">
      <p className="eyebrow">Error 404</p>
      <h1>This page does not exist.</h1>
      <p className="sub">The link may be old, or the patient or case may have been removed. Nothing was changed.</p>
      <div className="row-actions">
        <Link className="btn primary" href="/">Go to the dashboard</Link>
        <Link className="btn" href="/patients">Open the patient list</Link>
      </div>
    </div>
  );
}
