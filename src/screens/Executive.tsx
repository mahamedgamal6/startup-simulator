import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Container,
  Crown,
  Factory,
  Package,
  ShieldAlert,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { ProductArt, FAMILY_COLORS } from '../components/ProductArt';
import { Badge, Card, Donut, ProgressBar, SectionHeading, Stat } from '../components/ui';
import { useData } from '../lib/db';
import { fmt, fmt1, money, pct } from '../lib/format';
import { containerLoads, economicsOf, findCostForProduct } from '../lib/cost';

export function ExecutiveScreen() {
  const { db } = useData();
  const factor = db.settings.aluminumFactor;
  const margin = db.settings.marginPct;

  const rows = db.products.map((product) => {
    const econ = economicsOf(findCostForProduct(db, product.code), factor, margin);
    const loads = containerLoads(product, econ.price);
    return { product, econ, loads };
  });

  const totalCost = rows.reduce((sum, row) => sum + row.econ.total, 0);
  const avgCost = totalCost / Math.max(rows.length, 1);
  const avgPrice = rows.reduce((sum, row) => sum + row.econ.price, 0) / Math.max(rows.length, 1);
  const topProfit = [...rows].sort((a, b) => b.econ.profit - a.econ.profit);
  const maxProfit = Math.max(...rows.map((row) => row.econ.profit), 1);
  const avgFault =
    db.machinery.reduce((sum, machine) => sum + machine.faultRate, 0) /
    Math.max(db.machinery.length, 1);
  const exportValue20 = rows.reduce(
    (sum, row) => sum + (row.loads[0]?.value ?? 0),
    0,
  );
  const exportPieces40 = rows.reduce((sum, row) => sum + (row.loads[1]?.pieces ?? 0), 0);

  const families = Array.from(new Set(db.products.map((product) => product.family))).map(
    (family) => {
      const items = rows.filter((row) => row.product.family === family);
      return {
        family,
        count: items.length,
        cost: items.reduce((sum, row) => sum + row.econ.total, 0),
        color: FAMILY_COLORS[family]?.color ?? '#94a3b8',
        soft: FAMILY_COLORS[family]?.soft ?? '#f1f5f9',
      };
    },
  );

  const alerts = [
    ...db.machinery
      .filter((machine) => machine.faultRate >= 2.4)
      .map((machine) => ({
        tone: 'amber' as const,
        title: `ماكينة ${machine.code} — ${machine.name}`,
        detail: `معدل أعطال ${pct(machine.faultRate)} يتجاوز الحد المستهدف 2.4%`,
      })),
    ...db.rawMaterials
      .filter((raw) => raw.wastePct >= 12)
      .map((raw) => ({
        tone: 'rose' as const,
        title: `هدر مرتفع — ${raw.name}`,
        detail: `نسبة الهالك ${pct(raw.wastePct)} وتكلفة القرص ${money(
          raw.discWeightKg * raw.pricePerKg * factor,
        )} ج.م`,
      })),
    ...db.products
      .filter((product) => !findCostForProduct(db, product.code))
      .map((product) => ({
        tone: 'slate' as const,
        title: `منتج بدون بطاقة تكلفة — ${product.name}`,
        detail: `أضف عناصر التكلفة للمنتج ${product.code} لإكمال التحليل المالي`,
      })),
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Executive Overview</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">لوحة الإدارة العليا</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            ملخص شامل للربحية، جاهزية التصدير ومؤشرات الأداء الرئيسية لمصانع الزنوكي.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">
            <Factory size={12} /> {db.machinery.length} ماكينة
          </Badge>
          <Badge tone="green">
            <Package size={12} /> {db.products.length} منتج
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat
          label="متوسط تكلفة القطعة"
          value={`${money(avgCost)} ج.م`}
          hint="على مستوى جميع المنتجات"
          icon={<Wallet size={18} />}
        />
        <Stat
          label="متوسط سعر البيع"
          value={`${money(avgPrice)} ج.م`}
          hint={`هامش مستهدف ${fmt(margin)}%`}
          tone="crown"
          icon={<TrendingUp size={18} />}
        />
        <Stat
          label="أعلى ربح قطعة"
          value={`${money(topProfit[0]?.econ.profit ?? 0)} ج.م`}
          hint={topProfit[0]?.product.name ?? '—'}
          tone="prime"
          icon={<Crown size={18} />}
        />
        <Stat
          label="قيمة شحن 20 قدم"
          value={`${money(exportValue20)} ج.م`}
          hint={`${fmt(exportPieces40)} قطعة في 40 قدم`}
          tone="elora"
          icon={<Container size={18} />}
        />
        <Stat
          label="متوسط الأعطال"
          value={pct(avgFault)}
          hint="حد التدخل عند 2.4%"
          icon={<AlertTriangle size={18} />}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-7">
          <SectionHeading
            title="أعلى المنتجات ربحية"
            subtitle="ترتيب حسب ربح القطعة الصافي بسعر السوق الحالي"
            icon={<BarChart3 size={17} />}
            action={<Badge tone="green">هامش {fmt(margin)}%</Badge>}
          />
          <div className="mt-4 space-y-3">
            {topProfit.map((row, index) => (
              <div key={row.product.id} className="flex items-center gap-3">
                <span className="num w-5 text-center text-[11px] font-black text-slate-300">
                  {index + 1}
                </span>
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: FAMILY_COLORS[row.product.family]?.soft }}
                >
                  <ProductArt product={row.product} className="h-9 w-9" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="truncate text-[12px] font-extrabold text-ink">
                      {row.product.name}
                      <span className="mr-1 text-[10px] font-bold text-slate-400">
                        {row.product.sizeCm} سم
                      </span>
                    </p>
                    <span className="num shrink-0 text-[12px] font-black text-crown">
                      {money(row.econ.profit)} ج.م
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <ProgressBar
                      value={(row.econ.profit / maxProfit) * 100}
                      color={index === 0 ? '#ec1c24' : '#447a72'}
                      className="h-1.5"
                    />
                    <span className="num shrink-0 text-[9px] font-bold text-slate-400">
                      {money(row.econ.total)} تكلفة · {money(row.econ.price)} بيع
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 xl:col-span-5">
          <SectionHeading
            title="توزيع التكلفة على خطوط الإنتاج"
            subtitle="حصة كل عائلة منتجات من إجمالي التكلفة"
            icon={<Factory size={17} />}
            action={<Badge tone="slate">{families.length} خطوط</Badge>}
          />
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-center">
            <Donut
              segments={families.map((item) => ({
                label: item.family,
                value: item.cost,
                color: item.color,
              }))}
              size={160}
              thickness={20}
              center={
                <>
                  <span className="text-[10px] font-bold text-slate-400">إجمالي التكلفة</span>
                  <span className="num text-base font-black">{money(totalCost)}</span>
                  <span className="text-[9px] font-semibold text-slate-400">
                    ج.م / {rows.length} منتجات
                  </span>
                </>
              }
            />
            <div className="w-full space-y-2">
              {families.map((item) => (
                <div key={item.family} className="flex items-center gap-2 text-[11px]">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                  <span className="flex-1 font-bold text-slate-500">{item.family}</span>
                  <span className="num font-bold text-ink">{money(item.cost)}</span>
                  <span className="num w-8 text-left font-bold text-slate-400">
                    {pct(totalCost ? (item.cost / totalCost) * 100 : 0, 0)}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3 text-center">
            <div>
              <p className="text-[9px] font-bold text-slate-400">متوسط التكلفة</p>
              <p className="num text-[12px] font-black">{money(avgCost)}</p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400">إجمالي الربح</p>
              <p className="num text-[12px] font-black text-crown">
                {money(rows.reduce((sum, row) => sum + row.econ.profit, 0))}
              </p>
            </div>
            <div>
              <p className="text-[9px] font-bold text-slate-400">أعلى هامش</p>
              <p className="num text-[12px] font-black">{pct(margin)}</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <SectionHeading
            title="جاهزية الشحن والتصدير"
            subtitle="سعة الحاويات وقيمة الشحنة لكل منتج بسعر البيع المقترح"
            icon={<Container size={17} />}
            action={<Badge tone="blue">2 حاويات قياسية</Badge>}
          />
          <div className="scrollbar-thin mt-3 overflow-x-auto">
            <table className="w-full min-w-[820px] text-right text-[12px]">
              <thead>
                <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                  <th className="px-3 py-2.5">المنتج</th>
                  <th className="px-3 py-2.5">20 قدم — قطع</th>
                  <th className="px-3 py-2.5">20 قدم — قيمة</th>
                  <th className="px-3 py-2.5">40 قدم — قطع</th>
                  <th className="px-3 py-2.5">40 قدم — قيمة</th>
                  <th className="px-3 py-2.5">وزن 40 قدم</th>
                  <th className="px-3 py-2.5">الجاهزية</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.product.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <p className="text-[12px] font-extrabold text-ink">
                        {row.product.name}
                        <span className="mr-1 text-[10px] font-semibold text-slate-400">
                          {row.product.sizeCm} سم
                        </span>
                      </p>
                      <p className="num text-[10px] font-semibold text-slate-400">
                        {row.product.code} · {row.product.pcsPerCarton} قطعة/كرتونة
                      </p>
                    </td>
                    <td className="num px-3 py-2.5 font-bold">{fmt(row.loads[0]?.pieces ?? 0)}</td>
                    <td className="num px-3 py-2.5 font-semibold">{money(row.loads[0]?.value ?? 0)}</td>
                    <td className="num px-3 py-2.5 font-bold">{fmt(row.loads[1]?.pieces ?? 0)}</td>
                    <td className="num px-3 py-2.5 font-semibold">{money(row.loads[1]?.value ?? 0)}</td>
                    <td className="num px-3 py-2.5 font-semibold">
                      {fmt1(row.loads[1]?.weightTons ?? 0)} طن
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge tone={(row.loads[0]?.pieces ?? 0) > 0 ? 'green' : 'amber'}>
                        {(row.loads[0]?.pieces ?? 0) > 0 ? 'جاهز للتصدير' : 'يحتاج مراجعة'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-4">
          <SectionHeading
            title="تنبيهات تشغيلية"
            subtitle="مؤشرات تحتاج قرارًا إداريًا"
            icon={<ShieldAlert size={17} />}
            action={<Badge tone="amber">{alerts.length} تنبيه</Badge>}
          />
          {alerts.length ? (
            <div className="scrollbar-thin mt-3 max-h-[330px] space-y-2 overflow-y-auto">
              {alerts.map((alert) => (
                <div
                  key={`${alert.title}-${alert.detail}`}
                  className={
                    alert.tone === 'rose'
                      ? 'rounded-xl border border-rose-100 bg-rose-50/60 p-2.5'
                      : alert.tone === 'amber'
                        ? 'rounded-xl border border-amber-100 bg-amber-50/60 p-2.5'
                        : 'rounded-xl border border-slate-200 bg-mist/60 p-2.5'
                  }
                >
                  <p className="flex items-start gap-1.5 text-[11px] font-extrabold text-ink">
                    <AlertTriangle
                      size={13}
                      className={
                        alert.tone === 'rose'
                          ? 'mt-0.5 shrink-0 text-rose-500'
                          : 'mt-0.5 shrink-0 text-amber-500'
                      }
                    />
                    {alert.title}
                  </p>
                  <p className="mt-1 pr-5 text-[10px] font-medium leading-relaxed text-slate-500">
                    {alert.detail}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-xl bg-emerald-50 px-3 py-4 text-center text-[11px] font-bold text-emerald-700">
              لا توجد تنبيهات — المؤشرات داخل الحدود المستهدفة.
            </p>
          )}
          <div className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-400">
            <ArrowUpRight size={12} />
            قيمة الشحن الإجمالية المقدّرة: {money(exportValue20)} ج.م لحاويات 20 قدم.
          </div>
        </Card>
      </div>
    </div>
  );
}
