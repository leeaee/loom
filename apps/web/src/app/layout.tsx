import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { copy } from "@/lib/copy";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: copy.app.name,
  description: copy.app.tagline,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <Providers>
          <header className="border-b">
            <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
              <Link href="/" className="font-semibold tracking-tight">
                {copy.app.name}
              </Link>
              <span className="hidden text-sm text-muted-foreground sm:inline">{copy.app.tagline}</span>
            </div>
          </header>
          <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
