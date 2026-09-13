import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Session Audio Analyzer",
  description: "Record or upload mentorship session audio and generate a word cloud of prominent terms using AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} font-sans antialiased`}>
      <head>
        <meta name="x-brief-ref" content="TFG-WD-8823" />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 dark:bg-gray-900">{children}</body>
    </html>
  );
}
