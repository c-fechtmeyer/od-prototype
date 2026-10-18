"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Home", match: (p: string) => p === "/" },
  { href: "/markets", label: "Markets", match: (p: string) => p.startsWith("/markets") },
  { href: "/about", label: "About", match: (p: string) => p.startsWith("/about") },
];

export function NavLinks({ pathname }: { pathname?: string }) {
  return (
    <nav className="flex h-full items-center gap-6 text-sm">
      {NAV.map((item) => {
        const active = pathname != null && item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`relative flex h-full items-center font-medium transition-colors ${
              active
                ? "text-forest-300 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-forest-400"
                : "text-muted hover:text-fg"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}
