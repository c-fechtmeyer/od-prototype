import type { Metadata } from "next";
import type { ReactNode } from "react";
import Markdown, { type Components } from "react-markdown";
import { formatCount, formatDate } from "@/lib/format";
import { type ArchiveStatus, STALE_AFTER_DAYS, getArchiveStatus } from "@/lib/markets";
import about from "./about.md";

export const metadata: Metadata = {
  title: "About · OD",
};

const link = "text-forest-300 underline decoration-forest-700 underline-offset-4 hover:decoration-forest-400";

// The page's text lives in about.md, so it can be edited without touching this file.
export default async function AboutPage() {
  const status = await getArchiveStatus();
  const { sections, footnote } = parseAbout(about);

  return (
    <main className="mx-auto w-full max-w-[1480px] flex-1 px-4 pt-9 pb-16 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="text-[28px] font-semibold tracking-tight">About</h1>

        <div className="mt-8 space-y-10">
          {sections.map((section, i) => (
            <Section key={i} title={section.title} side={i % 2 === 0 ? "left" : "right"}>
              <Copy>{section.body}</Copy>
              {section.afterStats !== undefined && (
                <>
                  <ArchiveStats status={status} />
                  <Copy>{section.afterStats}</Copy>
                </>
              )}
            </Section>
          ))}
        </div>

        {footnote !== "" && (
          <div className="mt-14 border-t border-line pt-4 text-xs text-faint italic">
            <Copy>{footnote}</Copy>
          </div>
        )}
      </div>
    </main>
  );
}

// Splits about.md into the page's parts: each "## " heading starts a section, the
// archive-stats comment marks where the stats box goes, and everything after the last
// "---" line is the footnote. Anything above the first heading isn't shown.
function parseAbout(source: string) {
  const rule = [...source.matchAll(/^---[ \t]*$/gm)].at(-1);
  const main = rule ? source.slice(0, rule.index) : source;
  const footnote = rule ? source.slice(rule.index + rule[0].length).trim() : "";

  const sections = main
    .split(/^## /m)
    .slice(1)
    .map((chunk) => {
      const [title, rest = ""] = splitOnce(chunk, /\n/);
      const [body, afterStats] = splitOnce(rest, /^<!--\s*archive-stats\s*-->[ \t]*$/m);
      return { title: title.trim(), body, afterStats };
    });

  return { sections, footnote };
}

// Splits text at the first match of the separator, dropping the match.
function splitOnce(text: string, separator: RegExp): [string, string?] {
  const match = separator.exec(text);
  return match ? [text.slice(0, match.index), text.slice(match.index + match[0].length)] : [text];
}

// A heading and its text box. Sections alternate sides: each one shifts slightly toward
// its side, and the heading moves with its box. Headings and text stay left-aligned.
function Section({ title, side, children }: { title: string; side: "left" | "right"; children: ReactNode }) {
  const right = side === "right";
  return (
    <section className={`md:w-[88%] ${right ? "md:ml-auto" : ""}`}>
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <div className="mt-3 space-y-3 rounded-xl border border-line bg-surface/80 px-5 py-4 text-left text-sm leading-relaxed text-muted sm:px-6 sm:py-5">
        {children}
      </div>
    </section>
  );
}

// Renders a piece of about.md in the page's styles. Raw HTML in the file is dropped.
function Copy({ children }: { children: string }) {
  return (
    <Markdown skipHtml components={components}>
      {children}
    </Markdown>
  );
}

const components: Components = {
  // "### " lines: the lead-ins above the bullet lists.
  h3: ({ children }) => <h3 className="font-semibold text-fg">{children}</h3>,
  strong: ({ children }) => <strong className="font-medium text-fg">{children}</strong>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className={link}>
      {children}
    </a>
  ),
  ul: ({ children }) => <ul className="space-y-2">{children}</ul>,
  li: ({ children }) => (
    <li className="flex gap-2.5">
      <span className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-forest-400" aria-hidden="true" />
      <span>{children}</span>
    </li>
  ),
  // "> " lines: small grey print.
  blockquote: ({ children }) => <div className="space-y-3 text-xs text-faint">{children}</div>,
};

// The live archive stats, shown where about.md has its archive-stats comment.
function ArchiveStats({ status }: { status: ArchiveStatus }) {
  return (
    <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-line bg-surface-2/60 p-4 text-sm sm:grid-cols-4">
      <Stat label="Source">
        <a href="https://carsandbids.com" target="_blank" rel="noreferrer" className={link}>
          Cars &amp; Bids
        </a>
      </Stat>
      <Stat label="Auctions archived">
        <span className="tabular-nums">{formatCount(status.totalAuctions)}</span>
      </Stat>
      <Stat label="Latest auctions through">{formatDate(status.latestAuctionEnd)}</Stat>
      {/* Stale only once the latest auction is older than a normal Mon–Fri weekend gap. */}
      <Stat label="Status">
        {status.fresh ? (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-forest-900 px-2 py-0.5 text-xs font-medium text-forest-300">
            <span className="size-1.5 rounded-full bg-forest-400" aria-hidden="true" />
            Synced
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-surface-3 px-2 py-0.5 text-xs font-medium text-down">
            <span className="size-1.5 rounded-full bg-down" aria-hidden="true" />
            Stale
          </span>
        )}
      </Stat>
      <p className="col-span-2 text-xs text-faint sm:col-span-4">
        Loaded daily · page refreshes hourly
        {!status.fresh && ` · no auctions have ended in the last ${STALE_AFTER_DAYS} days`}
      </p>
    </dl>
  );
}

function Stat({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-faint">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
