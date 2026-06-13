/**
 * src/utils/canvas.js — Mockup compositing logic
 *
 * Generates a mockup PNG by compositing a design onto a background
 * within a defined placement zone.
 *
 * @param {string} backgroundUrl          - URL of background image (/api/backgrounds/abc.jpg)
 * @param {string} designUrl              - Object URL or data URL of the design PNG
 * @param {{ xPct, yPct, wPct, hPct }} zone - Placement zone as fractions of background dimensions
 * @returns {Promise<string>}             - data URL of the composited PNG
 */
export async function generateMockup(backgroundUrl, designUrl, zone, designPlacement = { x: 0.5, y: 0.5, scale: 1.0 }) {
  const [bg, design] = await Promise.all([
    loadImage(backgroundUrl),
    loadImage(designUrl),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width  = bg.naturalWidth;
  canvas.height = bg.naturalHeight;
  const ctx = canvas.getContext('2d');

  // Draw background
  ctx.drawImage(bg, 0, 0);

  // Calculate zone in pixels
  const zx = zone.xPct * bg.naturalWidth;
  const zy = zone.yPct * bg.naturalHeight;
  const zw = zone.wPct * bg.naturalWidth;
  const zh = zone.hPct * bg.naturalHeight;

  // Contain design within zone — preserve aspect ratio, apply custom scale
  const baseScale = Math.min(zw / design.naturalWidth, zh / design.naturalHeight);
  const dw = design.naturalWidth  * baseScale * (designPlacement.scale ?? 1.0);
  const dh = design.naturalHeight * baseScale * (designPlacement.scale ?? 1.0);

  // Calculate center position
  const cx = zx + (designPlacement.x ?? 0.5) * zw;
  const cy = zy + (designPlacement.y ?? 0.5) * zh;

  const dx = cx - dw / 2;
  const dy = cy - dh / 2;

  ctx.drawImage(design, dx, dy, dw, dh);
  return canvas.toDataURL('image/png');
}

/**
 * Compress a mockup data URL for Printify upload:
 * - Scales down to maxPx × maxPx (default 1200)
 * - Converts to JPEG at quality 0.88
 * - Reduces typical 17 MB PNG to ~150–300 KB
 *
 * @param {string} dataUrl   - PNG data URL from generateMockup
 * @param {number} maxPx     - Max dimension (default 1200)
 * @param {number} quality   - JPEG quality 0–1 (default 0.88)
 * @returns {Promise<string>} - base64 string (no prefix) ready for uploadImage
 */
export function compressMockupToBase64(dataUrl, maxPx = 1200, quality = 0.88) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const scale  = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      // toDataURL JPEG drops alpha, fills with white automatically (canvas default)
      const jpeg = canvas.toDataURL('image/jpeg', quality);
      resolve(jpeg.split(',')[1]);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload  = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Converts a data URL to a base64 string (strips the prefix).
 */
export function dataUrlToBase64(dataUrl) {
  return dataUrl.split(',')[1];
}
