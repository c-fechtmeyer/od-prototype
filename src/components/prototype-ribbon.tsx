// A "PROTOTYPE" ribbon across the page's top-right corner. A 150×22px band is
// rotated 45° inside a 120px corner box that clips it, so the band runs off the top
// edge on the left and off the right edge on the right. Its center sits 38px in from
// both edges, which centers the label on the visible part of the band.
export function PrototypeRibbon() {
  return (
    <div className="pointer-events-none absolute top-0 right-0 z-50 size-30 overflow-hidden">
      <span
        title="This site is a prototype: data, metrics and design are still changing."
        className="pointer-events-auto absolute top-[27px] left-[7px] block h-[22px] w-[150px] rotate-45 bg-forest-300 text-center text-[10px] leading-[22px] font-extrabold tracking-[0.16em] text-canvas uppercase shadow-md shadow-black/50"
      >
        Prototype
      </span>
    </div>
  );
}
