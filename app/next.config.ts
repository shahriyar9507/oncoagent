import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";

// Content Security Policy. Scripts and styles come from this origin only, plus the pinned Mol* build on jsDelivr for
// the 3D structure viewer; structures are fetched from RCSB. Next.js needs inline bootstrap scripts, and the Mol*
// viewer compiles parts of itself at runtime (eval). A CSP binds to the first document loaded, and the app navigates
// client-side, so eval is allowed app-wide rather than per screen. No third-party script origin is allowed except
// the pinned Mol* build.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https://cdn.jsdelivr.net https://www.rcsb.org https://cdn.rcsb.org",
  "font-src 'self' data: https://cdn.jsdelivr.net",
  "connect-src 'self' data: blob: https://files.rcsb.org https://models.rcsb.org https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(dev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const security = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // PGlite is a dev/test-only embedded database; keep it out of server bundles.
  serverExternalPackages: ["@electric-sql/pglite"],
  async redirects() {
    // Saved cases are listed on the Patients screen.
    return [{ source: "/cases", destination: "/patients", permanent: false }];
  },
  async headers() {
    return [
      { source: "/(.*)", headers: security },
      // Signed-in pages and API answers must never be stored by shared caches.
      { source: "/api/(.*)", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;
