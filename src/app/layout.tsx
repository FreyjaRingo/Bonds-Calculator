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
  themeColor: "#100f0b",
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
        <header className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-2.5 sm:px-6">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center bg-accent text-xs font-bold text-accent-ink">M</span>
              <span className="text-sm font-semibold tracking-wide text-ink">BONDS CALCULATOR</span>
            </Link>
            <nav className="flex gap-0.5 text-[13px] font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="px-3 py-1.5 text-ink-muted transition-colors hover:text-accent-strong"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
        <footer className="border-t border-border py-3 text-center text-[11px] text-ink-faint">
          Bonds Calculator — internal tool
        </footer>
      </body>
    </html>
  );
}
