import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/lib/i18n/LanguageContext";
import { ThemeProvider } from "@/components/theme-provider";
import { ToastProvider } from "@/components/toast";
import { AuthProvider } from "@/lib/auth-context";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "DGMS-Copilot Platform",
  description:
    "Enterprise mining compliance assistant for DGMS references, traceability, and operational report analysis.",
  keywords: [
    "DGMS",
    "mining compliance",
    "CCL",
    "mine safety",
    "Coal Mines Regulations",
    "shift reports",
  ],
  robots: { index: false, follow: false }, // Private platform
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi" suppressHydrationWarning>
      <head>
        {/* Prefetch all main app routes for instant navigation */}
        <link rel="prefetch" href="/dashboard" />
        <link rel="prefetch" href="/assistant" />
        <link rel="prefetch" href="/repository" />
        <link rel="prefetch" href="/search" />
        <link rel="prefetch" href="/citations" />
        <link rel="prefetch" href="/admin" />
        <link rel="prefetch" href="/shift-analysis" />
      </head>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ThemeProvider>
          <LanguageProvider>
            <AuthProvider>
              <ToastProvider>{children}</ToastProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
