import type { Accessory, FactoryImage, Machinery, Mold, Product } from '../types';
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

export function buildDefaultImages(
  products: Product[],
  machinery: Machinery[],
  molds: Mold[],
  accessories: Accessory[],
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
  ];
}
