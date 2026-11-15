/**
 * يفك باركود SVG المطبوع فعليًا في بطاقة المنتج ويقارنه بالكود المتوقع.
 * الاستخدام: node scripts/verify-barcode.mjs <svg-file> <expected-value>
 */
import fs from 'node:fs';
import {
  BarcodeFormat,
  BinaryBitmap,
  DecodeHintType,
  HybridBinarizer,
  MultiFormatReader,
  RGBLuminanceSource,
} from '@zxing/library';

const [svgPath, expected] = process.argv.slice(2);
if (!svgPath || !expected) {
  console.error('usage: node scripts/verify-barcode.mjs <svg-file> <expected-value>');
  process.exit(2);
}

const svg = fs.readFileSync(svgPath, 'utf8');
const width = Math.ceil(Number((svg.match(/\bwidth="([\d.]+)"/) || [])[1] || 0));
if (!width) throw new Error('SVG width not found');

const attr = (tag, name) => Number((tag.match(new RegExp(`\\b${name}="([\\d.]+)"`)) || [])[1] || 0);
// JsBarcode يضع الأعمدة داخل <g transform="translate(x, y)">، فيجب إزاحة الإحداثيات.
const group = svg.match(/<g[^>]*transform="translate\(([\d.]+),\s*([\d.]+)\)"/);
const offsetX = group ? Number(group[1]) : 0;
const offsetY = group ? Number(group[2]) : 0;
const rects = [...svg.matchAll(/<rect\b[^>]*>/g)].map((match) => match[0]);
const bars = rects
  .filter((tag) => !/fill\s*:\s*#?fff/i.test(tag) && !/fill="#fff/i.test(tag))
  .map((tag) => ({
    x: attr(tag, 'x') + offsetX,
    y: attr(tag, 'y') + offsetY,
    w: attr(tag, 'width'),
    h: attr(tag, 'height'),
  }))
  .filter((bar) => bar.w > 0 && bar.h > 0);

if (!bars.length) throw new Error('No bar rectangles found in SVG');

// نرسم بارتفاع دقة 4× حتى تبقى عرض الوحدة (1.05px) دقيقًا ولا يتأثر بالتقريب.
const scale = 4;
const barBottom = Math.ceil(Math.max(...bars.map((bar) => bar.y + bar.h)));
const bitmapWidth = Math.ceil(width * scale);
const bitmapHeight = Math.ceil((barBottom + 8) * scale);
const luminances = new Uint8ClampedArray(bitmapWidth * bitmapHeight).fill(255);
for (const bar of bars) {
  const left = Math.round(bar.x * scale);
  const right = Math.round((bar.x + bar.w) * scale);
  const top = Math.round((bar.y + 4) * scale);
  const bottom = Math.round((bar.y + bar.h + 4) * scale);
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      if (x >= 0 && x < bitmapWidth && y >= 0 && y < bitmapHeight) {
        luminances[y * bitmapWidth + x] = 0;
      }
    }
  }
}

const reader = new MultiFormatReader();
const hints = new Map();
hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.EAN_13]);
hints.set(DecodeHintType.TRY_HARDER, true);
reader.setHints(hints);

const bitmap = new BinaryBitmap(
  new HybridBinarizer(new RGBLuminanceSource(luminances, bitmapWidth, bitmapHeight)),
);
const result = reader.decode(bitmap);
const text = result.getText();
const format = BarcodeFormat[result.getBarcodeFormat()];
const match = text === expected;

console.log(
  JSON.stringify(
    { expected, decoded: text, format, match, width: bitmapWidth, height: bitmapHeight, bars: bars.length },
    null,
    2,
  ),
);
process.exit(match ? 0 : 1);
