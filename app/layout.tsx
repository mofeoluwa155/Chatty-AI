import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Chatty AI — Unified Brain",
  description: "A conversational assistant with OpenAI, Gemini, and multi-model Fusion.",
  applicationName: "Chatty AI",
};

export const viewport: Viewport = {
  themeColor: "#10111a",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
