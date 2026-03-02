import type { Metadata } from "next";
import "katex/dist/katex.min.css";
import "./globals.css";

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
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}
