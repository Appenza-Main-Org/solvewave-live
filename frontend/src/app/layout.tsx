import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";

const cairo = Cairo({
  subsets: ["latin", "arabic"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "Faheem Math AI Tutor — Live Math Tutoring",
  description: "Real-time math tutoring powered by Gemini Live",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${cairo.variable}`}>
      <body className="min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
