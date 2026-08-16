import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const plexSans = IBM_Plex_Sans({
  variable: "--font-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Bonds Calculator",
  description: "Kalkulator subscription, redemption & switching obligasi",
};

export const viewport: Viewport = {
  themeColor: "#faf7ef",
};

const navLinks = [
  { href: "/subscription", label: "Subscription" },
  { href: "/redemption", label: "Redemption" },
  { href: "/switching", label: "Switching" },
  { href: "/bonds", label: "Database Obligasi" },
];

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${plexSans.variable} ${plexMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <header className="border-b border-accent-ink/10 bg-accent-ink text-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-accent text-sm font-bold text-accent-ink">
                M
              </span>
              <span className="text-base font-semibold tracking-tight">
                Bonds Calculator
              </span>
            </Link>
            <nav className="flex gap-1 text-sm font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded px-3 py-1.5 text-white/75 transition-colors hover:bg-white/10 hover:text-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-border bg-surface py-4 text-center text-xs text-ink-faint">
          Bonds Calculator — internal tool
        </footer>
      </body>
    </html>
  );
}
