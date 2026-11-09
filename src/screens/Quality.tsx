import { useMemo, useState } from 'react';
import {
  Check,
  ClipboardCheck,
  Factory,
  Package,
  Printer,
  RotateCcw,
  Ruler,
  Scale,
  ShieldCheck,
  X,
  Wrench,
} from 'lucide-react';
import { ProductArt, FAMILY_COLORS } from '../components/ProductArt';
import { ProductPicker } from '../components/ProductPicker';
import {
  Badge,
  Button,
  Card,
  Donut,
  Modal,
  SectionHeading,
  cn,
  useToast,
} from '../components/ui';
import { useData } from '../lib/db';
import { fmt, fmt1, pct } from '../lib/format';
import { QUALITY_CHECKS } from '../data/quality';
import { buildJourney, cycleSeconds, formatCycle } from '../lib/journey';
import type { InspectionStatus } from '../types';

const STATUS_META: Record<
  InspectionStatus,
  { label: string; color: string; tone: 'green' | 'rose' | 'amber'; icon: typeof Check }
> = {
  pass: { label: 'مطابق', color: '#10b981', tone: 'green', icon: Check },
  fail: { label: 'غير مطابق', color: '#ec1c24', tone: 'rose', icon: X },
  rework: { label: 'هالك إصلاح', color: '#f0a640', tone: 'amber', icon: Wrench },
};

