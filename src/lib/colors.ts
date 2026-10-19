// Groups Cars & Bids' free-text exterior colors ("Black Sapphire Metallic", "Guards
// Red", "Rosso Corsa") into a dozen base color families, by keyword. When a name
// holds more than one color word, the last one wins: paint names usually end with
// the base color ("Midnight Blue", "Black Cherry" -> Red).

export const COLOR_FAMILIES = [
  "Black",
  "White",
  "Silver",
  "Gray",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
  "Brown",
  "Beige",
  "Purple",
] as const;
export type ColorFamily = (typeof COLOR_FAMILIES)[number] | "Other";

// Swatches for the chart: a representative paint for each family.
export const COLOR_SWATCH: Record<ColorFamily, string> = {
  Black: "#16181a",
  White: "#f2f2ee",
  Silver: "#b9bec4",
  Gray: "#6e7378",
  Red: "#c62f2f",
  Blue: "#2d5fbf",
  Green: "#2f7a4a",
  Yellow: "#e9c42c",
  Orange: "#e37a26",
  Brown: "#7a4f32",
  Beige: "#d8c39a",
  Purple: "#6c3f9e",
  Other: "#8fa699",
};

const KEYWORDS: [ColorFamily, RegExp][] = [
  ["Black", /\b(black|nero|schwarz|onyx|ebony|obsidian|noir|beluga|caviar|carbon)\b/g],
  ["White", /\b(white|bianco|weiss|wei(ss|ß)|ivory|pearl|alabaster|chalk|ice cap|iceberg)\b/g],
  ["Silver", /\b(silver|argento|platinum|palladium|titanium|aluminum|aluminium|quicksilver|silverstone|lunar)\b/g],
  ["Gray", /\b(gr[ae]y|grigio|grau|graphite|gun|gunmetal|charcoal|slate|pewter|nardo|anthracite|crayon|tungsten|magnetic|mercury|steel|granite|thunder|cement|smoke|smoky)\b/g],
  ["Red", /\b(red|rosso|rot|hellrot|torred|infrared|burgundy|maroon|wine|cranberry|cherry|ruby|crimson|scarlet|garnet|carmine|merlot)\b/g],
  ["Blue", /\b(blue|blu|blau|navy|azure|cobalt|indigo|turquoise|teal|aqua|cyan|mexico|miami|riviera)\b/g],
  ["Green", /\b(green|verde|grun|grün|olive|emerald|jade|lime|sage|moss|forest|british racing|python|mint)\b/g],
  ["Yellow", /\b(yellow|giallo|gelb|lemon|canary|speed yellow)\b/g],
  ["Orange", /\b(orange|arancio|tangerine|copper|lava|inferno|sunset)\b/g],
  ["Brown", /\b(brown|bronze|chocolate|mocha|espresso|cognac|chestnut|mahogany|caramel|marron|umber)\b/g],
  ["Beige", /\b(beige|tan|sand|quicksand|sandstorm|macadamia|champagne|gold|cream|khaki|cashmere|desert|dune|ecru|oro)\b/g],
  ["Purple", /\b(purple|violet|plum|amethyst|lavender|magenta|viola|pink)\b/g],
];

export function colorFamily(raw: string | null | undefined): ColorFamily {
  if (!raw) return "Other";
  const name = raw.toLowerCase();
  let best: { family: ColorFamily; at: number } | null = null;
  for (const [family, re] of KEYWORDS) {
    for (const m of name.matchAll(re)) {
      if (!best || m.index >= best.at) best = { family, at: m.index };
    }
  }
  return best?.family ?? "Other";
}
