"use client";

import { type CSSProperties, type ReactNode, type RefObject, useEffect, useRef, useState } from "react";
import { auctionUrl } from "@/lib/auction";
import type { FamilyAuction } from "@/lib/family";

// A chart tooltip that a click or tap on its dot pins open, so it stays without hover:
// on a phone, a tap is the way to open one. Clicking the dot again, a tap or click
// outside the chart, or Escape closes it. A closed dot stays closed while the pointer is still on
// it (or, after a tap, last touched it), or hover would bring its tooltip straight back.
export function usePinnedTip<K>(wrapRef: RefObject<HTMLElement | null>) {
  const [pinned, setPinned] = useState<K | null>(null);
  const [closed, setClosed] = useState<K | null>(null);

  useEffect(() => {
    if (pinned == null) return;
    const close = () => {
      setPinned(null);
      setClosed(pinned);
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [pinned, wrapRef]);

  return {
    pinned,
    // The dot whose tooltip shows: the pinned one, else the one under the pointer.
    shown: (hovered: K | null) => pinned ?? (hovered === closed ? null : hovered),
    // The pointer moved onto this dot, or off every dot (null).
    track: (hovered: K | null) => hovered !== closed && setClosed(null),
    // A click or tap on this dot, or off every dot (null).
    click: (hit: K | null) => {
      if (hit != null && hit !== pinned) return setPinned(hit);
      setPinned(null);
      setClosed(hit);
    },
    clear: () => setPinned(null),
  };
}

// How long a hovered dot's tooltip waits for a pointer that stopped on its way over.
const REST_MS = 300;
const HULL_PAD = 4;

type Pt = { x: number; y: number };

// Lets a mouse cross from a hovered dot to its tooltip, to click the link there, over
// whatever other dots and lines lie between. A move off the dot that stays inside the
// hull of where the pointer last was on it and the tooltip keeps the tooltip, as long
// as the pointer keeps moving; inside the tooltip it stays. Spread `box` on the tooltip.
export function useTipBridge() {
  const box = useRef<HTMLDivElement>(null);
  const from = useRef<Pt | null>(null);
  const wait = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(wait.current), []);

  return {
    // A pointer move: show() what's under it now or, when it has just left the hovered
    // dot (`leaving`) for that dot's tooltip, once it stops short of the tooltip.
    step: (e: React.PointerEvent, leaving: boolean, show: () => void) => {
      clearTimeout(wait.current);
      const at = { x: e.clientX, y: e.clientY };
      const go = () => {
        from.current = at;
        show();
      };
      const el = box.current;
      const toward =
        e.pointerType !== "touch" && leaving && el && from.current && inHull(from.current, el.getBoundingClientRect(), at);
      if (toward) wait.current = setTimeout(go, REST_MS);
      else go();
    },
    // The pointer left the chart.
    reset: () => {
      clearTimeout(wait.current);
      from.current = null;
    },
    box: {
      ref: box,
      onPointerEnter: () => clearTimeout(wait.current),
      // Back on the chart from the tooltip, the pointer shows what it's on straight away.
      onPointerLeave: () => {
        from.current = null;
      },
    },
  };
}

export type TipHold = ReturnType<typeof useTipBridge>["box"];

// Whether p is inside the convex hull of point a and rectangle r (padded): the union of
// the triangles from a to each side of r.
function inHull(a: Pt, r: DOMRect, p: Pt) {
  const c = [
    { x: r.left - HULL_PAD, y: r.top - HULL_PAD },
    { x: r.right + HULL_PAD, y: r.top - HULL_PAD },
    { x: r.right + HULL_PAD, y: r.bottom + HULL_PAD },
    { x: r.left - HULL_PAD, y: r.bottom + HULL_PAD },
  ];
  const cross = (o: Pt, u: Pt, v: Pt) => (u.x - o.x) * (v.y - o.y) - (u.y - o.y) * (v.x - o.x);
  return c.some((u, i) => {
    const v = c[(i + 1) % 4];
    const d = [cross(p, a, u), cross(p, u, v), cross(p, v, a)];
    return !(d.some((n) => n < 0) && d.some((n) => n > 0));
  });
}

const GAP = 14; // between the point and the panel

// A tooltip panel w wide beside the point (x, y) on a chart width × height: to the
// right, or to the left near the right edge, kept inside the chart's height (h is about
// how tall the panel gets). Where neither side has room, as on a phone, it goes below
// the point, or above it low in the chart, so it never covers the point (a tap there
// closes it). A panel with `hold` (a dot's, from useTipBridge) takes the pointer, so its
// link can be clicked; one without lets the pointer through to the chart.
export function TipBox({
  x,
  y,
  width,
  height,
  w,
  h,
  hold,
  children,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  w: number;
  h: number;
  hold?: TipHold;
  children: ReactNode;
}) {
  const side = x + GAP + w <= width ? x + GAP : x - GAP - w >= 0 ? x - GAP - w : null;
  const place: CSSProperties =
    side != null
      ? { left: side, top: Math.min(Math.max(0, y - 24), height - h) }
      : {
          left: Math.min(Math.max(0, x - w / 2), Math.max(0, width - w)),
          ...(y + GAP + h <= height ? { top: y + GAP } : { top: y - GAP, transform: "translateY(-100%)" }),
        };
  return (
    <div
      {...hold}
      className={`absolute z-10 rounded-lg border border-line-strong/70 bg-surface-3/90 px-3 py-2.5 text-xs leading-relaxed shadow-lg shadow-black/30 backdrop-blur-md ${hold ? "" : "pointer-events-none"}`}
      style={{ ...place, width: Math.min(w, width) }}
    >
      {children}
    </div>
  );
}

// A tooltip's heading: the auction's title, linked to its Cars & Bids listing.
export function TipTitle({ a }: { a: FamilyAuction }) {
  return (
    <a
      href={auctionUrl(a.id)}
      target="_blank"
      rel="noreferrer"
      className="font-medium text-forest-300 underline decoration-forest-700 underline-offset-4 hover:decoration-forest-400"
    >
      {a.title ?? "Untitled listing"}
    </a>
  );
}
