/**
 * Color contrast helpers for rendering legible text on arbitrary background
 * colors (e.g. event-type chips). Implements the WCAG 2.1 relative-luminance
 * and contrast-ratio formulas so foreground text meets the AA 4.5:1 bar.
 */

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

/** Relative luminance (0–1) of a #rrggbb color per WCAG 2.1. */
export function relativeLuminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const int = parseInt(m[1], 16);
  const r = (int >> 16) & 0xff;
  const g = (int >> 8) & 0xff;
  const b = int & 0xff;
  return (
    0.2126 * srgbChannelToLinear(r) +
    0.7152 * srgbChannelToLinear(g) +
    0.0722 * srgbChannelToLinear(b)
  );
}

/** WCAG contrast ratio (1–21) between two luminances. */
function contrast(l1: number, l2: number): number {
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Returns "#000000" or "#ffffff" — whichever yields the higher contrast against
 * `backgroundHex`. Guarantees the most legible of the two for chip/badge text.
 */
export function readableTextColor(backgroundHex: string): "#000000" | "#ffffff" {
  const bg = relativeLuminance(backgroundHex);
  const onBlack = contrast(bg, 0);
  const onWhite = contrast(bg, 1);
  return onBlack >= onWhite ? "#000000" : "#ffffff";
}
