import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aurum AI (औरम एआई) — Indian Bullion Intelligence & Voice Companion",
  description:
    "Institutional-grade gold and silver intelligence for India. Live landed retail prices (24K, 22K, Silver), moving average benchmarks (MA7/15/30), deterministic unit affordability calculator, and native conversational Hindi voice updates.",
  keywords: [
    "Aurum AI",
    "Gold Price India",
    "Silver Price India",
    "24K Gold Rate",
    "22K Gold Rate",
    "Bullion Calculator",
    "Moving Average Gold",
    "Hindi Gold AI",
    "Telegram Gold Bot",
  ],
  authors: [{ name: "Aurum AI Engineering" }],
  openGraph: {
    title: "Aurum AI — Har Din Ka Sona-Chandi Update, Apni Bhasha Mein",
    description:
      "Voice-native Indian bullion intelligence dashboard and Telegram companion. Non-directive, factual, culturally fluent.",
    url: "https://aurumai-opal.vercel.app",
    siteName: "Aurum AI",
    locale: "hi_IN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Aurum AI — Indian Bullion Intelligence & Voice Companion",
    description:
      "Deterministic landed prices, moving averages, and cultural Hindi market context.",
  },
};

export const viewport: Viewport = {
  themeColor: "#080A0F",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@500;600;700;800&family=JetBrains+Mono:wght@500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
