import latinExtItalic from "@fontsource-variable/fraunces/files/fraunces-latin-ext-wght-italic.woff2?url";
import latinExt from "@fontsource-variable/fraunces/files/fraunces-latin-ext-wght-normal.woff2?url";
import latinItalic from "@fontsource-variable/fraunces/files/fraunces-latin-wght-italic.woff2?url";
import latin from "@fontsource-variable/fraunces/files/fraunces-latin-wght-normal.woff2?url";
import vietnamese from "@fontsource-variable/fraunces/files/fraunces-vietnamese-wght-normal.woff2?url";

/**
 * MapLibre draws labels with page fonts when the style has no `glyphs` URL, and reads the
 * weight and style out of the family name ("… Semibold Italic" -> 600, italic). So the variable
 * Fraunces font is registered under family names that carry what we want.
 */
export const LABEL_FONT = "Epochmap Label Semibold";
export const LABEL_FONT_ITALIC = "Epochmap Label Semibold Italic";

const LATIN =
  "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD";
const LATIN_EXT =
  "U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF";
const VIETNAMESE =
  "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB";

const FACES: { family: string; url: string; range: string; style: string }[] = [
  { family: LABEL_FONT, url: latin, range: LATIN, style: "normal" },
  { family: LABEL_FONT, url: latinExt, range: LATIN_EXT, style: "normal" },
  { family: LABEL_FONT, url: vietnamese, range: VIETNAMESE, style: "normal" },
  { family: LABEL_FONT_ITALIC, url: latinItalic, range: LATIN, style: "italic" },
  { family: LABEL_FONT_ITALIC, url: latinExtItalic, range: LATIN_EXT, style: "italic" },
];

let loading: Promise<void> | null = null;

/**
 * Registers and loads the label fonts once. Resolves even if loading fails
 * (labels then fall back to the browser's serif font).
 */
export function loadMapFonts(): Promise<void> {
  loading ??= (async () => {
    const faces = FACES.map(
      ({ family, url, range, style }) =>
        new FontFace(family, `url(${url}) format("woff2")`, {
          weight: "100 900",
          unicodeRange: range,
          style,
        }),
    );
    for (const face of faces) document.fonts.add(face);
    await Promise.allSettled(faces.map((face) => face.load()));
  })();
  return loading;
}
