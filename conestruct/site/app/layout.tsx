import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Conestruct — MUTCD plans in seconds",
  description:
    "Describe a work zone. Conestruct computes the taper, buffer, device count and sign placement — then ships a stamped-ready PDF, Excel device list and crew narrative.",
  metadataBase: new URL("https://conestruct.com"),
  openGraph: {
    title: "Conestruct — MUTCD plans in seconds",
    description:
      "MUTCD-compliant traffic control plans in under two minutes. Built in Colorado.",
    url: "https://conestruct.com",
    siteName: "Conestruct",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans bg-beige text-ink antialiased blueprint-grid">
        {children}
      </body>
    </html>
  );
}
