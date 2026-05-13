import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { ToastProvider } from "@/components/ui";

const inter = Inter({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "InvestmentAI — Yatırım Analizi",
    template: "%s · InvestmentAI",
  },
  description: "BIST ve ABD borsası için kapsamlı yatırım analizi platformu: temel + teknik analiz, sektör ortalamaları, yatırım üstadı stratejileri, endeks analizleri.",
  keywords: ["BIST", "borsa", "yatırım", "hisse analizi", "teknik analiz", "temel analiz", "Buffett", "Graham", "F/K", "PD/DD"],
  authors: [{ name: "InvestmentAI" }],
  themeColor: "#0a0a0c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" data-theme="dark" className={inter.variable} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ToastProvider>{children}</ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
