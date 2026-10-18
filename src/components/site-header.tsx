import Link from "next/link";

const NAV = [{ href: "/", label: "Markets" }];

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-canvas/70 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-[1480px] items-center gap-8 px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="OD home">
          <svg viewBox="0 0 28 28" className="size-7" aria-hidden="true">
            <rect width="28" height="28" rx="8" className="fill-forest-700" />
            <path
              d="M6 19.5 11 13l4 3.5L22 8"
              fill="none"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="stroke-forest-200"
            />
          </svg>
          <span className="text-[17px] font-semibold tracking-tight">
            OD<span className="text-forest-400">.</span>
          </span>
        </Link>

        <nav className="flex h-full items-center gap-6 text-sm">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current="page"
              className="relative flex h-full items-center font-medium text-forest-300 after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-forest-400"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto hidden items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-muted sm:flex">
          <span className="size-1.5 rounded-full bg-forest-400" aria-hidden="true" />
          Source: Cars &amp; Bids
        </div>
      </div>
    </header>
  );
}
