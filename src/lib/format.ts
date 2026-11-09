const numberFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const oneDecimalFormatter = new Intl.NumberFormat('ar-EG-u-nu-latn', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 1,
});

export function fmt(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return numberFormatter.format(value);
}

export function fmt1(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return oneDecimalFormatter.format(value);
}

export function money(value: number | undefined | null): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return decimalFormatter.format(value);
}

export function pct(value: number | undefined | null, digits = 1): string {
  if (value === undefined || value === null || Number.isNaN(value)) return '—';
  return `${new Intl.NumberFormat('ar-EG-u-nu-latn', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value)}%`;
}

export function todayLong(): string {
  return new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());
}

export function docDate(): string {
  const d = new Date();
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(
    d.getDate(),
  ).padStart(2, '0')}`;
}

export function fileStamp(): string {
  return new Date().toISOString().slice(0, 10);
}
