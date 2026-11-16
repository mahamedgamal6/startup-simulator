import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Palette, Plus, Ruler, Save, Trash2 } from 'lucide-react';
import { Button, Modal, SectionHeading, cn, useToast } from './ui';
import { makeId, useData } from '../lib/db';
import type { Product, ProductColor, ProductSize, ProductVariant } from '../types';

const num = (value: string): number => {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const Field = ({
  label,
  children,
  wide,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) => (
  <label className={cn('block', wide && 'sm:col-span-2')}>
    <span className="label">{label}</span>
    {children}
  </label>
);

export function VariantsPanel({
  product,
  canEdit,
  selectedVariantId,
  onSelect,
  onSaved,
  addSizeSignal = 0,
}: {
  product: Product;
  canEdit: boolean;
  selectedVariantId?: string;
  onSelect: (variant: ProductVariant | null) => void;
  onSaved: (action: string, detail: string) => void;
  addSizeSignal?: number;
}) {
  const { db, updateProductVariants } = useData();
  const toast = useToast();
  const variants = product.variants ?? [];
  const sizes = useMemo<ProductSize[]>(() => {
    if (product.sizes?.length) return product.sizes.filter((size) => size.active !== false);
    const seen = new Map<string, ProductSize>();
    variants.forEach((variant) => {
      if (!seen.has(variant.sizeId)) {
        seen.set(variant.sizeId, {
          id: variant.sizeId,
          label: variant.sizeLabel,
          sizeCm: variant.sizeCm,
          heightCm: variant.heightCm,
          capacityL: variant.capacityL,
          barcode: variant.barcode,
          active: true,
        });
      }
    });
    return [...seen.values()];
  }, [product.sizes, variants]);
  const colors = useMemo<ProductColor[]>(() => {
    if (product.colors?.length) return product.colors.filter((color) => color.active !== false);
    const seen = new Map<string, ProductColor>();
    variants.forEach((variant) => {
      if (!seen.has(variant.colorId)) {
        seen.set(variant.colorId, {
          id: variant.colorId,
          name: variant.colorName,
          hex: variant.colorHex,
          active: true,
        });
      }
    });
    return [...seen.values()];
  }, [product.colors, variants]);

  const initial = variants.find((variant) => variant.id === selectedVariantId) ?? variants[0];
  const [sizeId, setSizeId] = useState(initial?.sizeId ?? sizes[0]?.id ?? '');
  const [colorId, setColorId] = useState(initial?.colorId ?? colors[0]?.id ?? '');
  const [sizeOpen, setSizeOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [variantOpen, setVariantOpen] = useState(false);
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [sizeDraft, setSizeDraft] = useState({ label: '', sizeCm: '', heightCm: '', capacityL: '' });
  const [colorDraft, setColorDraft] = useState({ name: '', hex: '#c7ccd6', imageUrl: '' });
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickDraft, setQuickDraft] = useState({
    sizeCm: '',
    heightCm: '',
    capacityL: '',
    colorId: '',
  });

  useEffect(() => {
    if (!addSizeSignal) return;
    const tallest = sizes.reduce((max, size) => Math.max(max, size.sizeCm), product.sizeCm);
    setQuickDraft({
      sizeCm: String(tallest + 2),
      heightCm: String(Number((product.heightCm + 1.2).toFixed(1))),
      capacityL: String(Number((product.capacityL * 1.35).toFixed(1))),
      colorId: colors[0]?.id ?? '',
    });
    setQuickOpen(true);
  }, [addSizeSignal]);

  const availableColors = colors.filter((color) =>
    variants.some((variant) => variant.sizeId === sizeId && variant.colorId === color.id),
  );
  const current =
    variants.find((variant) => variant.sizeId === sizeId && variant.colorId === colorId) ??
    variants.find((variant) => variant.sizeId === sizeId) ??
    variants[0];

  const persist = async (
    nextSizes: ProductSize[],
    nextColors: ProductColor[],
    nextVariants: ProductVariant[],
  ) => {
    const ok = await updateProductVariants(product.id, {
      sizes: nextSizes,
      colors: nextColors,
      variants: nextVariants,
    });
    if (!ok) toast('تعذر حفظ المقاسات والألوان', 'error');
    return ok;
  };

  const chooseSize = (id: string) => {
    setSizeId(id);
    const next =
      variants.find((variant) => variant.sizeId === id && variant.colorId === colorId) ??
      variants.find((variant) => variant.sizeId === id) ??
      null;
    if (next) setColorId(next.colorId);
    onSelect(next);
  };

  const chooseColor = (id: string) => {
    setColorId(id);
    onSelect(variants.find((variant) => variant.sizeId === sizeId && variant.colorId === id) ?? null);
  };

  const openVariant = () => {
    const existing =
      variants.find((variant) => variant.sizeId === sizeId && variant.colorId === colorId) ?? null;
    setEditing(existing);
    setDraft({
      sizeLabel: existing?.sizeLabel ?? sizes.find((size) => size.id === sizeId)?.label ?? '',
      sizeCm: String(existing?.sizeCm ?? sizes.find((size) => size.id === sizeId)?.sizeCm ?? product.sizeCm),
      heightCm: String(existing?.heightCm ?? product.heightCm),
      capacityL: String(existing?.capacityL ?? product.capacityL),
      netWeightKg: String(existing?.netWeightKg ?? product.netWeightKg),
      grossWeightKg: String(existing?.grossWeightKg ?? product.grossWeightKg),
      cbm: String(existing?.cbm ?? product.cbm),
      pcsPerCarton: String(existing?.pcsPerCarton ?? product.pcsPerCarton),
      barcode: existing?.barcode ?? product.barcode,
      rawDiscWeightKg: String(existing?.rawDiscWeightKg ?? ''),
      extraCost: String(existing?.extraCost ?? 0),
      cycleSeconds: String(existing?.cycleSeconds ?? ''),
    });
    setVariantOpen(true);
  };

  const saveVariant = async () => {
    if (!sizeId || !colorId) {
      toast('أضف مقاسًا ولونًا أولًا', 'error');
      return;
    }
    const size = sizes.find((item) => item.id === sizeId);
    const color = colors.find((item) => item.id === colorId);
    if (!size || !color) return;
    const next: ProductVariant = {
      id: editing?.id ?? makeId('var'),
      productId: product.id,
      sizeId,
      colorId,
      sizeLabel: draft.sizeLabel || size.label,
      colorName: color.name,
      colorHex: color.hex,
      sizeCm: num(draft.sizeCm) || size.sizeCm,
      heightCm: num(draft.heightCm),
      capacityL: num(draft.capacityL),
      netWeightKg: num(draft.netWeightKg),
      grossWeightKg: num(draft.grossWeightKg),
      cbm: num(draft.cbm),
      pcsPerCarton: Math.max(1, Math.round(num(draft.pcsPerCarton))),
      barcode: draft.barcode.trim(),
      rawDiscWeightKg: draft.rawDiscWeightKg ? num(draft.rawDiscWeightKg) : undefined,
      extraCost: Math.max(0, num(draft.extraCost)),
      cycleSeconds: draft.cycleSeconds ? Math.max(1, Math.round(num(draft.cycleSeconds))) : undefined,
      packagingQty: editing?.packagingQty ?? {},
      active: true,
    };
    const nextVariants = editing
      ? variants.map((variant) => (variant.id === editing.id ? next : variant))
      : [...variants, next];
    const ok = await persist(sizes, colors, nextVariants);
    if (!ok) return;
    onSelect(next);
    onSaved(editing ? 'تعديل تركيبة مقاس/لون' : 'إضافة تركيبة مقاس/لون', `${product.code} — ${next.sizeLabel} / ${next.colorName}`);
    toast(editing ? 'تم تحديث تركيبة المقاس واللون' : 'تمت إضافة تركيبة جديدة');
    setVariantOpen(false);
  };

  const deleteVariant = async () => {
    if (!editing) return;
    const ok = await persist(
      sizes,
      colors,
      variants.filter((variant) => variant.id !== editing.id),
    );
    if (!ok) return;
    onSelect(null);
    onSaved('حذف تركيبة مقاس/لون', `${product.code} — ${editing.sizeLabel} / ${editing.colorName}`);
    toast('تم حذف التركيبة');
    setVariantOpen(false);
  };

  const addSize = async () => {
    if (!sizeDraft.label.trim()) {
      toast('اكتب اسم/مقاس المقاس', 'error');
      return;
    }
    const nextSize: ProductSize = {
      id: makeId('size'),
      label: sizeDraft.label.trim(),
      sizeCm: num(sizeDraft.sizeCm) || product.sizeCm,
      heightCm: num(sizeDraft.heightCm) || product.heightCm,
      capacityL: num(sizeDraft.capacityL),
      barcode: '',
      active: true,
    };
    const ok = await persist([...sizes, nextSize], colors, variants);
    if (!ok) return;
    setSizeId(nextSize.id);
    onSaved('إضافة مقاس منتج', `${product.code} — ${nextSize.label}`);
    toast('تمت إضافة المقاس. أضف تركيبة له لربطه بلون.');
    setSizeOpen(false);
    setSizeDraft({ label: '', sizeCm: '', heightCm: '', capacityL: '' });
  };

  const addQuickSize = async () => {
    const sizeCm = num(quickDraft.sizeCm);
    if (sizeCm <= 0) {
      toast('أدخل مقاسًا صحيحًا بالسنتيمتر', 'error');
      return;
    }
    const color = colors.find((item) => item.id === quickDraft.colorId) ?? colors[0];
    if (!color) {
      toast('أضف لونًا أولًا من لوحة المقاسات والألوان', 'error');
      return;
    }
    const existingSize = sizes.find((size) => Math.abs(size.sizeCm - sizeCm) < 0.01);
    const nextSize: ProductSize =
      existingSize ?? {
        id: makeId('size'),
        label: `${sizeCm} سم`,
        sizeCm,
        heightCm: num(quickDraft.heightCm) || product.heightCm,
        capacityL: num(quickDraft.capacityL) || product.capacityL,
        barcode: '',
        active: true,
      };
    const nextSizes = existingSize ? sizes : [...sizes, nextSize];
    const existingVariant = variants.find(
      (variant) => variant.sizeId === nextSize.id && variant.colorId === color.id,
    );
    if (existingVariant) {
      onSelect(existingVariant);
      setQuickOpen(false);
      toast('هذا المقاس واللون مسجلان بالفعل');
      return;
    }
    const ratio = Math.pow(sizeCm / Math.max(product.sizeCm, 1), 1.8);
    const baseRaw = db.rawMaterials.find((item) => item.productCodes.includes(product.code));
    const nextVariant: ProductVariant = {
      id: makeId('var'),
      productId: product.id,
      sizeId: nextSize.id,
      colorId: color.id,
      sizeLabel: nextSize.label,
      colorName: color.name,
      colorHex: color.hex,
      sizeCm,
      heightCm: nextSize.heightCm,
      capacityL: nextSize.capacityL,
      netWeightKg: Number((product.netWeightKg * ratio).toFixed(3)),
      grossWeightKg: Number((product.grossWeightKg * ratio).toFixed(3)),
      cbm: Number((product.cbm * Math.pow(ratio, 1.2)).toFixed(3)),
      pcsPerCarton: Math.max(
        1,
        Math.round(product.pcsPerCarton / Math.pow(sizeCm / Math.max(product.sizeCm, 1), 1.5)),
      ),
      barcode: product.barcode ? `${product.barcode}-${sizeCm}` : '',
      rawDiscWeightKg: baseRaw
        ? Number((baseRaw.discWeightKg * ratio).toFixed(3))
        : undefined,
      extraCost: 0,
      packagingQty: {},
      active: true,
    };
    const ok = await persist(nextSizes, colors, [...variants, nextVariant]);
    if (!ok) return;
    onSelect(nextVariant);
    onSaved('إضافة مقاس سريع', `${product.code} — ${nextSize.label} / ${color.name}`);
    toast(`تمت إضافة مقاس ${nextSize.label} وتركيبته وتحديث التكلفة`);
    setQuickOpen(false);
  };

  const addColor = async () => {
    if (!colorDraft.name.trim()) {
      toast('اكتب اسم اللون', 'error');
      return;
    }
    const nextColor: ProductColor = {
      id: makeId('color'),
      name: colorDraft.name.trim(),
      hex: colorDraft.hex || '#c7ccd6',
      imageUrl: colorDraft.imageUrl || undefined,
      active: true,
    };
    const ok = await persist(sizes, [...colors, nextColor], variants);
    if (!ok) return;
    setColorId(nextColor.id);
    onSaved('إضافة لون منتج', `${product.code} — ${nextColor.name}`);
    toast('تمت إضافة اللون. أضف تركيبة له لربطه بمقاس.');
    setColorOpen(false);
    setColorDraft({ name: '', hex: '#c7ccd6', imageUrl: '' });
  };

  const pickColorImage = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast('اختر صورة صحيحة للون', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('حجم صورة اللون أكبر من 2 ميجابايت', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setColorDraft((prev) => ({ ...prev, imageUrl: String(reader.result ?? '') }));
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-4">
      <SectionHeading
        title="المقاسات والألوان"
        subtitle="اختر المقاس واللون داخل نفس بطاقة المنتج — تتغير المواصفات والتكلفة والطاقة الإنتاجية فقط دون تغيير المنتج."
        icon={<Palette size={17} />}
        action={
          canEdit ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setSizeOpen(true)}>
                <Plus size={14} /> مقاس
              </Button>
              <Button size="sm" variant="outline" onClick={() => setColorOpen(true)}>
                <Plus size={14} /> لون
              </Button>
              <Button size="sm" variant="outline" onClick={openVariant} disabled={!sizes.length || !colors.length}>
                <Ruler size={14} /> تركيبة
              </Button>
            </div>
          ) : null
        }
      />

      {!sizes.length || !colors.length || !variants.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-mist/50 px-4 py-5 text-center">
          <p className="text-[12px] font-bold text-slate-600">
            لم تُضف تركيبات مقاسات وألوان لهذا المنتج بعد.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            تُستخدم مواصفات المنتج الأساسية ({product.sizeCm} سم) حتى تُضاف التركيبات، ويمكن للمدير
            الإنتاج إضافتها من هنا مباشرة.
          </p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] font-bold text-slate-500">المقاسات المتاحة</p>
              <div className="flex flex-wrap gap-1.5">
                {sizes.map((size) => {
                  const count = variants.filter(
                    (variant) => variant.sizeId === size.id && variant.active !== false,
                  ).length;
                  return (
                    <button
                      key={size.id}
                      onClick={() => chooseSize(size.id)}
                      className={cn(
                        'rounded-xl border px-3 py-2 text-[11px] font-bold transition',
                        size.id === sizeId
                          ? 'border-brand bg-brand text-white shadow-sm'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40 hover:text-brand',
                      )}
                    >
                      <span className="num block">{size.label}</span>
                      <span className={cn('mt-0.5 block text-[9px]', size.id === sizeId ? 'text-white/70' : 'text-slate-400')}>
                        {count} لون متاح
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-bold text-slate-500">الألوان المتاحة لهذا المقاس</p>
              <div className="flex flex-wrap gap-1.5">
                {availableColors.length ? (
                  availableColors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => chooseColor(color.id)}
                      className={cn(
                        'flex items-center gap-2 rounded-xl border px-2.5 py-2 text-[11px] font-bold transition',
                        color.id === colorId
                          ? 'border-brand bg-brand-soft text-brand-dark'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand/40',
                      )}
                    >
                      {color.imageUrl ? (
                        <img src={color.imageUrl} alt={color.name} className="h-5 w-5 rounded-full object-cover" />
                      ) : (
                        <span
                          className="h-4 w-4 rounded-full border border-black/10"
                          style={{ background: color.hex }}
                        />
                      )}
                      {color.name}
                    </button>
                  ))
                ) : (
                  <span className="text-[11px] text-slate-400">لا يوجد لون مرتبط بهذا المقاس.</span>
                )}
              </div>
            </div>
          </div>

          {current ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {[
                { label: 'المقاس', value: `${current.sizeCm} سم` },
                { label: 'الارتفاع', value: `${current.heightCm} سم` },
                { label: 'السعة', value: `${current.capacityL} لتر` },
                { label: 'الوزن الصافي', value: `${current.netWeightKg} كجم` },
                { label: 'بعد التعبئة', value: `${current.grossWeightKg} كجم` },
                { label: 'CBM', value: `${current.cbm}` },
                { label: 'القطع/كرتونة', value: `${current.pcsPerCarton}` },
              ].map((item) => (
                <div key={item.label} className="rounded-xl bg-mist/70 px-3 py-2">
                  <p className="text-[9px] font-bold text-slate-400">{item.label}</p>
                  <p className="num mt-0.5 text-[12px] font-extrabold text-ink">{item.value}</p>
                </div>
              ))}
            </div>
          ) : null}
        </>
      )}

      <Modal
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        title="إضافة مقاس لهذا المنتج"
        subtitle="يُنشئ المقاس وتركيبته مباشرة ويحدّث التكلفة دون تغيير كود المنتج."
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuickOpen(false)}>إلغاء</Button>
            <Button onClick={addQuickSize}><Save size={15} /> إضافة المقاس</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="المقاس (سم)">
            <input className="input num" inputMode="decimal" value={quickDraft.sizeCm} onChange={(e) => setQuickDraft({ ...quickDraft, sizeCm: e.target.value })} />
          </Field>
          <Field label="اللون">
            <select className="input" value={quickDraft.colorId} onChange={(e) => setQuickDraft({ ...quickDraft, colorId: e.target.value })}>
              {colors.map((color) => (
                <option key={color.id} value={color.id}>{color.name}</option>
              ))}
            </select>
          </Field>
          <Field label="الارتفاع (سم)">
            <input className="input num" inputMode="decimal" value={quickDraft.heightCm} onChange={(e) => setQuickDraft({ ...quickDraft, heightCm: e.target.value })} />
          </Field>
          <Field label="السعة (لتر)">
            <input className="input num" inputMode="decimal" value={quickDraft.capacityL} onChange={(e) => setQuickDraft({ ...quickDraft, capacityL: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={sizeOpen}
        onClose={() => setSizeOpen(false)}
        title="إضافة مقاس جديد"
        subtitle="المقاس معرف مستقل داخل نفس المنتج، وله مواصفاته وتركيبته."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSizeOpen(false)}>إلغاء</Button>
            <Button onClick={addSize}><Save size={15} /> حفظ المقاس</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم/وصف المقاس" wide>
            <input className="input" value={sizeDraft.label} onChange={(e) => setSizeDraft({ ...sizeDraft, label: e.target.value })} placeholder="مثال: 24 سم" />
          </Field>
          <Field label="المقاس (سم)">
            <input className="input num" inputMode="decimal" value={sizeDraft.sizeCm} onChange={(e) => setSizeDraft({ ...sizeDraft, sizeCm: e.target.value })} />
          </Field>
          <Field label="الارتفاع (سم)">
            <input className="input num" inputMode="decimal" value={sizeDraft.heightCm} onChange={(e) => setSizeDraft({ ...sizeDraft, heightCm: e.target.value })} />
          </Field>
          <Field label="السعة (لتر)">
            <input className="input num" inputMode="decimal" value={sizeDraft.capacityL} onChange={(e) => setSizeDraft({ ...sizeDraft, capacityL: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal
        open={colorOpen}
        onClose={() => setColorOpen(false)}
        title="إضافة لون جديد"
        subtitle="يمكن اختيار اللون من عينة لونية وإضافة صورة توضيحية عند الحاجة."
        footer={
          <>
            <Button variant="ghost" onClick={() => setColorOpen(false)}>إلغاء</Button>
            <Button onClick={addColor}><Save size={15} /> حفظ اللون</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="اسم اللون" wide>
            <input className="input" value={colorDraft.name} onChange={(e) => setColorDraft({ ...colorDraft, name: e.target.value })} placeholder="مثال: أسود مطفي" />
          </Field>
          <Field label="العينة اللونية">
            <input type="color" className="h-10 w-full rounded-xl border border-slate-200 bg-white p-1" value={colorDraft.hex} onChange={(e) => setColorDraft({ ...colorDraft, hex: e.target.value })} />
          </Field>
          <Field label="صورة توضيحية للون (اختياري)">
            <input type="file" accept="image/*" onChange={(e) => pickColorImage(e.target.files?.[0])} className="input text-[11px]" />
          </Field>
          {colorDraft.imageUrl ? (
            <img src={colorDraft.imageUrl} alt="لون" className="h-16 w-16 rounded-xl object-cover sm:col-span-2" />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={variantOpen}
        onClose={() => setVariantOpen(false)}
        title={editing ? 'تعديل تركيبة مقاس/لون' : 'إضافة تركيبة مقاس/لون'}
        subtitle={`${sizes.find((size) => size.id === sizeId)?.label ?? ''} — ${colors.find((color) => color.id === colorId)?.name ?? ''}`}
        size="lg"
        footer={
          <>
            {editing ? (
              <Button variant="danger" onClick={deleteVariant}><Trash2 size={14} /> حذف التركيبة</Button>
            ) : null}
            <Button variant="ghost" onClick={() => setVariantOpen(false)}>إلغاء</Button>
            <Button onClick={saveVariant}><Save size={15} /> حفظ التركيبة</Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="وصف المقاس" wide>
            <input className="input" value={draft.sizeLabel} onChange={(e) => setDraft({ ...draft, sizeLabel: e.target.value })} />
          </Field>
          <Field label="المقاس (سم)">
            <input className="input num" value={draft.sizeCm} onChange={(e) => setDraft({ ...draft, sizeCm: e.target.value })} />
          </Field>
          <Field label="الارتفاع (سم)">
            <input className="input num" value={draft.heightCm} onChange={(e) => setDraft({ ...draft, heightCm: e.target.value })} />
          </Field>
          <Field label="السعة (لتر)">
            <input className="input num" value={draft.capacityL} onChange={(e) => setDraft({ ...draft, capacityL: e.target.value })} />
          </Field>
          <Field label="الوزن الصافي (كجم)">
            <input className="input num" value={draft.netWeightKg} onChange={(e) => setDraft({ ...draft, netWeightKg: e.target.value })} />
          </Field>
          <Field label="الوزن بعد التعبئة (كجم)">
            <input className="input num" value={draft.grossWeightKg} onChange={(e) => setDraft({ ...draft, grossWeightKg: e.target.value })} />
          </Field>
          <Field label="حجم الكرتونة CBM">
            <input className="input num" value={draft.cbm} onChange={(e) => setDraft({ ...draft, cbm: e.target.value })} />
          </Field>
          <Field label="القطع/كرتونة">
            <input className="input num" value={draft.pcsPerCarton} onChange={(e) => setDraft({ ...draft, pcsPerCarton: e.target.value })} />
          </Field>
          <Field label="الباركود">
            <input className="input num" value={draft.barcode} onChange={(e) => setDraft({ ...draft, barcode: e.target.value })} />
          </Field>
          <Field label="وزن قرص الخام لهذه التركيبة (كجم)">
            <input className="input num" value={draft.rawDiscWeightKg} onChange={(e) => setDraft({ ...draft, rawDiscWeightKg: e.target.value })} placeholder="اتركه فارغًا لاستخدام قرص المنتج" />
          </Field>
          <Field label="فرق تكلفة اللون/الخامة (ج.م)">
            <input className="input num" value={draft.extraCost} onChange={(e) => setDraft({ ...draft, extraCost: e.target.value })} />
          </Field>
          <Field label="زمن التشغيل للقطعة (ثانية)">
            <input className="input num" value={draft.cycleSeconds} onChange={(e) => setDraft({ ...draft, cycleSeconds: e.target.value })} placeholder="فارغ = زمن رحلة التصنيع" />
          </Field>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          كل تركيبة تُحسب تكلفتها من قرص الخام الخاص بها ومواد التعبئة المرتبطة وحصة الكرتونة حسب
          عدد القطع/كرتونة، ولا تُستخدم تكلفة مقاس أو لون آخر.
        </p>
      </Modal>
    </div>
  );
}
