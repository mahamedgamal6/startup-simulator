import type { CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { BrandMark, ProductArt } from './ProductArt';
import { Button } from './ui';
import { useData } from '../lib/db';
import { docDate, fmt, fmt1, money, pct } from '../lib/format';
import {
  discCostOf,
  economicsOf,
  findCostForProduct,
  findPackagingForProduct,
  findRawForProduct,
} from '../lib/cost';
import { buildJourney, cycleSeconds, formatCycle } from '../lib/journey';
import { QUALITY_CHECKS } from '../data/quality';

export interface PrintPayload {
  code: string;
  mode: 'cost' | 'technical';
}

export function PrintSheet({
  payload,
  onClose,
}: {
  payload: PrintPayload | null;
  onClose: () => void;
}) {
  const { db } = useData();
  if (!payload) return null;

  const product = db.products.find((item) => item.code === payload.code);
  if (!product) return null;

  const raw = findRawForProduct(db, product.code);
  const packaging = findPackagingForProduct(db, product.code);
  const cost = findCostForProduct(db, product.code);
  const econ = economicsOf(cost, db.settings.aluminumFactor, db.settings.marginPct);
  const stages = buildJourney(product, db.machinery, db.molds);
  const cycle = cycleSeconds(stages);
  const isCost = payload.mode === 'cost';
  const inspections = db.inspections.filter((item) => item.productCode === product.code);
  const mold = db.molds.find((item) => item.sizeCm === product.sizeCm);

  const printStyle = {
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  } as CSSProperties;

  const title = isCost ? 'بطاقة التكلفة والمواصفات الرسمية' : 'البطاقة الفنية وخطة الفحص';

  return createPortal(
    <div className="print-overlay fixed inset-0 z-[100] overflow-y-auto bg-slate-800/60 p-4 sm:p-8">
      <div className="print-toolbar mx-auto mb-4 flex max-w-[820px] items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-xl">
        <div>
          <p className="text-[13px] font-extrabold text-ink">معاينة الطباعة</p>
          <p className="text-[10px] font-medium text-slate-500">
            استخدم «طباعة / حفظ PDF» ثم اختر حفظ كملف PDF من نافذة الطباعة.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={15} /> إغلاق
          </Button>
          <Button size="sm" onClick={() => window.print()}>
            <Printer size={15} /> طباعة / حفظ PDF
          </Button>
        </div>
      </div>

      <div
        className="print-sheet mx-auto max-w-[820px] rounded-xl bg-white p-7 text-ink shadow-2xl sm:p-10"
        style={printStyle}
        dir="rtl"
      >
        {/* Header */}
        <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-4">
          <div className="flex items-center gap-3">
            <BrandMark className="h-12 w-12" />
            <div>
              <h1 className="text-[17px] font-black leading-tight">مصانع الزنوكي للأواني المنزلية</h1>
              <p className="text-[10px] font-semibold text-slate-500">
                قطاع التصنيع والتكاليف الصناعية — وثيقة داخلية معتمدة
              </p>
            </div>
          </div>
          <div className="text-left text-[10px] font-semibold text-slate-500">
            <p className="rounded bg-ink px-2 py-1 text-white">ELZ-PP/{product.code}</p>
            <p className="mt-1">تاريخ الإصدار: {docDate()}</p>
            <p>إصدار رقم: 03</p>
          </div>
        </header>

        <div className="mt-4 flex items-center justify-between border-b border-slate-300 pb-3">
          <h2 className="text-[15px] font-black text-brand">{title}</h2>
          <span className="text-[10px] font-bold text-slate-500">
            {isCost ? 'سري — للاستخدام الداخلي' : 'نسخة فنية — إدارة الجودة'}
          </span>
        </div>

        {/* Identity */}
        <section className="mt-4 flex items-center gap-4 rounded-lg border border-slate-300 p-3">
          <div className="flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-lg bg-slate-50">
            <ProductArt product={product} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <h3 className="text-[16px] font-black">{product.name}</h3>
              <span className="text-[11px] font-bold text-slate-500">
                {product.sizeCm} سم — خط {product.family}
              </span>
            </div>
            <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] sm:grid-cols-4">
              <p>
                <span className="font-semibold text-slate-500">كود المنتج: </span>
                <span className="num font-black">{product.code}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">الباركود: </span>
                <span className="num font-black">{product.barcode}</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">السعة: </span>
                <span className="num font-black">{fmt1(product.capacityL)} لتر</span>
              </p>
              <p>
                <span className="font-semibold text-slate-500">الوزن الصافي: </span>
                <span className="num font-black">{fmt1(product.netWeightKg * 1000)} جم</span>
              </p>
            </div>
          </div>
        </section>

        {/* Specs */}
        <section className="mt-4">
          <h4 className="mb-2 border-r-4 border-brand pr-2 text-[12px] font-black">
            المواصفات والمقاسات
          </h4>
          <table className="w-full border-collapse text-[10px]">
            <tbody>
              {[
                [
                  ['المقاس', `${fmt(product.sizeCm)} سم`],
                  ['الارتفاع', `${fmt1(product.heightCm)} سم`],
                  ['السعة', `${fmt1(product.capacityL)} لتر`],
                  ['الوزن الصافي', `${fmt1(product.netWeightKg)} كجم`],
                  ['الوزن بعد التعبئة', `${fmt1(product.grossWeightKg)} كجم`],
                  ['عدد القطع بالكرتونة', `${fmt(product.pcsPerCarton)} قطعة`],
                ],
                [
                  ['حجم الكرتونة', `${product.cbm} CBM`],
                  ['حجم الكرتونة الكاملة', `${fmt1(product.grossWeightKg * product.pcsPerCarton)} كجم`],
                  ['عائلة المنتج', product.family],
                  ['كود القرص', raw?.code ?? '—'],
                  ['الإسطمبة', mold?.code ?? '—'],
                  ['زمن الدورة', formatCycle(cycle)],
                ],
              ].map((row, rowIndex) => (
                <tr key={rowIndex} className="border border-slate-300">
                  {row.map(([label, value]) => (
                    <td key={label} className="border border-slate-300 p-1.5">
                      <span className="block text-[8px] font-bold text-slate-500">{label}</span>
                      <span className="num text-[10px] font-extrabold">{value}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Material & packaging */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <div>
            <h4 className="mb-2 border-r-4 border-brand pr-2 text-[12px] font-black">
              مادة الخام المباشرة
            </h4>
            <table className="w-full border-collapse text-[10px]">
              <tbody>
                {[
                  ['السبيكة', raw?.alloy ?? '—'],
                  ['قطر القرص', raw ? `${fmt(raw.diameterCm)} سم` : '—'],
                  ['سُمك الخام', raw ? `${fmt1(raw.thicknessMm)} مم` : '—'],
                  ['وزن القرص النظري', raw ? `${raw.discWeightKg.toFixed(3)} كجم` : '—'],
                  ['نسبة الهالك', raw ? pct(raw.wastePct) : '—'],
                  ['سعر الكيلو', raw ? `${money(raw.pricePerKg)} ج.م` : '—'],
                  ['تكلفة القرص', raw ? `${money(discCostOf(raw, db.settings.aluminumFactor))} ج.م` : '—'],
                ].map(([label, value]) => (
                  <tr key={label} className="border border-slate-300">
                    <td className="w-1/2 border border-slate-300 bg-slate-50 p-1.5 font-bold text-slate-600">
                      {label}
                    </td>
                    <td className="border border-slate-300 p-1.5 font-extrabold num">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div>
            <h4 className="mb-2 border-r-4 border-brand pr-2 text-[12px] font-black">
              التعبئة والتغليف
            </h4>
            <table className="w-full border-collapse text-[10px]">
              <tbody>
                {[
                  ['حجم الكرتونة', `${product.cbm} CBM`],
                  ['وزن الكرتونة الكاملة', `${fmt1(product.grossWeightKg * product.pcsPerCarton)} كجم`],
                  ['القطع الداخلية', `${fmt(product.pcsPerCarton)} قطعة`],
                  ...packaging.slice(0, 3).map((item) => [
                    item.code,
                    isCost ? `${money(item.unitCost)} ج.م` : item.name,
                  ]),
                ].map(([label, value]) => (
                  <tr key={String(label)} className="border border-slate-300">
                    <td className="w-1/2 border border-slate-300 bg-slate-50 p-1.5 font-bold text-slate-600 num">
                      {label}
                    </td>
                    <td className="border border-slate-300 p-1.5 font-extrabold num">{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Cost */}
        {isCost ? (
          <section className="mt-4 print-break">
            <h4 className="mb-2 border-r-4 border-brand pr-2 text-[12px] font-black">
              تفكيك التكلفة الصناعية
            </h4>
            <table className="w-full border-collapse text-[10px]">
              <thead>
                <tr className="bg-ink text-white">
                  <th className="border border-slate-400 p-1.5 text-right">عنصر التكلفة</th>
                  <th className="border border-slate-400 p-1.5 text-right">القيمة (ج.م)</th>
                  <th className="border border-slate-400 p-1.5 text-right">النسبة</th>
                </tr>
              </thead>
              <tbody>
                {econ.components.map((item) => (
                  <tr key={item.key}>
                    <td className="border border-slate-300 p-1.5 font-bold">{item.label}</td>
                    <td className="num border border-slate-300 p-1.5 font-extrabold">
                      {money(item.value)}
                    </td>
                    <td className="num border border-slate-300 p-1.5">
                      {pct(econ.total ? (item.value / econ.total) * 100 : 0, 1)}
                    </td>
                  </tr>
                ))}
                <tr className="bg-slate-100">
                  <td className="border border-slate-300 p-1.5 font-black">إجمالي التكلفة التقديرية</td>
                  <td className="num border border-slate-300 p-1.5 font-black">
                    {money(econ.total)}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-black">100%</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px]">
              <div className="rounded border border-slate-300 p-2">
                <span className="block font-bold text-slate-500">سعر البيع المقترح</span>
                <span className="num text-[13px] font-black">{money(econ.price)} ج.م</span>
              </div>
              <div className="rounded border border-slate-300 p-2">
                <span className="block font-bold text-slate-500">ربح القطعة</span>
                <span className="num text-[13px] font-black">{money(econ.profit)} ج.م</span>
              </div>
              <div className="rounded border border-slate-300 p-2">
                <span className="block font-bold text-slate-500">هامش الربح المستهدف</span>
                <span className="num text-[13px] font-black">{fmt(econ.marginPct)}%</span>
              </div>
            </div>
          </section>
        ) : null}

        {/* Journey */}
        <section className="mt-4 print-break">
          <h4 className="mb-2 border-r-4 border-brand pr-2 text-[12px] font-black">
            مسار التصنيع المعتمد — 17 مرحلة
          </h4>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[9px]">
            {stages.map((stage, index) => (
              <div
                key={stage.key}
                className="flex items-baseline justify-between gap-2 border-b border-dotted border-slate-300 py-1"
              >
                <span className="font-bold">
                  <span className="num inline-block w-4 text-slate-400">{index + 1}.</span>
                  {stage.name}
                </span>
                <span className="num shrink-0 text-slate-500">
                  {stage.machineCode ? `م ${stage.machineCode}` : 'يدوي'} · {stage.workers} عمال ·{' '}
                  {stage.seconds}ث
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between rounded bg-slate-100 px-2 py-1.5 text-[10px] font-bold">
            <span>إجمالي زمن التصنيع للقطعة</span>
            <span className="num">{formatCycle(cycle)}</span>
          </div>
        </section>

        {/* Quality */}
        <section className="mt-4 print-break">
          <h4 className="mb-2 border-r-4 border-brand pr-2 text-[12px] font-black">
            نقاط الفحص والاختبار
          </h4>
          <div className="grid grid-cols-2 gap-x-5 gap-y-1 text-[9px]">
            {QUALITY_CHECKS.map((check, index) => {
              const result = inspections.find((item) => item.checkId === check.id);
              return (
                <div
                  key={check.id}
                  className="flex items-center justify-between gap-2 border-b border-dotted border-slate-300 py-1"
                >
                  <span>
                    <span className="num inline-block w-4 text-slate-400">{index + 1}.</span>
                    {check.label}
                  </span>
                  <span className="shrink-0 font-bold">
                    {result
                      ? result.status === 'pass'
                        ? 'مطابق ✓'
                        : result.status === 'fail'
                          ? 'غير مطابق ✗'
                          : 'هالك إصلاح ⟳'
                      : 'لم يُفحص —'}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* Signatures */}
        <section className="mt-6 grid grid-cols-3 gap-4 text-center text-[9px]">
          {['مدير الإنتاج', 'المدير المالي', 'مشرف الجودة'].map((role) => (
            <div key={role}>
              <div className="mb-8 h-8 border-b border-slate-400" />
              <p className="font-bold text-slate-600">{role}</p>
              <p className="text-[8px] text-slate-400">التوقيع والتاريخ</p>
            </div>
          ))}
        </section>

        <footer className="mt-5 flex items-center justify-between border-t border-slate-300 pt-2 text-[8px] font-semibold text-slate-400">
          <span>مصانع الزنوكي للأواني المنزلية — نظام إدارة التكاليف الصناعية</span>
          <span className="num">ELZ-PP/{product.code} — {docDate()}</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
