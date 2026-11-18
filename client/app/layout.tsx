import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Bengali } from "next/font/google";
import type { ReactNode } from "react";

import { Providers } from "@/components/providers";

import "./globals.css";

/**
 * Two faces: Inter for Latin UI text, Noto Sans Bengali so Bangla (বাংলা)
 * always renders with correct conjuncts and vowel signs. `--font-sans` lists
 * Inter first, so Latin glyphs use Inter and Bengali codepoints fall through
 * to the Bengali face automatically.
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bengali = Noto_Sans_Bengali({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-bengali",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Mealio",
    template: "%s · Mealio",
  },
  description:
    "Manage your mess in one place — meals, bazar shopping, deposits, expenses, bazar duty and monthly reports. Bangla and English, built for Bangladesh.",
  applicationName: "Mealio",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f5132" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1f18" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="bn" className={`${inter.variable} ${bengali.variable}`} suppressHydrationWarning>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
