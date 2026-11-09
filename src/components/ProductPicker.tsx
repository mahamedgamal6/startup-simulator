import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, PackageSearch } from 'lucide-react';
import type { Product } from '../types';
import { useData } from '../lib/db';
import { FAMILY_COLORS, ProductArt } from './ProductArt';
import { Badge, SearchInput, cn } from './ui';

export function ProductPicker({
  products,
  value,
  onChange,
  compact = false,
  className,
}: {
  products: Product[];
  value: string;
  onChange: (code: string) => void;
  compact?: boolean;
  className?: string;
}) {
  const { db } = useData();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  const imageUrl = (product?: Product) =>
    product
      ? db.images.find(
          (image) => image.ownerTable === 'products' && image.ownerId === product.id,
        )?.dataUrl
      : undefined;

  const current = products.find((product) => product.code === value) ?? products[0];

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      [product.name, product.code, product.barcode, product.family]
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [products, query]);

  const sizes = useMemo(
    () => Array.from(new Set(products.map((product) => product.sizeCm))).sort((a, b) => a - b),
    [products],
  );

  const pickSize = (size: number) => {
    if (current?.sizeCm === size) return;
    const candidate =
      products.find(
        (product) => product.sizeCm === size && product.family === current?.family,
      ) ?? products.find((product) => product.sizeCm === size);
    if (candidate) onChange(candidate.code);
  };

  return (
    <div className={cn('space-y-3', className)} ref={containerRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-right shadow-sm transition hover:border-brand/40 hover:shadow-md"
        >
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl"
            style={{ background: FAMILY_COLORS[current?.family ?? 'باور']?.soft }}
          >
            {imageUrl(current) ? (
              <img
                src={imageUrl(current)}
                alt={current?.name ?? ''}
                className="h-full w-full object-cover"
              />
            ) : current ? (
              <ProductArt product={current} className="h-10 w-10" />
            ) : null}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-extrabold text-ink">
              {current?.name ?? 'اختر منتجًا'}
            </span>
            <span className="mt-0.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
              <span className="num">{current?.code}</span>
              <span className="text-slate-300">•</span>
              <span>مقاس {current?.sizeCm} سم</span>
              <span className="text-slate-300">•</span>
              <span>{current?.capacityL} لتر</span>
            </span>
          </span>
          <ChevronDown
            size={18}
            className={cn('shrink-0 text-slate-400 transition-transform', open && 'rotate-180')}
          />
        </button>

        {open ? (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] z-50 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-up">
            <div className="border-b border-slate-100 p-3">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="ابحث باسم المنتج أو الكود أو الباركود..."
                autoFocus
              />
            </div>
            <div className="scrollbar-thin max-h-72 overflow-y-auto p-2">
              {filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                  <PackageSearch size={22} className="text-slate-300" />
                  <p className="text-xs font-semibold text-slate-500">لا يوجد منتج مطابق</p>
                </div>
              ) : (
                filtered.map((product) => {
                  const active = product.code === current?.code;
                  return (
                    <button
                      key={product.code}
                      type="button"
                      onClick={() => {
                        onChange(product.code);
                        setOpen(false);
                        setQuery('');
                      }}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-right transition',
                        active ? 'bg-brand-soft' : 'hover:bg-slate-50',
                      )}
                    >
                      <span
                        className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg"
                        style={{ background: FAMILY_COLORS[product.family]?.soft }}
                      >
                        {imageUrl(product) ? (
                          <img
                            src={imageUrl(product)}
                            alt={product.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <ProductArt product={product} className="h-9 w-9" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-bold text-ink">
                          {product.name}
                        </span>
                        <span className="mt-0.5 block text-[11px] font-medium text-slate-500">
                          <span className="num">{product.code}</span> · {product.family} ·{' '}
                          {product.sizeCm} سم
                        </span>
                      </span>
                      {active ? <Check size={16} className="text-brand" /> : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </div>

      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-slate-500">المقاس:</span>
          {sizes.map((size) => {
            const active = current?.sizeCm === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => pickSize(size)}
                className={cn('chip', active ? 'chip-active' : 'chip-muted')}
              >
                <span className="num">{size}</span>
                <span className="text-[10px] opacity-70">سم</span>
              </button>
            );
          })}
          {current ? (
            <Badge tone="slate" className="mr-auto">
              {current.family}
            </Badge>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
