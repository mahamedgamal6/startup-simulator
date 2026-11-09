import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Coins,
  FlaskConical,
  Layers,
  Percent,
  SlidersHorizontal,
  TrendingUp,
} from 'lucide-react';
import { ProductPicker } from '../components/ProductPicker';
import {
  Badge,
  Card,
  ProgressBar,
  RangeSlider,
  SectionHeading,
  Stat,
} from '../components/ui';
import { useData } from '../lib/db';
import { fmt, fmt1, money, pct } from '../lib/format';
import {
  COMPONENT_COLORS,
  containerLoads,
  discCostOf,
  economicsOf,
  findRawForProduct,
} from '../lib/cost';
import type { TableKey } from '../types';

type SortKey = 'margin' | 'profit' | 'cost';

export function FinanceScreen({
  can,
  productCode,
  onSelect,
  onNavigateData: _onNavigateData,
}: {
  can: (permission: string) => boolean;
  productCode: string;
  onSelect: (code: string) => void;
  onNavigateData: (table: TableKey) => void;
}) {
  const { db, updateSettings } = useData();
  const [sortKey, setSortKey] = useState<SortKey>('profit');
  const canSimulate = can('finance.simulate');
  const canEditSettings = can('settings.edit');

  const product = db.products.find((item) => item.code === productCode) ?? db.products[0];
  const factor = db.settings.aluminumFactor;
  const margin = db.settings.marginPct;
  const aluminumPercent = Math.round((factor - 1) * 100);

  const rows = useMemo(
    () =>
      db.products.map((item) => {
        const econ = economicsOf(db, item.code, factor, margin);
        const raw = findRawForProduct(db, item.code);
        const load = containerLoads(item, econ.price)[0];
        return { product: item, econ, raw, load };
      }),
    [db, factor, margin],
  );

  const selected = rows.find((row) => row.product.code === product?.code) ?? rows[0];
  const econ = selected?.econ ?? economicsOf(undefined, factor, margin);
  const raw = selected?.raw;
  const discCost = discCostOf(raw, factor);

  const sorted = [...rows].sort((a, b) => {
    if (sortKey === 'cost') return b.econ.total - a.econ.total;
    if (sortKey === 'margin') return b.econ.price - b.econ.total - (a.econ.price - a.econ.total);
    return b.econ.profit - a.econ.profit;
  });

  const sensitivities = [-20, -10, 0, 10, 20].map((percent) => {
    const nextFactor = 1 + percent / 100;
    const code = selected?.product.code ?? db.products[0]?.code ?? '';
    return { percent, ...economicsOf(db, code, nextFactor, margin) };
  });

  const avgCost =
    rows.reduce((sum, row) => sum + row.econ.total, 0) / Math.max(rows.length, 1);
  const totalVolume = rows.reduce((sum, row) => sum + row.econ.total, 0);

  const wasteRows = db.rawMaterials.map((material) => {
    const disc = discCostOf(material, factor);
    return {
      material,
      disc,
      wasteValue: (disc * material.wastePct) / 100,
    };
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Cost Intelligence</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">التحليل المالي والتكاليف</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            تفكيك التكلفة المباشرة وغير المباشرة، حساسية أسعار الألومنيوم ونسب الهدر — مع محاكاة
            فورية لسعر البيع وهامش الربح.
          </p>
        </div>
        {/* عناصر التكلفة تُحسب تلقائيًا لكل منتج */}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="إجمالي تكلفة القطعة"
          value={`${money(econ.total)} ج.م`}
          hint={`${product?.name ?? ''} — ${product?.sizeCm ?? ''} سم`}
          icon={<Coins size={18} />}
        />
        <Stat
          label="سعر البيع المقترح"
          value={`${money(econ.price)} ج.م`}
          hint={`هامش ${fmt(margin)}% على التكلفة`}
          tone="crown"
          icon={<TrendingUp size={18} />}
        />
        <Stat
          label="ربح القطعة"
          value={`${money(econ.profit)} ج.م`}
          hint={`قيمة الحاوية 20 قدم: ${money(selected?.load.value ?? 0)} ج.م`}
          tone="prime"
          icon={<ArrowUpRight size={18} />}
        />
        <Stat
          label="متوسط تكلفة المنتجات"
          value={`${money(avgCost)} ج.م`}
          hint={`${rows.length} منتجًا — إجمالي ${money(totalVolume)} ج.م`}
          tone="elora"
          icon={<Percent size={18} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-5">
          <SectionHeading
            title="محاكي التكلفة الذكي"
            subtitle="غيّر سعر خام الألومنيوم أو الهامش وشاهد الأثر فورًا"
            icon={<SlidersHorizontal size={17} />}
            action={<Badge tone="slate">What-If</Badge>}
          />
          <div className="mt-4">
            <ProductPicker
              products={db.products}
              value={product?.code ?? ''}
              onChange={onSelect}
              compact
            />
          </div>

          <div className="mt-5 rounded-2xl border border-slate-100 bg-mist/50 p-4">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
                <FlaskConical size={13} /> سعر خام الألومنيوم
              </span>
              <span
                className={
                  aluminumPercent === 0
                    ? 'num rounded-md bg-slate-200/70 px-2 py-0.5 text-[11px] font-bold text-slate-600'
                    : aluminumPercent > 0
                      ? 'num rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-600'
                      : 'num rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-600'
                }
              >
                {aluminumPercent > 0 ? '+' : ''}
                {aluminumPercent}%
              </span>
            </div>
            {canSimulate ? (
              <div className="mt-3">
                <RangeSlider
                  label="تغير سعر خام الألومنيوم"
                  value={aluminumPercent}
                  min={-20}
                  max={20}
                  step={1}
                  onChange={(percent) => updateSettings({ aluminumFactor: 1 + percent / 100 })}
                />
                <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
                  <span>-20%</span>
                  <button
                    className="text-brand hover:underline"
                    onClick={() => updateSettings({ aluminumFactor: 1 })}
                  >
                    استعادة السعر الأساسي
                  </button>
                  <span>+20%</span>
                </div>
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-semibold text-slate-500">
                محاكي سعر الخام غير مصرّح به لدورك.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-[10px] font-bold text-slate-400">تكلفة قرص الخام</p>
                <p className="num mt-0.5 text-[15px] font-black text-ink">{money(discCost)} ج.م</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2">
                <p className="text-[10px] font-bold text-slate-400">الخام في التكلفة</p>
                <p className="num mt-0.5 text-[15px] font-black text-ink">
                  {money(econ.rawAdjusted)} ج.م
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>هامش الربح المستهدف</span>
              <span className="num rounded-md bg-brand-soft px-2 py-0.5 text-brand-dark">
                {fmt(margin)}%
              </span>
            </div>
            {canEditSettings ? (
              <div className="mt-3">
                <RangeSlider
                  label="هامش الربح"
                  value={margin}
                  min={10}
                  max={45}
                  step={1}
                  onChange={(value) => updateSettings({ marginPct: value })}
                />
              </div>
            ) : (
              <p className="mt-3 rounded-lg bg-slate-100 px-2.5 py-2 text-[10px] font-semibold text-slate-500">
                تعديل هامش الربح غير مصرّح به لدورك.
              </p>
            )}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-gradient-to-l from-brand to-brand-deep px-3.5 py-3 text-white">
              <div>
                <p className="text-[10px] font-bold text-white/60">سعر البيع المقترح</p>
                <p className="num text-xl font-black">{money(econ.price)} ج.م</p>
              </div>
              <div className="text-left">
                <p className="text-[10px] font-bold text-white/60">ربح القطعة</p>
                <p className="num text-sm font-extrabold">{money(econ.profit)} ج.م</p>
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-7">
          <SectionHeading
            title="تحليل الحساسية لسعر الألومنيوم"
            subtitle="أثر تغير سعر الخام على التكلفة وسعر البيع والربح"
            icon={<Percent size={17} />}
          />
          <div className="scrollbar-thin mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-right text-[12px]">
              <thead>
                <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                  <th className="px-3 py-2.5">انحراف السعر</th>
                  <th className="px-3 py-2.5">تكلفة الخام</th>
                  <th className="px-3 py-2.5">إجمالي التكلفة</th>
                  <th className="px-3 py-2.5">سعر البيع</th>
                  <th className="px-3 py-2.5">ربح القطعة</th>
                </tr>
              </thead>
              <tbody>
                {sensitivities.map((row) => {
                  const active = row.percent === aluminumPercent;
                  return (
                    <tr
                      key={row.percent}
                      className={
                        active
                          ? 'border-t border-brand/20 bg-brand-soft/50'
                          : 'border-t border-slate-100'
                      }
                    >
                      <td className="px-3 py-2.5">
                        <span className="num font-extrabold">
                          {row.percent > 0 ? '+' : ''}
                          {row.percent}%
                        </span>
                        {active ? (
                          <span className="mr-1 rounded bg-brand px-1 text-[9px] font-bold text-white">
                            الحالي
                          </span>
                        ) : null}
                      </td>
                      <td className="num px-3 py-2.5 font-semibold">{money(row.rawAdjusted)}</td>
                      <td className="num px-3 py-2.5 font-bold">{money(row.total)}</td>
                      <td className="num px-3 py-2.5 font-semibold text-ink">{money(row.price)}</td>
                      <td className="num px-3 py-2.5 font-extrabold text-crown">
                        {money(row.profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl bg-mist/60 px-3 py-2.5">
              <p className="text-[10px] font-bold text-slate-400">نسبة الخام من التكلفة</p>
              <p className="num mt-0.5 text-lg font-black">
                {pct(econ.total ? (econ.rawAdjusted / econ.total) * 100 : 0)}
              </p>
              <ProgressBar
                value={econ.total ? (econ.rawAdjusted / econ.total) * 100 : 0}
                color={COMPONENT_COLORS.raw}
                className="mt-1.5 h-1.5"
              />
            </div>
            <div className="rounded-xl bg-mist/60 px-3 py-2.5">
              <p className="text-[10px] font-bold text-slate-400">نسبة العمالة والمصاريف</p>
              <p className="num mt-0.5 text-lg font-black">
                {pct(
                  econ.total
                    ? ((econ.components[3].value + econ.components[4].value) / econ.total) * 100
                    : 0,
                )}
              </p>
              <ProgressBar
                value={
                  econ.total
                    ? ((econ.components[3].value + econ.components[4].value) / econ.total) * 100
                    : 0
                }
                color={COMPONENT_COLORS.labor}
                className="mt-1.5 h-1.5"
              />
            </div>
          </div>

          <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
            الحساسية محسوبة على تكلفة الخام المباشرة المحتسبة تلقائيًا من بيانات المنتج. تغيّر سعر
            الألومنيوم ينعكس على تكلفة القرص وعلى إجمالي التكلفة وسعر البيع بنفس النسبة.
          </p>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-5 pb-3">
          <SectionHeading
            title="تكلفة جميع المنتجات"
            subtitle="تفكيك مكوّنات التكلفة ومقارنة الربحية"
            icon={<Layers size={17} />}
          />
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'profit', label: 'الأعلى ربحًا' },
                { key: 'cost', label: 'الأعلى تكلفة' },
                { key: 'margin', label: 'الأعلى هامشًا' },
              ] as Array<{ key: SortKey; label: string }>
            ).map((option) => (
              <button
                key={option.key}
                onClick={() => setSortKey(option.key)}
                className={sortKey === option.key ? 'chip chip-active' : 'chip chip-muted'}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[1040px] text-right text-[12px]">
            <thead>
              <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                <th className="px-4 py-3">المنتج</th>
                <th className="px-3 py-3">خام</th>
                <th className="px-3 py-3">إكسسوار</th>
                <th className="px-3 py-3">تغليف</th>
                <th className="px-3 py-3">عمالة</th>
                <th className="px-3 py-3">غير مباشر</th>
                <th className="px-3 py-3">الإجمالي</th>
                <th className="px-3 py-3">سعر البيع</th>
                <th className="px-3 py-3">الربح</th>
                <th className="px-3 py-3">الهامش</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => {
                const active = row.product.code === product?.code;
                return (
                  <tr
                    key={row.product.id}
                    className={
                      active
                        ? 'border-t border-brand/20 bg-brand-soft/40'
                        : 'border-t border-slate-100 hover:bg-mist/50'
                    }
                  >
                    <td className="px-4 py-3">
                      <button className="text-right" onClick={() => onSelect(row.product.code)}>
                        <span className="block text-[12px] font-extrabold text-ink">
                          {row.product.name}
                        </span>
                        <span className="num mt-0.5 block text-[10px] font-semibold text-slate-400">
                          {row.product.code} · {row.product.sizeCm} سم
                        </span>
                      </button>
                    </td>
                    <td className="num px-3 py-3 font-semibold">{money(row.econ.components[0].value)}</td>
                    <td className="num px-3 py-3 font-semibold">{money(row.econ.components[1].value)}</td>
                    <td className="num px-3 py-3 font-semibold">{money(row.econ.components[2].value)}</td>
                    <td className="num px-3 py-3 font-semibold">{money(row.econ.components[3].value)}</td>
                    <td className="num px-3 py-3 font-semibold">{money(row.econ.components[4].value)}</td>
                    <td className="num px-3 py-3 font-extrabold text-ink">{money(row.econ.total)}</td>
                    <td className="num px-3 py-3 font-semibold">{money(row.econ.price)}</td>
                    <td className="num px-3 py-3 font-extrabold text-crown">{money(row.econ.profit)}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <Badge tone="green">{pct(margin)}</Badge>
                        <div className="w-12">
                          <ProgressBar
                            value={(row.econ.profit / row.econ.price) * 100}
                            color="#447a72"
                            className="h-1.5"
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-slate-200 bg-mist/70 text-[11px] font-bold text-slate-500">
                <td className="px-4 py-3">الإجمالي / المتوسط</td>
                <td className="num px-3 py-3">{money(rows.reduce((s, r) => s + r.econ.components[0].value, 0))}</td>
                <td className="num px-3 py-3">{money(rows.reduce((s, r) => s + r.econ.components[1].value, 0))}</td>
                <td className="num px-3 py-3">{money(rows.reduce((s, r) => s + r.econ.components[2].value, 0))}</td>
                <td className="num px-3 py-3">{money(rows.reduce((s, r) => s + r.econ.components[3].value, 0))}</td>
                <td className="num px-3 py-3">{money(rows.reduce((s, r) => s + r.econ.components[4].value, 0))}</td>
                <td className="num px-3 py-3 text-ink">{money(totalVolume)}</td>
                <td className="num px-3 py-3">{money(rows.reduce((s, r) => s + r.econ.price, 0))}</td>
                <td className="num px-3 py-3 text-crown">{money(rows.reduce((s, r) => s + r.econ.profit, 0))}</td>
                <td className="px-3 py-3">{pct(margin)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Card className="p-5">
        <SectionHeading
          title="تحليل الهدر وسعر الخام"
          subtitle="نسبة الهالك لكل قرص وقيمتها المالية بسعر السوق الحالي"
          icon={<FlaskConical size={17} />}
          action={<Badge tone="amber">معامل السوق {aluminumPercent > 0 ? '+' : ''}{aluminumPercent}%</Badge>}
        />
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {wasteRows.map((row) => (
            <div key={row.material.id} className="rounded-xl border border-slate-100 p-3">
              <p className="text-[11px] font-extrabold text-ink">{row.material.name}</p>
              <p className="num mt-0.5 text-[10px] font-semibold text-slate-400">
                {row.material.code} · {row.material.alloy}
              </p>
              <div className="mt-2 flex items-end justify-between">
                <div>
                  <p className="text-[9px] font-bold text-slate-400">قيمة الهالك</p>
                  <p className="num text-sm font-black text-brand">{money(row.wasteValue)} ج.م</p>
                </div>
                <div className="text-left">
                  <p className="text-[9px] font-bold text-slate-400">نسبة الهالك</p>
                  <p className="num text-sm font-black text-ink">{pct(row.material.wastePct)}</p>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-1.5 text-[10px] font-semibold text-slate-400">
                <span>سعر الكيلو</span>
                <span className="num">{money(row.material.pricePerKg)} ج.م</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] font-semibold text-slate-400">
                <span>تكلفة القرص</span>
                <span className="num font-bold text-ink">{money(row.disc)} ج.م</span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-medium text-slate-400">
          متوسط نسبة الهالك:{' '}
          <span className="num font-bold text-slate-600">
            {fmt1(
              db.rawMaterials.reduce((sum, item) => sum + item.wastePct, 0) /
                Math.max(db.rawMaterials.length, 1),
            )}
            %
          </span>{' '}
          — يُستخدم في حساب تكلفة القرص المعتمدة.
        </p>
      </Card>
    </div>
  );
}
