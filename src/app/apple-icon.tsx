import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const mark = await readFile(join(process.cwd(), "src/app/icon.svg"), "base64");

// iOS rounds the corners itself, so the mark sits on a full-bleed square of its
// own tile color (forest-700) rather than showing its rounded corners.
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: "flex", width: "100%", height: "100%", background: "#1d5e3c" }}>
        <img src={`data:image/svg+xml;base64,${mark}`} width={size.width} height={size.height} alt="" />
      </div>
    ),
    size,
  );
}
