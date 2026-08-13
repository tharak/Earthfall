import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Earthfall Protocol",
  description: "A geometry-first urban extraction shooter prototype.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
