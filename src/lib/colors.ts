/**
 * Muted, map-friendly hues that stay readable on the dark ocean and under light labels.
 * A polity always hashes to the same hue, so it keeps its colour as you move through time.
 */
const PALETTE = [
  [201, 166, 107], // ochre
  [181, 101, 74], // terracotta
  [143, 155, 90], // olive
  [95, 143, 122], // sage
  [79, 127, 163], // steel blue
  [122, 106, 168], // lavender
  [162, 93, 123], // mulberry
  [196, 138, 90], // copper
  [111, 156, 154], // teal
  [154, 140, 95], // khaki
  [176, 124, 158], // orchid
  [93, 127, 92], // moss
  [194, 120, 94], // salmon
  [138, 111, 90], // umber
  [107, 134, 184], // cornflower
  [169, 163, 91], // mustard
  [140, 98, 140], // plum
  [86, 140, 160], // lagoon
] as const;

/** 32-bit FNV-1a: tiny, fast and well distributed for short strings. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Fill colour for a polity. Subjects of another power share its hue, drawn lighter. */
export function polityColor(name: string, subject: string | undefined): string {
  const ruler = subject && subject !== name ? subject : name;
  const [r, g, b] = PALETTE[hash(ruler) % PALETTE.length] ?? PALETTE[0];
  const alpha = ruler === name ? 0.62 : 0.36;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
