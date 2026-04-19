import type { Metadata } from "next";
import localFont from "next/font/local";

import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import "@fontsource/ibm-plex-mono/600.css";
import "./globals.css";

const mondwest = localFont({
  src: [
    { path: "./fonts/Mondwest-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Mondwest-Bold.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-mondwest",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Aesir OSS",
  description: "A local-first desktop shell for Hermes profiles and sessions.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={mondwest.variable}>
      <body>{children}</body>
    </html>
  );
}
