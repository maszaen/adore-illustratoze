/**
 * Software Gaussian blur for RGBA pixel data (used when the canvas has no `filter` support).
 * Three successive box blurs approximate a Gaussian of the given standard deviation (in pixels),
 * which is the same technique browsers use for feGaussianBlur. Works on premultiplied alpha so
 * color does not bleed in from fully transparent pixels. Pixels outside the image count as transparent.
 */
export function boxSizesForGaussian(sigma: number, passes = 3): number[] {
  const ideal = Math.sqrt((12 * sigma * sigma) / passes + 1);
  let lower = Math.floor(ideal);
  if (lower % 2 === 0) lower--;
  const upper = lower + 2;
  const mIdeal = (12 * sigma * sigma - passes * lower * lower - 4 * passes * lower - 3 * passes) / (-4 * lower - 4);
  const m = Math.round(mIdeal);
  return Array.from({ length: passes }, (_, i) => (i < m ? lower : upper));
}

function boxBlurAxis(src: Float32Array, dst: Float32Array, length: number, lines: number, stride: number, lineStride: number, radius: number) {
  const scale = 1 / (2 * radius + 1);
  for (let line = 0; line < lines; line++) {
    const base = line * lineStride;
    let sum = 0;
    for (let k = 0; k <= Math.min(radius, length - 1); k++) sum += src[base + k * stride];
    for (let i = 0; i < length; i++) {
      dst[base + i * stride] = sum * scale;
      const incoming = i + radius + 1, outgoing = i - radius;
      if (incoming < length) sum += src[base + incoming * stride];
      if (outgoing >= 0) sum -= src[base + outgoing * stride];
    }
  }
}

export function gaussianBlurRgba(data: Uint8ClampedArray, width: number, height: number, sigma: number): void {
  if (!(sigma > 0) || width <= 0 || height <= 0) return;
  const count = width * height;
  const channels = [0, 1, 2, 3].map(() => new Float32Array(count));
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    const a = data[p + 3] / 255;
    channels[0][i] = data[p] * a; channels[1][i] = data[p + 1] * a; channels[2][i] = data[p + 2] * a; channels[3][i] = data[p + 3];
  }
  const scratch = new Float32Array(count);
  const sizes = boxSizesForGaussian(sigma);
  for (const channel of channels) {
    for (const size of sizes) {
      const radius = Math.max(0, (size - 1) / 2);
      boxBlurAxis(channel, scratch, width, height, 1, width, radius);
      boxBlurAxis(scratch, channel, height, width, width, 1, radius);
    }
  }
  for (let i = 0, p = 0; i < count; i++, p += 4) {
    const alpha = channels[3][i];
    const a = alpha / 255;
    data[p + 3] = alpha;
    data[p] = a > 0 ? channels[0][i] / a : 0;
    data[p + 1] = a > 0 ? channels[1][i] / a : 0;
    data[p + 2] = a > 0 ? channels[2][i] / a : 0;
  }
}
