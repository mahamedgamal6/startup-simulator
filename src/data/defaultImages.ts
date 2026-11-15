import type { Accessory, FactoryImage, Machinery, Mold, PackagingRow, Product } from '../types';
import { STORE_PRODUCT_PHOTOS } from './storeProductImages';

const DEFAULT_UPDATED_AT = '2026-11-09T12:00:00.000Z';

const FAMILY_COLOR: Record<string, string> = {
  باور: '#ec1c24',
  'باور بلس': '#ec1c24',
  'برايم استانلس': '#a95e6b',
  'كراون تيتانيوم': '#447a72',
  'إيلورا جرانيت': '#4A90E2',
  'صينية فرن': '#4A90E2',
};

const escapeXml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const toDataUrl = (svg: string) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;

const shell = (body: string, accent: string, label: string, meta: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1d1d20"/>
      <stop offset="100%" stop-color="#2a0d10"/>
    </linearGradient>
    <linearGradient id="steel" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbfcfd"/>
      <stop offset="26%" stop-color="#dfe3e9"/>
      <stop offset="52%" stop-color="#aab1bd"/>
      <stop offset="74%" stop-color="#eef1f5"/>
      <stop offset="100%" stop-color="#9ba3b0"/>
    </linearGradient>
    <linearGradient id="inner" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#9aa2ae"/>
      <stop offset="45%" stop-color="#d8dde4"/>
      <stop offset="100%" stop-color="#b7bec9"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="42%" r="58%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="640" height="420" fill="url(#bg)"/>
  <circle cx="92" cy="80" r="150" fill="url(#glow)"/>
  <circle cx="540" cy="300" r="130" fill="#ffffff" opacity="0.035"/>
  ${body}
  <rect x="28" y="344" width="584" height="52" rx="14" fill="#0f1115" opacity="0.78"/>
  <text x="40" y="367" fill="${accent}" font-family="Arial, sans-serif" font-size="11" font-weight="700" letter-spacing="3">ELZONKI</text>
  <text x="40" y="385" fill="#8f98a7" font-family="Arial, sans-serif" font-size="10" letter-spacing="1.4">${escapeXml(meta)}</text>
  <text x="600" y="366" text-anchor="end" direction="rtl" fill="#ffffff" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="18" font-weight="700">${escapeXml(label)}</text>
</svg>`;

function productSvg(product: Product): string {
  const accent = FAMILY_COLOR[product.family] ?? '#ec1c24';
  const isTray = product.family === 'صينية فرن';
  const scale = Math.min(1.25, Math.max(0.86, product.sizeCm / 24));
  const w = Math.round((isTray ? 330 : 250) * scale);
  const h = Math.round((isTray ? 70 : 120) * scale);
  const cx = 320;
  const top = 174;
  const metal =
    isTray
      ? `
      <ellipse cx="${cx}" cy="${top + h + 26}" rx="${Math.round(w * 0.42)}" ry="16" fill="#000" opacity="0.25"/>
      <ellipse cx="${cx}" cy="${top + 40}" rx="${Math.round(w / 2)}" ry="${Math.round(h / 5)}" fill="url(#steel)" stroke="#9aa3b2" stroke-width="2"/>
      <ellipse cx="${cx}" cy="${top + 10}" rx="${Math.round(w / 2)}" ry="${Math.round(h / 5)}" fill="url(#inner)" stroke="#8d95a2" stroke-width="1.5"/>
      <ellipse cx="${cx}" cy="${top + 8}" rx="${Math.round(w * 0.42)}" ry="${Math.round(h / 7)}" fill="#eef2f6" opacity="0.65"/>
      <path d="M${cx - w / 2 + 16} ${top + 10} q${w / 2} ${h / 2} ${w - 32} 0" fill="none" stroke="${accent}" stroke-width="4" opacity="0.8" stroke-linecap="round"/>
      `
      : `
      <ellipse cx="${cx}" cy="${top + h + 18}" rx="${Math.round(w * 0.44)}" ry="18" fill="#000" opacity="0.28"/>
      <path d="M${cx - w / 2} ${top} h${w} l-12 ${h} c-3 18 -38 30 -${w / 2} 30 s-${w / 2 - 12} -12 -${w / 2 - 3} -30 z" fill="url(#steel)" stroke="#8d95a2" stroke-width="2"/>
      <ellipse cx="${cx}" cy="${top}" rx="${Math.round(w / 2)}" ry="${Math.round(h * 0.18)}" fill="url(#inner)" stroke="#8d95a2" stroke-width="1.5"/>
      <ellipse cx="${cx}" cy="${top - 2}" rx="${Math.round(w * 0.42)}" ry="${Math.round(h * 0.12)}" fill="#eef2f6" opacity="0.8"/>
      <path d="M${cx - w / 2 - 8} ${top + 18} c-28 0 -38 18 -38 26 s10 26 38 26" fill="none" stroke="#8f97a4" stroke-width="10" stroke-linecap="round"/>
      <path d="M${cx - w / 2 - 8} ${top + 18} c-28 0 -38 18 -38 26 s10 26 38 26" fill="none" stroke="#e6e9ee" stroke-width="4" stroke-linecap="round"/>
      <path d="M${cx + w / 2 + 8} ${top + 18} c28 0 38 18 38 26 s-10 26 -38 26" fill="none" stroke="#8f97a4" stroke-width="10" stroke-linecap="round"/>
      <path d="M${cx + w / 2 + 8} ${top + 18} c28 0 38 18 38 26 s-10 26 -38 26" fill="none" stroke="#e6e9ee" stroke-width="4" stroke-linecap="round"/>
      <path d="M${cx - w / 2} ${top + 26} q${w / 2} ${h * 0.35} ${w} 0" fill="none" stroke="${accent}" stroke-width="4" opacity="0.82" stroke-linecap="round"/>
      <path d="M${cx - w / 2 + 16} ${top + 14} q${w * 0.3} ${h * 0.24} ${w * 0.56} 0" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.35" stroke-linecap="round"/>
      `;
  return toDataUrl(
    shell(
      `<g>${metal}<ellipse cx="320" cy="292" rx="190" ry="56" fill="none" stroke="${accent}" stroke-width="1" opacity="0.18"/></g>`,
      accent,
      product.name,
      `${product.code} · ${product.sizeCm} سم · ${product.family}`,
    ),
  );
}

function machineSvg(machine: Machinery, index: number): string {
  const accents = ['#4A90E2', '#447a72', '#a95e6b', '#ec1c24'];
  const accent = accents[index % accents.length];
  return toDataUrl(
    shell(
      `<g>
        <rect x="64" y="94" width="512" height="184" rx="22" fill="#252a33" stroke="${accent}" stroke-width="2" opacity="0.96"/>
        <rect x="84" y="114" width="348" height="126" rx="12" fill="#141820" stroke="#3d4654"/>
        <g opacity="0.9">
          <circle cx="146" cy="178" r="33" fill="url(#steel)" stroke="#7b8593" stroke-width="3"/>
          <circle cx="232" cy="178" r="33" fill="url(#steel)" stroke="#7b8593" stroke-width="3"/>
          <circle cx="318" cy="178" r="33" fill="url(#steel)" stroke="#7b8593" stroke-width="3"/>
          <rect x="112" y="148" width="240" height="8" rx="4" fill="#596372" opacity="0.7"/>
        </g>
        <rect x="452" y="118" width="100" height="122" rx="10" fill="#0d1117" stroke="#46505d"/>
        <rect x="466" y="134" width="72" height="30" rx="5" fill="#10231b" stroke="#3f7e65"/>
        <text x="502" y="154" text-anchor="middle" fill="#67d6a0" font-family="Arial, sans-serif" font-size="13" font-weight="700">RUN</text>
        <circle cx="486" cy="194" r="8" fill="#ec1c24"/>
        <circle cx="514" cy="194" r="8" fill="#f0a640"/>
        <circle cx="486" cy="218" r="8" fill="#4A90E2"/>
        <circle cx="514" cy="218" r="8" fill="#67d6a0"/>
        <rect x="84" y="252" width="468" height="12" rx="6" fill="${accent}" opacity="0.75"/>
        <path d="M84 264h468" stroke="#ffffff" stroke-width="2" opacity="0.15"/>
        <path d="M110 284h70m24 0h70m24 0h70" stroke="#ffffff" stroke-width="3" opacity="0.18" stroke-linecap="round"/>
      </g>`,
      accent,
      machine.name,
      `${machine.code} · ${machine.department}`,
    ),
  );
}

function moldSvg(mold: Mold, index: number): string {
  const accents = ['#ec1c24', '#4A90E2', '#447a72', '#a95e6b'];
  const accent = accents[index % accents.length];
  const size = Math.min(1.22, Math.max(0.86, mold.sizeCm / 24));
  const r = Math.round(132 * size);
  return toDataUrl(
    shell(
      `<g>
        <circle cx="320" cy="196" r="${r + 24}" fill="#0f1115" stroke="#3d4654" stroke-width="2"/>
        <circle cx="320" cy="196" r="${r}" fill="url(#steel)" stroke="#87909d" stroke-width="3"/>
        <circle cx="320" cy="196" r="${r - 24}" fill="url(#inner)" stroke="#6f7987" stroke-width="2"/>
        <circle cx="320" cy="196" r="${r - 46}" fill="#1a1e25" stroke="${accent}" stroke-width="3" opacity="0.95"/>
        <g fill="#0b0e13" stroke="${accent}" stroke-width="2">
          <circle cx="${320 - r * 0.44}" cy="${196 - r * 0.4}" r="${r * 0.16}"/>
          <circle cx="${320 + r * 0.44}" cy="${196 - r * 0.4}" r="${r * 0.16}"/>
          <circle cx="${320 - r * 0.44}" cy="${196 + r * 0.4}" r="${r * 0.16}"/>
          <circle cx="${320 + r * 0.44}" cy="${196 + r * 0.4}" r="${r * 0.16}"/>
        </g>
        <circle cx="320" cy="196" r="${r * 0.23}" fill="#252b35" stroke="${accent}" stroke-width="2"/>
        <path d="M${320 - r * 0.62} ${196 - r * 0.62} q${r * 0.5} -${r * 0.4} ${r * 0.9} -${r * 0.1}" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.2" stroke-linecap="round"/>
      </g>`,
      accent,
      mold.name,
      `${mold.code} · ${mold.sizeCm} سم · ${mold.drawType}`,
    ),
  );
}

function accessorySvg(accessory: Accessory, index: number): string {
  const accents = ['#ec1c24', '#4A90E2', '#447a72', '#a95e6b', '#f0a640', '#67d6a0'];
  const accent = accents[index % accents.length];
  let art = '';

  if (accessory.code === 'ACC-01' || accessory.code === 'ACC-06') {
    const granite = accessory.code === 'ACC-06';
    art = `
      ${granite ? `<defs><pattern id="granite" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#30353d"/><circle cx="3" cy="3" r="1.2" fill="#aeb7c2" opacity="0.7"/><circle cx="9" cy="7" r="0.9" fill="#ffffff" opacity="0.4"/><circle cx="6" cy="10" r="1.1" fill="#7d8794" opacity="0.8"/></pattern></defs>` : ''}
      <g transform="rotate(-8 320 196)">
        <ellipse cx="320" cy="286" rx="170" ry="18" fill="#000" opacity="0.25"/>
        <rect x="176" y="174" width="288" height="36" rx="18" fill="${granite ? 'url(#granite)' : 'url(#steel)'}" stroke="#8993a1" stroke-width="3"/>
        <rect x="202" y="148" width="36" height="86" rx="13" fill="url(#steel)" stroke="#7b8593" stroke-width="2"/>
        <rect x="402" y="148" width="36" height="86" rx="13" fill="url(#steel)" stroke="#7b8593" stroke-width="2"/>
        <circle cx="220" cy="159" r="7" fill="#101318" stroke="#aeb7c2" stroke-width="2"/>
        <circle cx="420" cy="159" r="7" fill="#101318" stroke="#aeb7c2" stroke-width="2"/>
        <circle cx="220" cy="225" r="7" fill="#101318" stroke="#aeb7c2" stroke-width="2"/>
        <circle cx="420" cy="225" r="7" fill="#101318" stroke="#aeb7c2" stroke-width="2"/>
        <path d="M196 184 q124 -20 248 0" fill="none" stroke="#ffffff" stroke-width="6" opacity="0.35" stroke-linecap="round"/>
        <path d="M196 204 q124 16 248 0" fill="none" stroke="${accent}" stroke-width="3" opacity="0.8" stroke-linecap="round"/>
      </g>`;
  } else if (accessory.code === 'ACC-02') {
    art = `
      <ellipse cx="320" cy="292" rx="142" ry="24" fill="#000" opacity="0.28"/>
      <ellipse cx="320" cy="238" rx="126" ry="34" fill="url(#inner)" stroke="#7b8593" stroke-width="2"/>
      <ellipse cx="320" cy="232" rx="112" ry="26" fill="#eef2f6" opacity="0.7"/>
      <rect x="258" y="190" width="124" height="44" rx="16" fill="url(#steel)" stroke="#7b8593" stroke-width="3"/>
      <path d="M258 196c0-54 27-78 62-78s62 24 62 78" fill="url(#steel)" stroke="#7b8593" stroke-width="3"/>
      <ellipse cx="320" cy="126" rx="48" ry="13" fill="#2a2e35" opacity="0.9"/>
      <ellipse cx="320" cy="121" rx="22" ry="7" fill="${accent}" opacity="0.8"/>
      <path d="M274 190c8-28 22-44 46-50" fill="none" stroke="#ffffff" stroke-width="7" opacity="0.35" stroke-linecap="round"/>
      <path d="M258 216h124" stroke="${accent}" stroke-width="3" opacity="0.7"/>
    `;
  } else if (accessory.code === 'ACC-03') {
    const bolts = [
      [218, 154],
      [422, 154],
      [218, 270],
      [422, 270],
      [320, 212],
    ]
      .map(
        ([x, y]) => `
          <g transform="translate(${x} ${y})">
            <circle r="34" fill="#0b0e13" opacity="0.35"/>
            <circle r="29" fill="url(#steel)" stroke="#7b8593" stroke-width="3"/>
            <circle r="15" fill="#2b3038" stroke="#aeb7c2" stroke-width="2"/>
            <path d="M-22 0H22M0-22V22" stroke="#11151b" stroke-width="4" stroke-linecap="round"/>
          </g>`,
      )
      .join('');
    art = `<g>${bolts}</g>`;
  } else if (accessory.code === 'ACC-04') {
    art = `
      <ellipse cx="320" cy="292" rx="150" ry="24" fill="#000" opacity="0.25"/>
      <circle cx="320" cy="198" r="134" fill="#d8eef7" opacity="0.55" stroke="#9aa3b2" stroke-width="5"/>
      <circle cx="320" cy="198" r="120" fill="#eaf7fc" opacity="0.35" stroke="#ffffff" stroke-width="3"/>
      <path d="M232 130a120 120 0 0 1 132 -8" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.55" stroke-linecap="round"/>
      <path d="M236 264a120 120 0 0 0 128 12" fill="none" stroke="#9cc6d8" stroke-width="6" opacity="0.55" stroke-linecap="round"/>
      <rect x="292" y="172" width="56" height="24" rx="10" fill="url(#steel)" stroke="#7b8593" stroke-width="2"/>
      <circle cx="320" cy="160" r="25" fill="#22272f" stroke="${accent}" stroke-width="3"/>
      <circle cx="320" cy="160" r="9" fill="${accent}" opacity="0.75"/>
      <path d="M208 160c22-24 52-36 86-38" fill="none" stroke="#ffffff" stroke-width="8" opacity="0.45" stroke-linecap="round"/>
    `;
  } else if (accessory.code === 'ACC-05') {
    art = `
      <ellipse cx="320" cy="288" rx="168" ry="28" fill="#000" opacity="0.24"/>
      <ellipse cx="320" cy="198" rx="148" ry="98" fill="none" stroke="#27313b" stroke-width="38"/>
      <ellipse cx="320" cy="198" rx="148" ry="98" fill="none" stroke="#788692" stroke-width="26"/>
      <ellipse cx="320" cy="194" rx="148" ry="98" fill="none" stroke="#c3ced6" stroke-width="7" opacity="0.5"/>
      <path d="M204 150c26-30 66-46 116-46" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.35" stroke-linecap="round"/>
      <path d="M204 246c26 30 66 46 116 46" fill="none" stroke="${accent}" stroke-width="5" opacity="0.45" stroke-linecap="round"/>
    `;
  } else {
    art = `
      <circle cx="320" cy="196" r="118" fill="url(#steel)" stroke="#7b8593" stroke-width="4"/>
      <circle cx="320" cy="196" r="82" fill="#1a1f27" stroke="${accent}" stroke-width="3"/>
      <circle cx="320" cy="196" r="44" fill="url(#inner)" stroke="#8d95a2" stroke-width="3"/>
      <circle cx="320" cy="196" r="18" fill="${accent}" opacity="0.65"/>
      <path d="M240 134c24-24 54-36 88-36" fill="none" stroke="#ffffff" stroke-width="10" opacity="0.35" stroke-linecap="round"/>
    `;
  }

  return toDataUrl(
    shell(
      art,
      accent,
      accessory.name,
      `${accessory.code} · ${accessory.material} · ${accessory.origin}`,
    ),
  );
}

/** خلفية فاتحة لصور التغليف لتظهر بوضوح داخل جدول الطباعة الصغير. */
const packagingShell = (body: string, accent: string, label: string, meta: string) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 420" width="640" height="420">
  <defs>
    <linearGradient id="pkgBg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbfaf7"/>
      <stop offset="100%" stop-color="#eee9df"/>
    </linearGradient>
  </defs>
  <rect width="640" height="420" fill="url(#pkgBg)"/>
  <circle cx="88" cy="74" r="150" fill="${accent}" opacity="0.1"/>
  <circle cx="556" cy="318" r="140" fill="${accent}" opacity="0.07"/>
  ${body}
  <rect x="28" y="344" width="584" height="52" rx="14" fill="#ffffff" opacity="0.92" stroke="#ddd5c7"/>
  <text x="40" y="366" fill="${accent}" font-family="Arial, sans-serif" font-size="10" font-weight="700" letter-spacing="2.6">ELZONKI PACKAGING</text>
  <text x="40" y="384" fill="#777d87" font-family="Arial, sans-serif" font-size="9" letter-spacing="1">${escapeXml(meta)}</text>
  <text x="600" y="367" text-anchor="end" direction="rtl" fill="#1b1b1e" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="17" font-weight="700">${escapeXml(label)}</text>
</svg>`;

function packagingSvg(row: PackagingRow, index: number): string {
  const code = row.code.toUpperCase();
  const type = `${row.type} ${row.name} ${code}`;
  const isBox = /BOX|كرتون/.test(type);
  const isBag = /BAG|كيس|بوليث/.test(type);
  const isLabel = /LBL|LABEL|STK|استيكر|ملصق|باركود/.test(type);
  const isTape = /TAPE|شريط/.test(type);
  const accent = ['#c98a4b', '#4A90E2', '#a95e6b', '#447a72', '#ec1c24'][index % 5];
  const bars = (x: number, y: number, height = 24) =>
    Array.from({ length: 24 }, (_, bar) => {
      const barWidth = bar % 4 === 0 ? 1.8 : bar % 3 === 0 ? 1.2 : 0.8;
      return `<rect x="${x + bar * 2.6}" y="${y}" width="${barWidth}" height="${height}" fill="#111111"/>`;
    }).join('');
  const dimensions = `${row.lengthCm}×${row.widthCm}×${row.heightCm} سم · ${row.unit || 'قطعة'}`;

  let art = '';
  if (isBox) {
    art = `
      <g>
        <path d="M176 142 L320 88 L464 142 L464 286 L320 340 L176 286 Z" fill="#a86c36" stroke="#7d4e26" stroke-width="3"/>
        <path d="M176 142 L320 196 L464 142 L320 88 Z" fill="#c98a4b" stroke="#7d4e26" stroke-width="3"/>
        <path d="M320 196 L320 340" stroke="#84552b" stroke-width="3" opacity="0.7"/>
        <path d="M176 142 L176 286 L320 340 L320 196 Z" fill="#b97a3f" opacity="0.65"/>
        <path d="M464 142 L464 286 L320 340 L320 196 Z" fill="#8f5a2c" opacity="0.45"/>
        <rect x="228" y="208" width="184" height="82" rx="6" fill="#f6f1e7" stroke="#d8cbb8"/>
        <rect x="228" y="208" width="184" height="15" fill="${accent}"/>
        <text x="320" y="238" text-anchor="middle" fill="#1b1b1e" font-family="Arial, sans-serif" font-size="11" font-weight="700">ELZONKI</text>
        <text x="320" y="253" text-anchor="middle" fill="#6f665a" font-family="Arial, sans-serif" font-size="7.5">${escapeXml(row.code)}</text>
        <g transform="translate(244, 260)">${bars(0, 0, 20)}</g>
        <path d="M320 88 L320 340" stroke="#e8d6bf" stroke-width="14" opacity="0.55"/>
      </g>`;
  } else if (isBag) {
    art = `
      <g>
        <path d="M212 112 H428 L414 302 C412 326 380 340 320 340 C260 340 228 326 226 302 Z" fill="#dbe8f1" stroke="#8fa9bb" stroke-width="3" opacity="0.97"/>
        <path d="M238 124 H402 L390 292 C388 310 362 322 320 322 C278 322 252 310 250 292 Z" fill="#eef5fa" opacity="0.72"/>
        <path d="M252 138 C300 120 370 120 392 142" fill="none" stroke="#ffffff" stroke-width="9" opacity="0.8" stroke-linecap="round"/>
        <rect x="258" y="206" width="124" height="66" rx="5" fill="#ffffff" stroke="#b7c9d6"/>
        <rect x="258" y="206" width="124" height="13" fill="${accent}"/>
        <text x="320" y="236" text-anchor="middle" fill="#1b1b1e" font-family="Arial, sans-serif" font-size="9" font-weight="700">ELZONKI</text>
        <text x="320" y="250" text-anchor="middle" fill="#70808c" font-family="Arial, sans-serif" font-size="7">${escapeXml(row.code)}</text>
        <g transform="translate(272, 256)">${bars(0, 0, 12)}</g>
        <path d="M226 166 H414" stroke="${accent}" stroke-width="2" stroke-dasharray="7 6" opacity="0.6"/>
      </g>`;
  } else if (isLabel) {
    art = `
      <g transform="rotate(-4 320 210)">
        <rect x="186" y="138" width="268" height="150" rx="12" fill="#ffffff" stroke="#c9d2db" stroke-width="2"/>
        <rect x="186" y="138" width="268" height="34" rx="12" fill="${accent}"/>
        <rect x="186" y="158" width="268" height="14" fill="${accent}"/>
        <text x="206" y="161" fill="#ffffff" font-family="Arial, sans-serif" font-size="15" font-weight="700">ELZONKI</text>
        <text x="434" y="161" text-anchor="end" fill="#ffffff" font-family="Arial, sans-serif" font-size="8" letter-spacing="2">PACKAGING</text>
        <text x="206" y="200" fill="#1b1b1e" font-family="Cairo, Tahoma, Arial, sans-serif" font-size="13" font-weight="700">${escapeXml(row.name)}</text>
        <text x="206" y="218" fill="#6f7782" font-family="Arial, sans-serif" font-size="8">${escapeXml(row.code)} · ${escapeXml(dimensions)}</text>
        <g transform="translate(206, 232)">${bars(0, 0, 30)}</g>
        <rect x="388" y="232" width="52" height="34" rx="4" fill="#f1f4f7" stroke="#c9d2db"/>
        <text x="414" y="253" text-anchor="middle" fill="#59636f" font-family="Arial, sans-serif" font-size="8" font-weight="700">QC</text>
      </g>`;
  } else if (isTape) {
    art = `
      <g>
        <circle cx="320" cy="206" r="104" fill="#7d4e26" stroke="#5e3a1c" stroke-width="4"/>
        <circle cx="320" cy="206" r="62" fill="#241a13"/>
        <circle cx="320" cy="206" r="50" fill="#3a2a1e" stroke="#6b4a31" stroke-width="2"/>
        <circle cx="320" cy="206" r="26" fill="url(#steel)" opacity="0.55"/>
        <path d="M320 102 A104 104 0 0 1 424 206 L386 206 A66 66 0 0 0 320 140 Z" fill="${accent}" opacity="0.85"/>
        <path d="M424 206 L520 228 L512 262 L418 240 Z" fill="#e8d6bf" opacity="0.9"/>
        <text x="320" y="193" text-anchor="middle" fill="#ffffff" font-family="Arial, sans-serif" font-size="13" font-weight="700">ELZONKI</text>
        <text x="320" y="210" text-anchor="middle" fill="#d8cbb8" font-family="Arial, sans-serif" font-size="8">${escapeXml(row.code)}</text>
        <text x="320" y="226" text-anchor="middle" fill="#a9927b" font-family="Arial, sans-serif" font-size="7">${escapeXml(dimensions)}</text>
      </g>`;
  } else {
    art = `
      <g>
        <path d="M180 264 L320 210 L460 264 L320 318 Z" fill="#2b3038" stroke="#4b5360" stroke-width="2"/>
        <path d="M196 238 L320 190 L444 238 L320 286 Z" fill="#3a414c" stroke="#59616e" stroke-width="2"/>
        <path d="M212 212 L320 168 L428 212 L320 256 Z" fill="#e3e8ee" stroke="#9aa4b1" stroke-width="2" opacity="0.9"/>
        <path d="M212 212 L320 256 L320 286 L212 238 Z" fill="#c4ccd6" opacity="0.8"/>
        <path d="M428 212 L320 256 L320 286 L428 238 Z" fill="#aab4c0" opacity="0.8"/>
        <g opacity="0.7">
          <path d="M252 194 L320 168 L388 194" fill="none" stroke="${accent}" stroke-width="3"/>
          <path d="M252 212 L320 186 L388 212" fill="none" stroke="${accent}" stroke-width="2"/>
        </g>
        <text x="320" y="278" text-anchor="middle" fill="#1b1b1e" font-family="Arial, sans-serif" font-size="10" font-weight="700">${escapeXml(row.code)}</text>
      </g>`;
  }

  return toDataUrl(
    packagingShell(art, accent, row.name, `${row.code} · ${row.type || 'مادة تغليف'} · ${dimensions}`),
  );
}

export function buildDefaultImages(
  products: Product[],
  machinery: Machinery[],
  molds: Mold[],
  accessories: Accessory[],
  packaging: PackagingRow[],
): FactoryImage[] {
  return [
    ...products.map((product) => ({
      ownerTable: 'products' as const,
      ownerId: product.id,
      dataUrl: STORE_PRODUCT_PHOTOS[product.code] ?? productSvg(product),
      updatedAt: DEFAULT_UPDATED_AT,
    })),
    ...machinery.map((machine, index) => ({
      ownerTable: 'machinery' as const,
      ownerId: machine.id,
      dataUrl: machineSvg(machine, index),
      updatedAt: DEFAULT_UPDATED_AT,
    })),
    ...molds.map((mold, index) => ({
      ownerTable: 'molds' as const,
      ownerId: mold.id,
      dataUrl: moldSvg(mold, index),
      updatedAt: DEFAULT_UPDATED_AT,
    })),
    ...accessories.map((accessory, index) => ({
      ownerTable: 'accessories' as const,
      ownerId: accessory.id,
      dataUrl: accessorySvg(accessory, index),
      updatedAt: DEFAULT_UPDATED_AT,
    })),
    ...packaging.map((row, index) => ({
      ownerTable: 'packaging' as const,
      ownerId: row.id,
      dataUrl: packagingSvg(row, index),
      updatedAt: DEFAULT_UPDATED_AT,
    })),
  ];
}
