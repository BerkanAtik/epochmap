import latinExt from "@fontsource-variable/fraunces/files/fraunces-latin-ext-wght-normal.woff2?url";
import latin from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import vietnamese from "@fontsource-variable/fraunces/files/fraunces-vietnamese-wght-normal.woff2?url";

/**
 * MapLibre draws labels with page fonts when the style has no `glyphs` URL, and it reads
 * the weight out of the family name ("… Semibold" -> 600). So the variable Fraunces font
 * is registered under a family name that carries the weight we want.
 */
export const LABEL_FONT = "Epochmap Label Semibold";

const FACES = [
  {
    url: latin,
    range:
      "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
  },
  {
    url: latinExt,
    range:
      "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF",
  },
  {
    url: vietnamese,
    range:
      "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
  },
];

let loading: Promise<void> | null = null;

/**
 * Registers and loads the label font once. Resolves even if loading fails
 * (labels then fall back to the browser's serif font).
 */
export function loadMapFonts(): Promise<void> {
  loading ??= (async () => {
    const faces = FACES.map(
      ({ url, range }) =>
        new FontFace(LABEL_FONT, `url(${url}) format("woff2")`, { weight: "100 900", unicodeRange: range }),
    );
    for (const face of faces) document.fonts.add(face);
    await Promise.allSettled(faces.map((face) => face.load()));
  })();
  return loading;
}
