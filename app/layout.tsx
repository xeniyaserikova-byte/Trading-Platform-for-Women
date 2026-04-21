import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { PortfolioProvider } from "@/components/providers/portfolio-provider";
import { SoundProvider } from "@/components/providers/sound-provider";
import { Toaster } from "@/components/ui/sonner";
import { TopNav } from "@/components/top-nav";
import { TickerMarquee } from "@/components/ticker-marquee";

const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  display: "swap",
});

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Lipstick & Ledger — Markets, in your color.",
  description:
    "A modern paper-trading sandbox made for women who take markets personally. Real quotes, virtual capital, and an AI strategist named Wavick.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontSans.variable} ${fontMono.variable}`}
    >
      <body className="min-h-screen bg-paper text-ink antialiased">
        <PortfolioProvider>
          <SoundProvider>
            <div className="flex min-h-screen flex-col">
              <TopNav />
              <TickerMarquee />
              <main className="container flex-1 pb-16 pt-10">
                <div className="reveal">{children}</div>
              </main>
              <footer className="border-t border-ink/10 py-8">
                <div className="container flex flex-col gap-2 text-xs text-ink-mute sm:flex-row sm:items-center sm:justify-between">
                  <div className="eyebrow">
                    Lipstick &amp; Ledger — Vol. I
                  </div>
                  <div className="font-mono">
                    Educational only · Not financial advice · Quotes by Alpha
                    Vantage · Strategy by Wavick
                  </div>
                </div>
              </footer>
            </div>
            <Toaster />
          </SoundProvider>
        </PortfolioProvider>
      </body>
    </html>
  );
}
