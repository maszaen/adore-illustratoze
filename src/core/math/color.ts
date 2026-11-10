export interface RGBColor {
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
}

export interface CMYKColor {
  c: number; // 0-100
  m: number; // 0-100
  y: number; // 0-100
  k: number; // 0-100
}

export interface HSBColor {
  h: number; // 0-360
  s: number; // 0-100
  b: number; // 0-100
}

export type HarmonyRule =
  | 'complementary'
  | 'analogous'
  | 'monochromatic'
  | 'triad'
  | 'compound'
  | 'shades';

export function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

export function hexToRgb(hex: string): RGBColor {
  const clean = hex.replace(/^#/, '').trim();
  if (clean.length === 3) {
    return {
      r: parseInt(clean[0] + clean[0], 16) || 0,
      g: parseInt(clean[1] + clean[1], 16) || 0,
      b: parseInt(clean[2] + clean[2], 16) || 0,
    };
  }
  const num = parseInt(clean.slice(0, 6), 16);
  if (Number.isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

export function rgbToHex({ r, g, b }: RGBColor): string {
  const toHex = (n: number) => clamp(Math.round(n), 0, 255).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function rgbToCmyk({ r, g, b }: RGBColor): CMYKColor {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;

  const k = 1 - Math.max(rn, gn, bn);
  if (k >= 0.9999) {
    return { c: 0, m: 0, y: 0, k: 100 };
  }
  const c = ((1 - rn - k) / (1 - k)) * 100;
  const m = ((1 - gn - k) / (1 - k)) * 100;
  const y = ((1 - bn - k) / (1 - k)) * 100;
  return {
    c: Math.round(c * 10) / 10,
    m: Math.round(m * 10) / 10,
    y: Math.round(y * 10) / 10,
    k: Math.round(k * 1000) / 10,
  };
}

export function cmykToRgb({ c, m, y, k }: CMYKColor): RGBColor {
  const cn = clamp(c, 0, 100) / 100;
  const mn = clamp(m, 0, 100) / 100;
  const yn = clamp(y, 0, 100) / 100;
  const kn = clamp(k, 0, 100) / 100;

  return {
    r: Math.round(255 * (1 - cn) * (1 - kn)),
    g: Math.round(255 * (1 - mn) * (1 - kn)),
    b: Math.round(255 * (1 - yn) * (1 - kn)),
  };
}

export function rgbToHsb({ r, g, b }: RGBColor): HSBColor {
  const rn = clamp(r, 0, 255) / 255;
  const gn = clamp(g, 0, 255) / 255;
  const bn = clamp(b, 0, 255) / 255;

  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;

  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case rn:
        h = (gn - bn) / d + (gn < bn ? 6 : 0);
        break;
      case gn:
        h = (bn - rn) / d + 2;
        break;
      case bn:
        h = (rn - gn) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    b: Math.round(v * 100),
  };
}

export function hsbToRgb({ h, s, b }: HSBColor): RGBColor {
  const hn = ((h % 360) + 360) % 360 / 360;
  const sn = clamp(s, 0, 100) / 100;
  const vn = clamp(b, 0, 100) / 100;

  const i = Math.floor(hn * 6);
  const f = hn * 6 - i;
  const p = vn * (1 - sn);
  const q = vn * (1 - f * sn);
  const t = vn * (1 - (1 - f) * sn);

  let r = 0,
    g = 0,
    bl = 0;
  switch (i % 6) {
    case 0:
      r = vn;
      g = t;
      bl = p;
      break;
    case 1:
      r = q;
      g = vn;
      bl = p;
      break;
    case 2:
      r = p;
      g = vn;
      bl = t;
      break;
    case 3:
      r = p;
      g = q;
      bl = vn;
      break;
    case 4:
      r = t;
      g = p;
      bl = vn;
      break;
    case 5:
      r = vn;
      g = p;
      bl = q;
      break;
  }

  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(bl * 255),
  };
}

export function toWebSafeHex(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const snap = (v: number) => Math.round(v / 51) * 51;
  return rgbToHex({ r: snap(r), g: snap(g), b: snap(b) });
}

export function rgbToGrayscalePercent(hex: string): number {
  const { r, g, b } = hexToRgb(hex);
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return Math.round((1 - lum / 255) * 100);
}

export function grayscalePercentToHex(kPercent: number): string {
  const v = Math.round(255 * (1 - clamp(kPercent, 0, 100) / 100));
  return rgbToHex({ r: v, g: v, b: v });
}

/**
 * Checks whether an RGB color is outside standard SWOP CMYK printable gamut
 * (high saturation neon/vivid RGB values that dull when printed).
 */
export function isOutOfCmykGamut(hex: string): boolean {
  if (!hex || hex === 'none') return false;
  const hsb = rgbToHsb(hexToRgb(hex));
  return hsb.s > 86 && hsb.b > 82;
}

/**
 * Brings an out-of-gamut RGB color into the nearest printable CMYK-safe equivalent.
 */
export function correctToCmykGamut(hex: string): string {
  const hsb = rgbToHsb(hexToRgb(hex));
  const safeHsb: HSBColor = {
    h: hsb.h,
    s: Math.min(hsb.s, 80),
    b: Math.min(hsb.b, 85),
  };
  return rgbToHex(hsbToRgb(safeHsb));
}

/**
 * Applies a Global Color Tint (0% = white, 100% = full color).
 */
export function applyColorTint(hex: string, tintPercent: number): string {
  if (!hex || hex === 'none') return 'none';
  const t = clamp(tintPercent, 0, 100) / 100;
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex({
    r: Math.round(255 - (255 - r) * t),
    g: Math.round(255 - (255 - g) * t),
    b: Math.round(255 - (255 - b) * t),
  });
}

/**
 * Generates Color Guide harmonies and tint/shade steps for a base hex color.
 */
export function generateColorHarmony(baseHex: string, rule: HarmonyRule): string[] {
  const hsb = rgbToHsb(hexToRgb(baseHex));
  const shiftHue = (deg: number, sMod = 1, bMod = 1) =>
    rgbToHex(
      hsbToRgb({
        h: (hsb.h + deg + 360) % 360,
        s: clamp(hsb.s * sMod, 10, 100),
        b: clamp(hsb.b * bMod, 15, 100),
      })
    );

  switch (rule) {
    case 'complementary':
      return [baseHex, shiftHue(0, 0.7, 0.85), shiftHue(180), shiftHue(180, 0.75, 0.9), shiftHue(180, 1, 0.65)];
    case 'analogous':
      return [shiftHue(-40), shiftHue(-20), baseHex, shiftHue(20), shiftHue(40)];
    case 'monochromatic':
      return [
        shiftHue(0, 0.3, 1.15),
        shiftHue(0, 0.6, 1.05),
        baseHex,
        shiftHue(0, 1, 0.75),
        shiftHue(0, 1, 0.5),
      ];
    case 'triad':
      return [baseHex, shiftHue(120), shiftHue(240), shiftHue(120, 0.65, 0.9), shiftHue(240, 0.65, 0.9)];
    case 'compound':
      return [baseHex, shiftHue(30), shiftHue(160), shiftHue(200), shiftHue(330)];
    case 'shades':
      return [
        applyColorTint(baseHex, 25),
        applyColorTint(baseHex, 55),
        baseHex,
        shiftHue(0, 1, 0.7),
        shiftHue(0, 1, 0.4),
      ];
  }
}

/**
 * Shifts a palette of hex colors by a hue delta, saturation multiplier, and brightness multiplier
 * (used by Recolor Artwork Interactive Color Wheel).
 */
export function shiftColorHarmony(
  hex: string,
  hueDeltaDeg: number,
  satMultiplier = 1,
  brightMultiplier = 1
): string {
  if (!hex || hex === 'none') return hex;
  const hsb = rgbToHsb(hexToRgb(hex));
  return rgbToHex(
    hsbToRgb({
      h: (hsb.h + hueDeltaDeg + 360) % 360,
      s: clamp(hsb.s * satMultiplier, 0, 100),
      b: clamp(hsb.b * brightMultiplier, 0, 100),
    })
  );
}
