import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: "OncoAgent · DatourX",
  description: "An AI assistant team for oncologists: it reads every report, proposes the next step with its evidence, and the doctor decides. Fictional patients only.",
};

export const viewport: Viewport = { themeColor: "#050807", colorScheme: "dark" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
