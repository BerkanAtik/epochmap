/**
 * Muted, map-friendly hues that stay readable over satellite imagery and under light labels.
 * The data build (scripts/build-data.ts) gives every polity an index into this palette so that
 * neighbours never share a colour, a polity keeps its colour through time, and colonies wear
 * their empire's colour.
 */
export const PALETTE = [
  [214, 170, 96], // ochre
  [196, 98, 70], // terracotta
  [150, 168, 84], // olive
  [88, 160, 128], // sage
  [76, 132, 186], // steel blue
  [132, 108, 190], // lavender
  [184, 88, 128], // mulberry
  [212, 140, 80], // copper
  [96, 172, 172], // teal
  [176, 152, 92], // khaki
  [196, 120, 176], // orchid
  [92, 140, 88], // moss
  [222, 116, 96], // salmon
  [156, 112, 84], // umber
  [104, 140, 210], // cornflower
  [196, 186, 84], // mustard
  [156, 96, 160], // plum
  [72, 152, 176], // lagoon
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

/** CSS colour for a palette index (wraps around, so any number is safe). */
export function paletteColor(index: number): string {
  const [r, g, b] = PALETTE[Math.abs(Math.trunc(index)) % PALETTE.length] ?? PALETTE[0];
  return `rgb(${r}, ${g}, ${b})`;
}
