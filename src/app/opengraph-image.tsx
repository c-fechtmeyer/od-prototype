import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

// The preview card shown when a link to any page is pasted into a chat app or
// social site. Pages don't set their own, so this one covers the whole site.
export const alt = "OverDrive Market Intelligence: collector-car auction markets";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const mark = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");

// The site's Geist comes from next/font as woff2, which ImageResponse can't read,
// so the TTFs are checked in. They're read from disk rather than fetched because
// an uncached fetch never settles during the build's prerender.
const fonts = await Promise.all(
  ([
    ["Regular", 400],
    ["SemiBold", 600],
  ] as const).map(async ([style, weight]) => ({
    name: "Geist",
    data: await readFile(join(process.cwd(), `src/app/fonts/Geist-${style}.ttf`)),
    weight,
  })),
);

// Hex values of the globals.css tokens: ImageResponse renders outside the page,
// so the Tailwind classes aren't available here.
const color = {
  canvas: "#050d09",
  fg: "#e3ede7",
  muted: "#8fa699",
  forest400: "#5cc48a",
  forest800: "#143f2a",
  forest900: "#0c2a1c",
};

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          padding: 80,
          background: `radial-gradient(circle at 85% 20%, ${color.forest900}, ${color.canvas} 60%)`,
          color: color.fg,
          fontFamily: "Geist",
        }}
      >
        {/* The logo's chart line, blown up and faded behind the text. */}
        <svg width="1200" height="630" viewBox="0 0 1200 630" style={{ position: "absolute", top: 0, left: 0 }}>
          <path
            d="M780 530 899 341l95 101 166-248"
            fill="none"
            stroke={color.forest800}
            strokeWidth="28"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={`data:image/svg+xml;base64,${mark}`} width={88} height={88} alt="" />
          <div style={{ display: "flex", fontSize: 60, fontWeight: 600, letterSpacing: -1.5 }}>
            OD<span style={{ color: color.forest400 }}>.</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 76, fontWeight: 600, letterSpacing: -2.5, lineHeight: 1.05, maxWidth: 720 }}>
            OverDrive Market Intelligence
          </div>
          <div style={{ fontSize: 34, color: color.muted, lineHeight: 1.35, maxWidth: 620 }}>
            Collector-car auction markets, built on Cars &amp; Bids results.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
