import type { Product, ProductFamily } from '../types';
import { cn } from './ui';

export const FAMILY_COLORS: Record<ProductFamily, { color: string; soft: string }> = {
  باور: { color: '#ec1c24', soft: '#fdecec' },
  'باور بلس': { color: '#ec1c24', soft: '#fdecec' },
  'برايم استانلس': { color: '#a95e6b', soft: '#f6ecee' },
  'كراون تيتانيوم': { color: '#447a72', soft: '#e9f2f0' },
  'إيلورا جرانيت': { color: '#4A90E2', soft: '#eaf3fd' },
  'صينية فرن': { color: '#4A90E2', soft: '#eaf3fd' },
};

export function BrandMark({ className, light = false }: { className?: string; light?: boolean }) {
  return (
    <svg viewBox="0 0 48 48" className={cn('h-10 w-10', className)} aria-hidden>
      <defs>
        <linearGradient id="brandMarkBg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={light ? '#ffffff' : '#ff3b42'} />
          <stop offset="100%" stopColor={light ? '#ffe3e4' : '#c5141b'} />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="14" fill="url(#brandMarkBg)" />
      <path
        d="M13 17.5h22v11.2a9.3 9.3 0 0 1-9.3 9.3h-3.4A9.3 9.3 0 0 1 13 28.7V17.5Z"
        fill={light ? '#ec1c24' : '#fff'}
        opacity="0.96"
      />
      <rect x="19.5" y="12" width="9" height="3.6" rx="1.8" fill={light ? '#ec1c24' : '#fff'} opacity="0.8" />
      <path
        d="M13 22.4h22"
        stroke={light ? '#ffffff' : '#ec1c24'}
        strokeWidth="1.4"
        opacity="0.55"
      />
    </svg>
  );
}

export function ProductArt({
  product,
  className,
}: {
  product: Product;
  className?: string;
}) {
  const isTray = product.family === 'صينية فرن';
  const accent = FAMILY_COLORS[product.family]?.color ?? '#ec1c24';
  const id = product.code;

  return (
    <svg
      viewBox="0 0 220 180"
      className={cn('h-full w-full', className)}
      role="img"
      aria-label={`صورة ${product.name} مقاس ${product.sizeCm} سم`}
    >
      <defs>
        <linearGradient id={`steel-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fbfcfd" />
          <stop offset="26%" stopColor="#dfe3e9" />
          <stop offset="52%" stopColor="#aab1bd" />
          <stop offset="74%" stopColor="#eef1f5" />
          <stop offset="100%" stopColor="#9ba3b0" />
        </linearGradient>
        <linearGradient id={`inner-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#9aa2ae" />
          <stop offset="45%" stopColor="#d8dde4" />
          <stop offset="100%" stopColor="#b7bec9" />
        </linearGradient>
        <radialGradient id={`halo-${id}`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.22" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="110" cy="94" rx="96" ry="76" fill={`url(#halo-${id})`} />

      {isTray ? (
        <g>
          <ellipse cx="110" cy="118" rx="76" ry="22" fill="#b7bec9" opacity="0.35" />
          <path
            d="M34 88c0-6 34-14 76-14s76 8 76 14l-6 26c-3 12-33 20-70 20s-67-8-70-20l-6-26Z"
            fill={`url(#steel-${id})`}
            stroke="#8d95a2"
            strokeWidth="1.2"
          />
          <ellipse cx="110" cy="88" rx="76" ry="15" fill={`url(#inner-${id})`} />
          <ellipse cx="110" cy="88" rx="66" ry="12" fill="#e9edf2" opacity="0.65" />
          <ellipse cx="110" cy="87" rx="52" ry="9" fill="#fff" opacity="0.35" />
          <path
            d="M40 92c14 6 44 9 70 9s56-3 70-9"
            stroke={accent}
            strokeWidth="3"
            fill="none"
            opacity="0.75"
            strokeLinecap="round"
          />
          <path
            d="M42 108c16 7 42 10 68 10s52-3 68-10"
            stroke="#ffffff"
            strokeWidth="4"
            opacity="0.4"
            fill="none"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g>
          <ellipse cx="110" cy="150" rx="62" ry="11" fill="#aeb5c0" opacity="0.3" />

          {/* handles */}
          <path
            d="M42 82c-14 0-22 8-22 18s8 18 22 18"
            fill="none"
            stroke="#8f97a4"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M42 82c-14 0-22 8-22 18s8 18 22 18"
            fill="none"
            stroke="#e6e9ee"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d="M178 82c14 0 22 8 22 18s-8 18-22 18"
            fill="none"
            stroke="#8f97a4"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M178 82c14 0 22 8 22 18s-8 18-22 18"
            fill="none"
            stroke="#e6e9ee"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* body */}
          <path
            d="M46 70h128l-7 60c-1.6 13-14 17-57 17s-55.4-4-57-17l-7-60Z"
            fill={`url(#steel-${id})`}
            stroke="#8d95a2"
            strokeWidth="1.2"
          />
          <ellipse cx="110" cy="70" rx="64" ry="15" fill={`url(#inner-${id})`} />
          <ellipse cx="110" cy="69" rx="55" ry="11" fill="#eff2f6" opacity="0.8" />
          <ellipse cx="110" cy="68" rx="40" ry="7" fill="#fff" opacity="0.4" />

          {/* accent line + highlight */}
          <path
            d="M50 92c18 7 38 10 60 10s42-3 60-10"
            stroke={accent}
            strokeWidth="3.5"
            fill="none"
            opacity="0.8"
            strokeLinecap="round"
          />
          <path
            d="M52 78c16 9 34 13 58 13"
            stroke="#ffffff"
            strokeWidth="5"
            opacity="0.5"
            fill="none"
            strokeLinecap="round"
          />

          {/* lid */}
          <path
            d="M46 70c0-12 28-22 64-22s64 10 64 22"
            fill={`url(#steel-${id})`}
            stroke="#8d95a2"
            strokeWidth="1.2"
          />
          <ellipse cx="110" cy="48" rx="26" ry="7" fill={`url(#inner-${id})`} opacity="0.9" />
          <rect x="98" y="32" width="24" height="8" rx="4" fill="#2b2d31" />
          <circle cx="110" cy="30" r="4" fill={accent} />

          {/* glass shine */}
          <path
            d="M150 84c-4 18-5 36-6 50"
            stroke="#ffffff"
            strokeWidth="6"
            opacity="0.28"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}
    </svg>
  );
}
