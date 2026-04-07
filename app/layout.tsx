import Link from "next/link";
import type { Metadata } from "next";
import { DM_Sans, Playfair_Display } from "next/font/google";

import { PageTransition } from "@/components/PageTransition";
import { ToastProvider } from "@/components/ToastProvider";

import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  display: "swap",
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  display: "swap",
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Signal",
  description:
    "AI-powered career intelligence briefs for students researching any company in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${dmSans.variable} ${playfairDisplay.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <PageTransition>{children}</PageTransition>
        <footer className="border-t border-border bg-background/80 px-6 py-8 text-center text-xs text-secondary backdrop-blur-xl">
          <p>Built by Jonathan at Rutgers University for the Codex Creator Challenge</p>
          <p className="mt-2">
            Powered by{" "}
            <Link
              href="https://openai.com"
              className="signal-link"
            >
              OpenAI
            </Link>
          </p>
        </footer>
        <ToastProvider />
      </body>
    </html>
  );
}
