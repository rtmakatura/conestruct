import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { PUBLIC_LINE, PUBLIC_TITLE } from "@/lib/public-copy";
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

// coming-soon-gate D3 / C-S2: "stamped-ready PDF" (contradicted the draft
// notice), "in under two minutes" and "MUTCD plans in seconds"
// (unmeasured) are gone; the public page's one line is the description.
export const metadata: Metadata = {
  title: PUBLIC_TITLE,
  description: PUBLIC_LINE,
  metadataBase: new URL("https://conestruct.com"),
  openGraph: {
    title: PUBLIC_TITLE,
    description: PUBLIC_LINE,
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
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: "#2D9CDB",
          colorBackground: "#0F1620",
          colorText: "#E6EDF5",
        },
      }}
    >
      <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
        <body className="font-sans bg-beige text-ink antialiased blueprint-grid">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
