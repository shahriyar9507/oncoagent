"use client";

import { useEffect } from "react";
import Link from "next/link";

// Route-level error boundary: the shell stays usable and the clinician can retry. No clinical data is shown here.
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[oncoagent] screen error", error.digest ?? "", error.message);
  }, [error]);
  return (
    <div className="panel status-page" role="alert">
      <p className="eyebrow">Something went wrong</p>
      <h1>This screen could not be shown.</h1>
      <p className="sub">Your saved cases, runs and decisions are not affected. Try again; if it keeps happening, note the reference below for the support team.</p>
      {error.digest && <p className="mono-ref">Reference: {error.digest}</p>}
      <div className="row-actions">
        <button type="button" className="btn primary" onClick={reset}>Try again</button>
        <Link className="btn" href="/">Go to the dashboard</Link>
      </div>
    </div>
  );
}
