import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell, type NavPatient } from "@/components/Shell";
import { patients } from "@/lib/data/patients";
import { snapshots } from "@/lib/snapshots";
import { assessRecist } from "@/lib/clinical/recist";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

const DESCRIPTION = "An AI assistant team for oncologists: nine agents read every report, propose the next step with its evidence, and the doctor decides. Fictional patients only.";

export const metadata: Metadata = {
  metadataBase: new URL("https://oncoagent.vercel.app"),
  title: { default: "OncoAgent · DatourX", template: "%s" },
  description: DESCRIPTION,
  applicationName: "OncoAgent",
  openGraph: { type: "website", siteName: "OncoAgent", title: "OncoAgent · AI proposes. The doctor decides.", description: DESCRIPTION },
  twitter: { card: "summary_large_image", title: "OncoAgent · AI proposes. The doctor decides.", description: DESCRIPTION },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = { themeColor: "#050807", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Small navigation index computed on the server: names, latest RECIST and the stored card IDs (for the pending count).
  const nav: NavPatient[] = patients.map((p) => {
    const r = assessRecist(p.recist);
    return { id: p.id, name: p.displayName, recist: r[r.length - 1]?.category ?? "—", status: p.status, cardIds: snapshots[p.id].cards.map((c) => c.id) };
  });
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Shell nav={nav}>{children}</Shell>
      </body>
    </html>
  );
}