export function QualityScreen({
  can,
  productCode,
  onSelect,
  onPrint,
}: {
  can: (permission: string) => boolean;
  productCode: string;
  onSelect: (code: string) => void;
  onPrint: (payload: { code: string; mode: 'cost' | 'technical' }) => void;
}) {
  const { db, setInspection, clearInspections } = useData();
  const toast = useToast();
  const canInspect = can('quality.inspect');
  const [confirmReset, setConfirmReset] = useState(false);

  const product = db.products.find((item) => item.code === productCode) ?? db.products[0];
  const stages = product ? buildJourney(product, db.machinery, db.molds) : [];
  const inspections = useMemo(
    () => db.inspections.filter((item) => item.productCode === product?.code),
    [db.inspections, product?.code],
  );

  const counts = {
    pass: inspections.filter((item) => item.status === 'pass').length,
    fail: inspections.filter((item) => item.status === 'fail').length,
    rework: inspections.filter((item) => item.status === 'rework').length,
  };
  const inspected = counts.pass + counts.fail + counts.rework;
  const passRate = inspected ? (counts.pass / inspected) * 100 : 0;

  const tech = product
    ? [
        { label: 'كود المنتج', value: product.code },
        { label: 'الباركود الدولي', value: product.barcode },
        { label: 'المقاس', value: `${fmt(product.sizeCm)} سم` },
        { label: 'الارتفاع', value: `${fmt1(product.heightCm)} سم` },
        { label: 'السعة', value: `${fmt1(product.capacityL)} لتر` },
        { label: 'الوزن الصافي', value: `${fmt1(product.netWeightKg * 1000)} جم` },
        { label: 'الوزن بعد التعبئة', value: `${fmt1(product.grossWeightKg * 1000)} جم` },
        { label: 'حجم الكرتونة', value: `${product.cbm} CBM` },
        { label: 'القطع بالكرتونة', value: `${fmt(product.pcsPerCarton)} قطعة` },
        { label: 'الإسطمبة', value: stages.find((stage) => stage.moldCode)?.moldCode ?? '—' },
        { label: 'عدد المراحل', value: '17 مرحلة' },
        { label: 'زمن الدورة', value: formatCycle(cycleSeconds(stages)) },
      ]
    : [];

  if (!product) {
    return (
      <Card className="p-10 text-center text-sm font-bold text-slate-500">
        لا توجد منتجات مسجّلة.
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Quality Control</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">
            الجودة والتشغيل الفني
          </h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            بطاقة المنتج الفنية ونقاط الفحص والاختبار — بدون أي بيانات تكلفة أو أسعار بيع.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {can('passport.print_technical') ? (
            <Button variant="outline" onClick={() => onPrint({ code: product.code, mode: 'technical' })}>
              <Printer size={16} /> طباعة البطاقة الفنية
            </Button>
          ) : null}
          {can('quality.reset') ? (
            <Button variant="ghost" onClick={() => setConfirmReset(true)}>
              <RotateCcw size={16} /> بدء جولة جديدة
            </Button>
          ) : null}
        </div>
      </div>

      <Card className="p-3">
        <ProductPicker products={db.products} value={product.code} onChange={onSelect} />
      </Card>

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-5">
          <SectionHeading
            title="البطاقة الفنية للمنتج"
            subtitle="مواصفات التصنيع والتعبئة المعتمدة"
            icon={<ClipboardCheck size={17} />}
            action={<Badge tone="slate">{product.family}</Badge>}
          />
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-mist/70 p-4">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-white bg-white p-1 shadow-sm"
              style={{ background: FAMILY_COLORS[product.family]?.soft }}
            >
              <ProductArt product={product} />
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-extrabold text-ink">{product.name}</p>
              <p className="num mt-0.5 text-[11px] font-semibold text-slate-500">
                {product.code} · {fmt(product.sizeCm)} سم
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="blue">{fmt1(product.capacityL)} لتر</Badge>
                <Badge tone="slate">
                  <Scale size={11} /> {fmt1(product.netWeightKg * 1000)} جم
                </Badge>
                <Badge tone="green">
                  <ShieldCheck size={11} /> معتمد
                </Badge>
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {tech.map((item) => (
              <div key={item.label} className="rounded-lg border border-slate-100 px-2.5 py-2">
                <p className="text-[9px] font-bold text-slate-400">{item.label}</p>
                <p className="num mt-0.5 text-[11px] font-extrabold text-ink">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 flex items-center gap-2 rounded-xl bg-brand-soft/60 px-3 py-2 text-[10px] font-semibold text-brand-dark">
            <Ruler size={13} /> سُمك الخام وقطر القرص متاحان في بطاقة المنتج الرقمية.
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-7">
          <Card className="p-5">
            <SectionHeading
              title="ملخص نتائج الفحص"
              subtitle="نسبة المطابقة وقرارات الجولة الحالية"
              icon={<ShieldCheck size={17} />}
              action={
                <Badge tone={counts.fail ? 'rose' : inspected ? 'green' : 'slate'}>
                  {inspected ? `مُفحوص ${inspected} / ${QUALITY_CHECKS.length}` : 'لم تبدأ الجولة'}
                </Badge>
              }
            />
            <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row">
              <Donut
                size={148}
                thickness={18}
                segments={[
                  { label: 'مطابق', value: counts.pass, color: STATUS_META.pass.color },
                  { label: 'غير مطابق', value: counts.fail, color: STATUS_META.fail.color },
                  { label: 'هالك إصلاح', value: counts.rework, color: STATUS_META.rework.color },
                ]}
                center={
                  <>
                    <span className="num text-xl font-black text-ink">{pct(passRate, 0)}</span>
                    <span className="text-[9px] font-bold text-slate-400">نسبة المطابقة</span>
                  </>
                }
              />
              <div className="grid w-full flex-1 grid-cols-3 gap-2">
                {(['pass', 'fail', 'rework'] as InspectionStatus[]).map((status) => {
                  const meta = STATUS_META[status];
                  return (
                    <div
                      key={status}
                      className="rounded-xl border border-slate-100 px-2 py-2.5 text-center"
                    >
                      <span
                        className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg"
                        style={{ background: `${meta.color}18`, color: meta.color }}
                      >
                        <meta.icon size={15} />
                      </span>
                      <p className="mt-1.5 text-[10px] font-bold text-slate-500">{meta.label}</p>
                      <p className="num text-lg font-black" style={{ color: meta.color }}>
                        {counts[status]}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium leading-relaxed text-slate-400">
              تُحفظ نتائج الفحص تلقائيًا لكل منتج على Supabase وتتزامن بين الأجهزة، ويمكن
              تصديرها ضمن استمارة الجودة عند الطباعة.
            </p>
          </Card>

          <Card className="p-5">
            <SectionHeading
              title="نقاط الفحص والاختبار"
              subtitle="8 نقاط اعتماد — اختر نتيجة كل نقطة وأضف ملاحظتك"
              icon={<ClipboardCheck size={17} />}
              action={<Badge tone="slate">{QUALITY_CHECKS.length} نقطة</Badge>}
            />
            <div className="mt-3 space-y-2">
              {QUALITY_CHECKS.map((check, index) => {
                const current = inspections.find((item) => item.checkId === check.id);
                return (
                  <div
                    key={check.id}
                    className={cn(
                      'rounded-xl border p-3 transition',
                      current
                        ? current.status === 'pass'
                          ? 'border-emerald-100 bg-emerald-50/40'
                          : current.status === 'fail'
                            ? 'border-rose-100 bg-rose-50/40'
                            : 'border-amber-100 bg-amber-50/40'
                        : 'border-slate-100',
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex min-w-0 items-start gap-2">
                        <span className="num mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-white text-[10px] font-bold text-slate-400 ring-1 ring-slate-200">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-[12px] font-extrabold text-ink">{check.label}</p>
                          <p className="mt-0.5 text-[10px] font-medium text-slate-500">
                            {check.criteria}
                          </p>
                          {check.appliesTo ? (
                            <p className="mt-0.5 text-[9px] font-bold text-slate-400">
                              {check.appliesTo}
                            </p>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        {(['pass', 'fail', 'rework'] as InspectionStatus[]).map((status) => {
                          const meta = STATUS_META[status];
                          const active = current?.status === status;
                          return (
                            <button
                              key={status}
                              onClick={() =>
                                canInspect && setInspection(product.code, check.id, { status })
                              }
                              disabled={!canInspect}
                              title={meta.label}
                              className={cn(
                                'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-bold transition',
                                active
                                  ? 'border-transparent text-white shadow-sm'
                                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300',
                                !canInspect && 'cursor-not-allowed opacity-50',
                              )}
                              style={active ? { background: meta.color } : undefined}
                            >
                              <meta.icon size={11} />
                              {meta.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <input
                      value={current?.note ?? ''}
                      onChange={(event) =>
                        canInspect &&
                        setInspection(product.code, check.id, {
                          status: current?.status ?? 'pass',
                          note: event.target.value,
                        })
                      }
                      disabled={!canInspect}
                      placeholder="ملاحظة الفحص (اختياري)..."
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-medium outline-none transition focus:border-brand/40 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <SectionHeading
          title="المسار الفني المعتمد"
          subtitle="تسلسل المراحل والماكينات المستخدمة في تصنيع هذا المنتج"
          icon={<Factory size={17} />}
          action={<Badge tone="blue">{formatCycle(cycleSeconds(stages))}</Badge>}
        />
        <div className="scrollbar-thin mt-3 flex gap-1.5 overflow-x-auto pb-2">
          {stages.map((stage, index) => (
            <div
              key={stage.key}
              className="w-[132px] shrink-0 rounded-xl border border-slate-100 p-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="num flex h-5 w-5 items-center justify-center rounded-md bg-brand-soft text-[9px] font-black text-brand">
                  {index + 1}
                </span>
                <span className="num text-[9px] font-bold text-slate-400">{stage.seconds}ث</span>
              </div>
              <p className="mt-1.5 text-[10px] font-extrabold leading-tight text-ink">
                {stage.name}
              </p>
              <p className="mt-0.5 truncate text-[9px] font-medium text-slate-400">
                {stage.machineCode ? `ماكينة ${stage.machineCode}` : 'عمل يدوي'}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-semibold text-slate-400">
          <span className="flex items-center gap-1">
            <Package size={12} /> {fmt(product.pcsPerCarton)} قطعة/كرتونة
          </span>
          <span className="flex items-center gap-1">
            <ShieldCheck size={12} /> {QUALITY_CHECKS.length} نقاط فحص
          </span>
        </div>
      </Card>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="بدء جولة فحص جديدة"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmReset(false);
                const cleared = await clearInspections(product.code);
                if (cleared) toast('تم مسح نتائج الجولة السابقة لهذا المنتج');
              }}
            >
              <RotateCcw size={15} /> مسح النتائج
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-slate-600">
          سيتم مسح جميع نتائج الفحص والملاحظات المسجلة للمنتج «{product.name}» والبدء من جديد.
          لا يمكن التراجع.
        </p>
      </Modal>
    </div>
  );
}
