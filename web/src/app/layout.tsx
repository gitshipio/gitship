import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { Providers } from "@/components/providers"
import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/user-nav"
import Link from "next/link"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gitship",
  description: "Deploy from Git to Kubernetes in seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-background font-sans flex flex-col`}
      >
        <Providers
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex h-14 items-center px-4 md:px-8 max-w-screen-2xl mx-auto">
              <div className="mr-4 flex">
                <Link href="/" className="mr-6 flex items-center space-x-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.svg" alt="Gitship Logo" className="h-7 w-7" />
                  <span className="font-bold inline-block text-lg">
                    Gitship
                  </span>
                </Link>
              </div>
              <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
                <div className="w-full flex-1 md:w-auto md:flex-none">
                </div>
                <nav className="flex items-center gap-2">
                  <ModeToggle />
                  <UserNav />
                </nav>
              </div>
            </div>
          </header>
          {children}
          <footer className="border-t border-border/40 py-6 md:px-8 md:py-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-16 md:flex-row max-w-screen-2xl mx-auto">
              <p className="text-balance text-center text-sm leading-loose text-muted-foreground md:text-left">
                Gitship is open source. The source code is available on{" "}
                <a
                  href="https://github.com/gitshipio/gitship"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  GitHub
                </a>
                .
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
