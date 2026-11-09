import { Fragment, useEffect, useRef, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import JsBarcode from 'jsbarcode';
import { BrandMark, ProductArt } from './ProductArt';
import { Button } from './ui';
import { useData } from '../lib/db';
import { docDate, fmt, fmt1, money, pct } from '../lib/format';
import {
  containerLoads,
  discCostOf,
  economicsOf,
  findPackagingForProduct,
  findRawForProduct,
  findSpraysForProduct,
} from '../lib/cost';
import { buildJourney, cycleSeconds, formatCycle, STAGE_GROUPS } from '../lib/journey';
import { QUALITY_CHECKS } from '../data/quality';

export interface PrintPayload {
  code: string;
  mode: 'cost' | 'technical';
}

function isValidEan13(value: string) {
  if (!/^\d{13}$/.test(value)) return false;
  const digits = value.split('').map(Number);
  const sum = digits
    .slice(0, 12)
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10 === digits[12];
}

function Barcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !value.trim()) return;

    const options: JsBarcode.Options = {
      width: 1.6,
      height: 52,
      displayValue: true,
      textMargin: 2,
      fontSize: 11,
      font: 'monospace',
      margin: 0,
      background: '#ffffff',
      lineColor: '#111111',
    };

    try {
      JsBarcode(element, value, {
        ...options,
        format: isValidEan13(value) ? 'EAN13' : 'CODE128',
      });
    } catch {
      JsBarcode(element, value, { ...options, format: 'CODE128' });
    }
  }, [value]);

  return (
    <svg
      ref={ref}
      role="img"
      aria-label={`باركود المنتج ${value}`}
      className="h-auto max-w-full"
    />
  );
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
  const accessories = db.accessories.filter((item) =>
    item.productCodes.includes(product.code),
  );
  const sprays = findSpraysForProduct(db, product.code);
  const econ = economicsOf(db, product.code, db.settings.aluminumFactor, db.settings.marginPct);
  const stages = buildJourney(product, db.machinery, db.molds);
  const cycle = cycleSeconds(stages);
  const isCost = payload.mode === 'cost';
  const inspections = db.inspections.filter((item) => item.productCode === product.code);
  const mold = db.molds.find((item) => item.sizeCm === product.sizeCm);
  const productImage = db.images.find(
    (item) => item.ownerTable === 'products' && item.ownerId === product.id,
  );
  const loads = containerLoads(product, econ.price);
  const accessoriesCost = accessories.reduce(
    (sum, item) => sum + item.qtyPerProduct * item.unitCost,
    0,
  );
  const packagingCost = packaging.reduce((sum, item) => sum + item.unitCost, 0);
  const spraysCost = sprays.reduce((sum, item) => sum + item.costPerProduct, 0);
  const cartonGrossWeight = product.grossWeightKg * product.pcsPerCarton;

  const printStyle = {
    WebkitPrintColorAdjust: 'exact',
    printColorAdjust: 'exact',
  } as CSSProperties;

  const title = isCost ? 'بطاقة التكلفة والمواصفات الرسمية' : 'البطاقة الفنية وخطة الفحص';
  const sectionTitle = 'mb-2 border-r-4 border-brand pr-2 text-[12px] font-black';
  const headCell = 'border border-slate-400 bg-slate-100 p-1.5 text-right font-black';
  const bodyCell = 'border border-slate-300 p-1.5';

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
              <h1 className="text-[17px] font-black leading-tight">
                مصانع الزنوكي للأواني المنزلية
              </h1>
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

        {/* Identity, image, barcode */}
        <section className="mt-4 grid grid-cols-[120px_1fr_190px] items-start gap-4 rounded-lg border border-slate-300 p-3">
          <div className="flex h-[116px] w-[116px] items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
            {productImage ? (
              <img
                src={productImage.dataUrl}
                alt={product.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <ProductArt product={product} className="h-full w-full" />
            )}
          </div>

          <div className="min-w-0">
            <h3 className="text-[16px] font-black leading-tight">{product.name}</h3>
            <p className="mt-0.5 text-[10px] font-bold text-slate-500">
              {product.sizeCm} سم — خط {product.family}
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[9px]">
              <div>
                <dt className="inline font-semibold text-slate-500">كود المنتج: </dt>
                <dd className="num inline font-black">{product.code}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-500">السعة: </dt>
                <dd className="num inline font-black">{fmt1(product.capacityL)} لتر</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-500">الوزن الصافي: </dt>
                <dd className="num inline font-black">{fmt1(product.netWeightKg)} كجم</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-500">وزن الكرتونة: </dt>
                <dd className="num inline font-black">{fmt1(cartonGrossWeight)} كجم</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-500">الإكسسوارات: </dt>
                <dd className="num inline font-black">{accessories.length} صنف</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-slate-500">مراحل التصنيع: </dt>
                <dd className="num inline font-black">{stages.length} مرحلة</dd>
              </div>
            </dl>
          </div>

          <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-slate-200 bg-white p-2">
            <Barcode value={product.barcode} />
            <p className="text-[8px] font-bold text-slate-500">باركود المنتج — EAN/Code128</p>
          </div>
        </section>

        {/* Specs */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>المواصفات والمقاسات</h4>
          <table className="w-full border-collapse text-[9px]">
            <tbody>
              {[
                [
                  ['كود المنتج', product.code],
                  ['عائلة المنتج', product.family],
                  ['المقاس', `${fmt(product.sizeCm)} سم`],
                  ['الارتفاع', `${fmt1(product.heightCm)} سم`],
                ],
                [
                  ['السعة', `${fmt1(product.capacityL)} لتر`],
                  ['الوزن الصافي', `${fmt1(product.netWeightKg)} كجم`],
                  ['الوزن بعد التعبئة', `${fmt1(product.grossWeightKg)} كجم`],
                  ['عدد القطع بالكرتونة', `${fmt(product.pcsPerCarton)} قطعة`],
                ],
                [
                  ['حجم الكرتونة', `${product.cbm} CBM`],
                  ['وزن الكرتونة الكاملة', `${fmt1(cartonGrossWeight)} كجم`],
                  ['الإسطمبة', mold ? `${mold.code} — ${mold.name}` : '—'],
                  ['زمن دورة التصنيع', formatCycle(cycle)],
                ],
              ].map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map(([label, value]) => (
                    <td key={label} className={bodyCell}>
                      <span className="block text-[7.5px] font-bold text-slate-500">
                        {label}
                      </span>
                      <span className="num text-[9px] font-extrabold">{value}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Raw material */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>المواد الخام المباشرة</h4>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={headCell}>كود الخامة</th>
                <th className={headCell}>اسم الخامة</th>
                <th className={headCell}>السبيكة</th>
                <th className={headCell}>قطر القرص</th>
                <th className={headCell}>سُمك الخام</th>
                <th className={headCell}>وزن القرص</th>
                <th className={headCell}>نسبة الهالك</th>
                {isCost ? <th className={headCell}>سعر الكيلو</th> : null}
                {isCost ? <th className={headCell}>تكلفة القرص</th> : null}
                <th className={headCell}>المنتجات المرتبطة</th>
              </tr>
            </thead>
            <tbody>
              {raw ? (
                <tr>
                  <td className={`${bodyCell} num font-bold`}>{raw.code}</td>
                  <td className={`${bodyCell} font-bold`}>{raw.name}</td>
                  <td className={bodyCell}>{raw.alloy}</td>
                  <td className={`${bodyCell} num`}>{fmt(raw.diameterCm)} سم</td>
                  <td className={`${bodyCell} num`}>{fmt1(raw.thicknessMm)} مم</td>
                  <td className={`${bodyCell} num`}>{raw.discWeightKg.toFixed(3)} كجم</td>
                  <td className={`${bodyCell} num`}>{pct(raw.wastePct)}</td>
                  {isCost ? (
                    <td className={`${bodyCell} num`}>{money(raw.pricePerKg)} ج.م</td>
                  ) : null}
                  {isCost ? (
                    <td className={`${bodyCell} num font-extrabold`}>
                      {money(discCostOf(raw, db.settings.aluminumFactor))} ج.م
                    </td>
                  ) : null}
                  <td className={`${bodyCell} num`}>
                    {raw.productCodes.join('، ') || product.code}
                  </td>
                </tr>
              ) : (
                <tr>
                  <td className={`${bodyCell} text-center text-slate-500`} colSpan={isCost ? 10 : 8}>
                    لا توجد مادة خام مرتبطة بهذا المنتج — أضفها من مركز البيانات.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>

        {/* Accessories */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>
            الإكسسوارات ومكونات التجميع{' '}
            <span className="num text-[9px] font-bold text-slate-400">
              ({accessories.length} صنف)
            </span>
          </h4>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={headCell}>#</th>
                <th className={headCell}>الكود</th>
                <th className={headCell}>اسم الإكسسوار</th>
                <th className={headCell}>المادة</th>
                <th className={headCell}>العدد / قطعة</th>
                <th className={headCell}>المورد / المنشأ</th>
                {isCost ? <th className={headCell}>تكلفة الوحدة</th> : null}
                {isCost ? <th className={headCell}>الإجمالي</th> : null}
              </tr>
            </thead>
            <tbody>
              {accessories.length ? (
                accessories.map((item, index) => (
                  <tr key={item.id}>
                    <td className={`${bodyCell} num text-slate-400`}>{index + 1}</td>
                    <td className={`${bodyCell} num font-bold`}>{item.code}</td>
                    <td className={`${bodyCell} font-bold`}>{item.name}</td>
                    <td className={bodyCell}>{item.material || '—'}</td>
                    <td className={`${bodyCell} num font-bold`}>{fmt(item.qtyPerProduct)}</td>
                    <td className={bodyCell}>{item.origin || '—'}</td>
                    {isCost ? (
                      <td className={`${bodyCell} num`}>{money(item.unitCost)} ج.م</td>
                    ) : null}
                    {isCost ? (
                      <td className={`${bodyCell} num font-extrabold`}>
                        {money(item.qtyPerProduct * item.unitCost)} ج.م
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={`${bodyCell} text-center text-slate-500`} colSpan={isCost ? 8 : 6}>
                    لا توجد إكسسوارات مرتبطة بهذا المنتج.
                  </td>
                </tr>
              )}
              {isCost && accessories.length ? (
                <tr className="bg-slate-100">
                  <td className={`${bodyCell} font-black`} colSpan={7}>
                    إجمالي تكلفة الإكسسوارات للقطعة الواحدة
                  </td>
                  <td className={`${bodyCell} num font-black`}>{money(accessoriesCost)} ج.م</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        {/* Spray / coating */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>
            الرش والطلاء{' '}
            <span className="num text-[9px] font-bold text-slate-400">
              ({sprays.length ? `${sprays.length} مادة` : 'بدون رش'})
            </span>
          </h4>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={headCell}>#</th>
                <th className={headCell}>الكود</th>
                <th className={headCell}>مادة الرش/الطلاء</th>
                <th className={headCell}>النوع</th>
                <th className={headCell}>اللون/التشطيب</th>
                <th className={headCell}>المورد</th>
                {isCost ? <th className={headCell}>تكلفة القطعة</th> : null}
                <th className={headCell}>ملاحظات</th>
              </tr>
            </thead>
            <tbody>
              {sprays.length ? (
                sprays.map((item, index) => (
                  <tr key={item.id}>
                    <td className={`${bodyCell} num text-slate-400`}>{index + 1}</td>
                    <td className={`${bodyCell} num font-bold`}>{item.code}</td>
                    <td className={`${bodyCell} font-bold`}>{item.name}</td>
                    <td className={bodyCell}>{item.type || '—'}</td>
                    <td className={bodyCell}>{item.color || '—'}</td>
                    <td className={bodyCell}>{item.supplier || '—'}</td>
                    {isCost ? (
                      <td className={`${bodyCell} num font-extrabold`}>{money(item.costPerProduct)} ج.م</td>
                    ) : null}
                    <td className={`${bodyCell} text-[7.5px]`}>{item.notes || '—'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={`${bodyCell} text-center text-slate-500`} colSpan={isCost ? 8 : 7}>
                    هذا المنتج لا يُرش — لا توجد مواد رش/طلاء مرتبطة به، وتُحتسب تكلفة الرش تلقائيًا = 0.
                  </td>
                </tr>
              )}
              {isCost && sprays.length ? (
                <tr className="bg-slate-100">
                  <td className={`${bodyCell} font-black`} colSpan={6}>
                    إجمالي تكلفة الرش والطلاء للقطعة الواحدة
                  </td>
                  <td className={`${bodyCell} num font-black`}>{money(spraysCost)} ج.م</td>
                  <td className={bodyCell} />
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        {/* Packaging */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>التعبئة والتغليف</h4>
          <div className="mb-1.5 grid grid-cols-4 gap-2 text-[8.5px]">
            <div className="rounded border border-slate-300 p-1.5">
              <span className="block font-bold text-slate-500">حجم الكرتونة</span>
              <span className="num font-black">{product.cbm} CBM</span>
            </div>
            <div className="rounded border border-slate-300 p-1.5">
              <span className="block font-bold text-slate-500">القطع بالكرتونة</span>
              <span className="num font-black">{fmt(product.pcsPerCarton)} قطعة</span>
            </div>
            <div className="rounded border border-slate-300 p-1.5">
              <span className="block font-bold text-slate-500">وزن الكرتونة</span>
              <span className="num font-black">{fmt1(cartonGrossWeight)} كجم</span>
            </div>
            <div className="rounded border border-slate-300 p-1.5">
              <span className="block font-bold text-slate-500">مكونات التغليف</span>
              <span className="num font-black">{packaging.length} صنف</span>
            </div>
          </div>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={headCell}>الكود</th>
                <th className={headCell}>الصنف</th>
                <th className={headCell}>الأبعاد (طول × عرض × ارتفاع)</th>
                <th className={headCell}>الوزن الفارغ</th>
                <th className={headCell}>القطع الداخلية</th>
                {isCost ? <th className={headCell}>تكلفة الوحدة</th> : null}
                {isCost ? <th className={headCell}>الإجمالي</th> : null}
              </tr>
            </thead>
            <tbody>
              {packaging.length ? (
                packaging.map((item) => (
                  <tr key={item.id}>
                    <td className={`${bodyCell} num font-bold`}>{item.code}</td>
                    <td className={`${bodyCell} font-bold`}>{item.name}</td>
                    <td className={`${bodyCell} num`}>
                      {fmt(item.lengthCm)} × {fmt(item.widthCm)} × {fmt(item.heightCm)} سم
                    </td>
                    <td className={`${bodyCell} num`}>{fmt1(item.emptyWeightKg)} كجم</td>
                    <td className={`${bodyCell} num`}>{fmt(item.pcsInside)}</td>
                    {isCost ? (
                      <td className={`${bodyCell} num`}>{money(item.unitCost)} ج.م</td>
                    ) : null}
                    {isCost ? (
                      <td className={`${bodyCell} num font-extrabold`}>
                        {money(item.unitCost)} ج.م
                      </td>
                    ) : null}
                  </tr>
                ))
              ) : (
                <tr>
                  <td className={`${bodyCell} text-center text-slate-500`} colSpan={isCost ? 7 : 5}>
                    لا توجد مكونات تغليف مرتبطة بهذا المنتج.
                  </td>
                </tr>
              )}
              {isCost && packaging.length ? (
                <tr className="bg-slate-100">
                  <td className={`${bodyCell} font-black`} colSpan={6}>
                    إجمالي تكلفة التغليف للقطعة الواحدة
                  </td>
                  <td className={`${bodyCell} num font-black`}>{money(packagingCost)} ج.م</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        {/* Cost */}
        {isCost ? (
          <section className="mt-4 print-break">
            <h4 className={sectionTitle}>تفكيك التكلفة الصناعية</h4>
            <table className="w-full border-collapse text-[9px]">
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
                  <td className="border border-slate-300 p-1.5 font-black">
                    إجمالي التكلفة التقديرية
                  </td>
                  <td className="num border border-slate-300 p-1.5 font-black">
                    {money(econ.total)}
                  </td>
                  <td className="border border-slate-300 p-1.5 font-black">100%</td>
                </tr>
              </tbody>
            </table>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[9px]">
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

        {/* Shipping & export */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>بيانات الشحن والتصدير</h4>
          <table className="w-full border-collapse text-[8.5px]">
            <thead>
              <tr>
                <th className={headCell}>الحاوية</th>
                <th className={headCell}>السعة (CBM)</th>
                <th className={headCell}>الحمولة القصوى</th>
                <th className={headCell}>عدد الكراتين</th>
                <th className={headCell}>عدد القطع</th>
                <th className={headCell}>وزن الشحنة</th>
                <th className={headCell}>الحجم المستخدم</th>
                {isCost ? <th className={headCell}>القيمة التقديرية</th> : null}
                <th className={headCell}>الجاهزية</th>
              </tr>
            </thead>
            <tbody>
              {loads.map((load) => (
                <tr key={load.standard}>
                  <td className={`${bodyCell} font-bold`}>{load.standard}</td>
                  <td className={`${bodyCell} num`}>{fmt(load.volumeCbm)}</td>
                  <td className={`${bodyCell} num`}>{fmt(load.maxTons)} طن</td>
                  <td className={`${bodyCell} num font-bold`}>{fmt(load.cartons)}</td>
                  <td className={`${bodyCell} num font-bold`}>{fmt(load.pieces)}</td>
                  <td className={`${bodyCell} num`}>{fmt1(load.weightTons)} طن</td>
                  <td className={`${bodyCell} num`}>{fmt1(load.volumeUsed)} CBM</td>
                  {isCost ? (
                    <td className={`${bodyCell} num font-extrabold`}>{money(load.value)} ج.م</td>
                  ) : null}
                  <td className={`${bodyCell} font-bold`}>
                    {load.pieces > 0 ? 'جاهز للتصدير' : 'يحتاج مراجعة'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[7.5px] font-medium text-slate-400">
            الحساب مبني على أبعاد الكرتونة ({product.cbm} CBM) والوزن بعد التعبئة
            ({fmt1(cartonGrossWeight)} كجم للكرتونة) وسعر البيع المقترح.
          </p>
        </section>

        {/* Manufacturing stages */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>
            مراحل التصنيع بالتفصيل{' '}
            <span className="num text-[9px] font-bold text-slate-400">({stages.length} مرحلة)</span>
          </h4>
          <table className="w-full border-collapse text-[8px]">
            <thead>
              <tr>
                <th className={headCell}>#</th>
                <th className={headCell}>المرحلة</th>
                <th className={headCell}>الوصف الفني</th>
                <th className={headCell}>الماكينة</th>
                <th className={headCell}>الإسطمبة</th>
                <th className={headCell}>العمال</th>
                <th className={headCell}>الزمن (ث)</th>
                <th className={headCell}>التراكمي (ث)</th>
              </tr>
            </thead>
            <tbody>
              {stages.map((stage, index) => {
                const previous = stages[index - 1];
                const showGroup = !previous || previous.group !== stage.group;
                return (
                  <Fragment key={stage.key}>
                    {showGroup ? (
                      <tr>
                        <td
                          className="border border-slate-300 bg-brand-soft p-1 text-[8px] font-black text-brand-dark"
                          colSpan={8}
                        >
                          {STAGE_GROUPS[stage.group].label}
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td className={`${bodyCell} num text-slate-400`}>{index + 1}</td>
                      <td className={`${bodyCell} font-bold`}>{stage.name}</td>
                      <td className={`${bodyCell} text-[7.5px] leading-snug text-slate-600`}>
                        {stage.description}
                      </td>
                      <td className={bodyCell}>
                        {stage.machineCode
                          ? `${stage.machineCode} — ${stage.machineName}`
                          : 'عمل يدوي'}
                      </td>
                      <td className={`${bodyCell} num`}>{stage.moldCode ?? '—'}</td>
                      <td className={`${bodyCell} num`}>{stage.workers}</td>
                      <td className={`${bodyCell} num`}>{stage.seconds}</td>
                      <td className={`${bodyCell} num`}>{stage.cumulative}</td>
                    </tr>
                  </Fragment>
                );
              })}
              <tr className="bg-slate-100">
                <td className={`${bodyCell} font-black`} colSpan={6}>
                  إجمالي زمن التصنيع للقطعة الواحدة
                </td>
                <td className={`${bodyCell} num font-black`} colSpan={2}>
                  {cycle} ثانية — {formatCycle(cycle)}
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        {/* Quality */}
        <section className="mt-4 print-break">
          <h4 className={sectionTitle}>نقاط الفحص والاختبار</h4>
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
          <span className="num">
            ELZ-PP/{product.code} — {docDate()}
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
