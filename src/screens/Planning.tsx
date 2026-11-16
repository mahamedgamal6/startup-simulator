import { useMemo, useState, type ReactNode } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  CheckCircle2,
  Clock3,
  Factory,
  Gauge,
  Package,
  Pause,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Send,
  Trash2,
  Ban,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  IconButton,
  Modal,
  ProgressBar,
  SectionHeading,
  Stat,
  cn,
  useToast,
} from '../components/ui';
import { useData, makeId } from '../lib/db';
import { useAuth } from '../auth/AuthContext';
import { fmt, fmt1, money, pct } from '../lib/format';
import { exportExcel } from '../lib/io';
import { PlanPrintSheet } from '../components/PlanPrintSheet';
import {
  PLAN_STATUS_FLOW,
  PLAN_STATUS_META,
  planMetrics,
  type PlanItemMetrics,
  type PlanMetrics,
} from '../lib/planning';
import { effectiveSpec, resolveVariant } from '../lib/cost';
import type { PlanStatus, ProductionPlan, ProductionPlanItem } from '../types';

const today = () => new Date().toISOString().slice(0, 10);
const nowIso = () => new Date().toISOString();


const emptyPlan = (owner: string): ProductionPlan => ({
  id: makeId('plan'),
  code: `PLN-${Date.now().toString().slice(-6)}`,
  name: 'خطة إنتاج جديدة',
  createdAt: nowIso(),
  startDate: today(),
  factory: 'مصنع الزنوكي',
  line: 'خط الإنتاج 1',
  shift: 'وردية صباحية',
  owner,
  targetDays: 0,
  notes: '',
  status: 'draft',
  shiftHours: 8,
  shiftsPerDay: 1,
  machinesAvailable: 1,
  plannedDowntimePct: 5,
  setupHours: 2,
  items: [],
});

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

export function PlanningScreen() {
  const { db, savePlan, deletePlan } = useData();
  const { can, log, currentUser } = useAuth();
  const toast = useToast();
  const [draft, setDraft] = useState<ProductionPlan | null>(null);
  const [filter, setFilter] = useState<PlanStatus | 'all'>('all');
  const [itemForm, setItemForm] = useState({ productCode: '', variantId: '', qty: '1', notes: '' });
  const [saving, setSaving] = useState(false);

  const plans = db.productionPlans ?? [];
  const canEdit = can('planning.edit');
  const canCreate = can('planning.create');
  const canApprove = can('planning.approve');
  const canDelete = can('planning.delete');
  const editable = Boolean(draft && (draft.status === 'draft' || draft.status === 'review') && canEdit);

  const metrics = useMemo<PlanMetrics | null>(
    () => (draft ? planMetrics(db, draft) : null),
    [db, draft],
  );
  const visiblePlans = useMemo(
    () => plans.filter((plan) => filter === 'all' || plan.status === filter),
    [plans, filter],
  );

  const stats = useMemo(() => {
    const units = plans.reduce(
      (sum, plan) => sum + plan.items.reduce((acc, item) => acc + Math.max(0, item.qty), 0),
      0,
    );
    return {
      total: plans.length,
      approved: plans.filter((plan) => ['approved', 'ready', 'running'].includes(plan.status)).length,
      running: plans.filter((plan) => plan.status === 'running').length,
      units,
    };
  }, [plans]);

  const openPlan = (plan: ProductionPlan) => {
    setDraft(JSON.parse(JSON.stringify(plan)) as ProductionPlan);
    const first = db.products.find((product) => !product.archived) ?? db.products[0];
    setItemForm({
      productCode: first?.code ?? '',
      variantId: first?.variants?.find((variant) => variant.active !== false)?.id ?? '',
      qty: '1',
      notes: '',
    });
  };

  const startNew = () => {
    const plan = emptyPlan(currentUser?.name ?? '');
    setDraft(plan);
    const first = db.products.find((product) => !product.archived) ?? db.products[0];
    setItemForm({
      productCode: first?.code ?? '',
      variantId: first?.variants?.find((variant) => variant.active !== false)?.id ?? '',
      qty: '1',
      notes: '',
    });
  };

  const selectedProduct = db.products.find((product) => product.code === itemForm.productCode);
  const variants = selectedProduct?.variants?.filter((variant) => variant.active !== false) ?? [];

  const addItem = () => {
    if (!draft || !selectedProduct) {
      toast('اختر منتجًا أولًا', 'error');
      return;
    }
    const qty = Math.max(1, Math.round(Number(itemForm.qty) || 0));
    const variant = resolveVariant(selectedProduct, itemForm.variantId);
    const spec = effectiveSpec(selectedProduct, variant ?? undefined);
    const item: ProductionPlanItem = {
      id: makeId('pitem'),
      productId: selectedProduct.id,
      productCode: selectedProduct.code,
      productName: selectedProduct.name,
      variantId: variant?.id,
      sizeLabel: spec.sizeLabel,
      colorName: spec.colorName,
      qty,
      notes: itemForm.notes,
    };
    const next = { ...draft, items: [...draft.items, item] };
    setDraft(next);
    setItemForm({ ...itemForm, qty: '1', notes: '' });
    toast(`تمت إضافة بند: ${selectedProduct.name} — ${spec.sizeLabel} / ${spec.colorName}`);
  };

  const updateItem = (id: string, patch: Partial<ProductionPlanItem>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    });
  };

  const removeItem = (id: string) => {
    if (!draft) return;
    setDraft({ ...draft, items: draft.items.filter((item) => item.id !== id) });
  };

  const persist = async (next: ProductionPlan, message: string, action: string) => {
    setSaving(true);
    const ok = await savePlan(next);
    setSaving(false);
    if (!ok) {
      toast('تعذر حفظ الخطة', 'error');
      return false;
    }
    setDraft(next);
    log(action, `${next.code} — ${next.name}`);
    toast(message);
    return true;
  };

  const validateForApproval = (): string[] => {
    if (!draft) return [];
    const problems: string[] = [];
    if (!draft.items.length) problems.push('أضف منتجًا واحدًا على الأقل للخطة.');
    if (!draft.name.trim()) problems.push('اسم الخطة مطلوب.');
    if (!draft.owner.trim()) problems.push('المسؤول عن الخطة مطلوب.');
    if (!draft.startDate) problems.push('تاريخ بدء الإنتاج مطلوب.');
    const missing = (metrics?.items ?? []).filter((row) => row.missing.length);
    if (missing.length) {
      problems.push(
        `${missing.length} بندًا ببيانات ناقصة (خام أو تعبئة أو زمن تشغيل). لا يمكن اعتماد خطة بتقدير غير مكتمل.`,
      );
    }
    return problems;
  };

  const approve = async () => {
    if (!draft || !metrics || !canApprove) return;
    const problems = validateForApproval();
    if (problems.length) {
      toast(problems[0], 'error');
      return;
    }
    const at = nowIso();
    const approver = currentUser?.name ?? '—';
    const next: ProductionPlan = {
      ...draft,
      status: 'approved',
      approvedAt: at,
      approvedBy: approver,
      snapshot: {
        at,
        approvedBy: approver,
        unitCount: metrics.unitCount,
        totalCost: metrics.totalCost,
        totalRevenue: metrics.totalRevenue,
        totalProfit: metrics.totalProfit,
        totalHours: metrics.requiredHours + metrics.setupHours,
        avgUnitCost: metrics.avgUnitCost,
      },
      items: draft.items.map((item) => {
        const row = metrics.items.find((entry) => entry.item.id === item.id);
        return {
          ...item,
          snapshot: {
            unitCost: row?.unitCost ?? 0,
            price: row?.price ?? 0,
            cycleSeconds: row?.cycle ?? 0,
            rawCode: row?.rawName ?? '',
            packagingCodes: row?.packagingNames ?? [],
            at,
          },
        };
      }),
    };
    await persist(next, 'تم اعتماد الخطة وتثبيت نسخة التكاليف (Cost Snapshot)', 'اعتماد خطة إنتاج');
  };

  const transition = async (status: PlanStatus, message: string) => {
    if (!draft) return;
    const next: ProductionPlan = { ...draft, status };
    if (draft.status === 'approved' && status === 'review') {
      // العودة للتعديل تلغي تجميد البنود حتى يُعاد الاعتماد بنسخة جديدة.
      next.items = draft.items.map((item) => ({ ...item, snapshot: undefined }));
    }
    await persist(next, message, `تغيير حالة خطة إلى ${PLAN_STATUS_META[status].label}`);
  };

  const saveActual = (item: ProductionPlanItem, patch: Partial<NonNullable<ProductionPlanItem['actual']>>) => {
    if (!draft) return;
    setDraft({
      ...draft,
      items: draft.items.map((row) =>
        row.id === item.id
          ? {
              ...row,
              actual: {
                producedQty: row.actual?.producedQty ?? 0,
                actualHours: row.actual?.actualHours ?? 0,
                actualCost: row.actual?.actualCost ?? 0,
                wastePct: row.actual?.wastePct ?? 0,
                deviationReason: row.actual?.deviationReason ?? '',
                ...patch,
                updatedAt: nowIso(),
              },
            }
          : row,
      ),
    });
  };

  const exportPlan = () => {
    if (!draft || !metrics) return;
    exportExcel({
      fileBase: `خطة-${draft.code}`,
      sheetName: 'خطة إنتاج',
      columns: [
        { key: 'product', label: 'المنتج' },
        { key: 'code', label: 'الكود' },
        { key: 'size', label: 'المقاس' },
        { key: 'color', label: 'اللون' },
        { key: 'qty', label: 'الكمية' },
        { key: 'cycle', label: 'زمن القطعة (ث)' },
        { key: 'unitCost', label: 'تكلفة الوحدة' },
        { key: 'totalCost', label: 'إجمالي التكلفة' },
        { key: 'price', label: 'سعر البيع' },
        { key: 'revenue', label: 'الإيراد المتوقع' },
        { key: 'hours', label: 'ساعات التشغيل' },
        { key: 'status', label: 'الحالة' },
      ],
      rows: metrics.items.map((row) => ({
        product: row.item.productName,
        code: row.item.productCode,
        size: row.item.sizeLabel,
        color: row.item.colorName,
        qty: row.item.qty,
        cycle: Math.round(row.cycle),
        unitCost: Number(row.unitCost.toFixed(2)),
        totalCost: Number(row.totalCost.toFixed(2)),
        price: Number(row.price.toFixed(2)),
        revenue: Number(row.revenue.toFixed(2)),
        hours: Number(row.hours.toFixed(2)),
        status: PLAN_STATUS_META[draft.status].label,
      })),
    });
    log('تصدير خطة إنتاج Excel', `${draft.code} — ${draft.name}`);
    toast('تم تصدير الخطة إلى Excel');
  };

  const rowStatus = (row: PlanItemMetrics) => {
    if (!row.product) return { tone: 'rose' as const, text: 'منتج محذوف' };
    if (row.missing.length) return { tone: 'amber' as const, text: 'بيانات ناقصة' };
    return { tone: 'green' as const, text: 'جاهز' };
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Production Planning</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">خطط الإنتاج والتشغيل</h1>
          <p className="mt-1 max-w-2xl text-[13px] font-medium text-slate-500">
            خطة تشغيل مرتبطة بتركيبات المنتجات والتكاليف والطاقة الإنتاجية، مع تثبيت نسخة
            التكاليف عند الاعتماد ومقارنة المخطط بالفعلي.
          </p>
        </div>
        {canCreate ? (
          <Button onClick={startNew}>
            <Plus size={16} /> إنشاء خطة إنتاج
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي الخطط" value={fmt(stats.total)} hint="كل الحالات" icon={<CalendarRange size={18} />} />
        <Stat label="خطط معتمدة/تشغيل" value={fmt(stats.approved)} hint="معتمدة أو جاهزة أو قيد التنفيذ" tone="elora" icon={<CheckCircle2 size={18} />} />
        <Stat label="قيد التنفيذ" value={fmt(stats.running)} hint="أوامر تشغيل نشطة" tone="crown" icon={<Play size={18} />} />
        <Stat label="إجمالي الوحدات المخططة" value={fmt(stats.units)} hint="كل البنود في كل الخطط" tone="prime" icon={<Package size={18} />} />
      </div>

      <Card className="p-5">
        <SectionHeading
          title="الخطط المسجّلة"
          subtitle="اختر خطة لعرض التفاصيل أو تعديلها حسب حالتها وصلاحياتك"
          icon={<CalendarRange size={17} />}
          action={
            <select
              className="input h-9 w-auto text-[11px]"
              value={filter}
              onChange={(event) => setFilter(event.target.value as PlanStatus | 'all')}
            >
              <option value="all">كل الحالات</option>
              {PLAN_STATUS_FLOW.map((status) => (
                <option key={status} value={status}>
                  {PLAN_STATUS_META[status].label}
                </option>
              ))}
            </select>
          }
        />
        {visiblePlans.length ? (
          <div className="scrollbar-thin mt-4 overflow-x-auto">
            <table className="w-full min-w-[860px] text-right text-[12px]">
              <thead>
                <tr className="bg-mist/80 text-[10px] font-bold text-slate-500">
                  <th className="px-3 py-2.5">الكود</th>
                  <th className="px-3 py-2.5">الخطة</th>
                  <th className="px-3 py-2.5">الحالة</th>
                  <th className="px-3 py-2.5">الوحدات</th>
                  <th className="px-3 py-2.5">التكلفة</th>
                  <th className="px-3 py-2.5">الإيراد</th>
                  <th className="px-3 py-2.5">المدة</th>
                  <th className="px-3 py-2.5">البداية</th>
                  <th className="px-3 py-2.5">النهاية المتوقعة</th>
                  <th className="px-3 py-2.5">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visiblePlans.map((plan) => {
                  const rowMetrics = planMetrics(db, plan);
                  const meta = PLAN_STATUS_META[plan.status];
                  return (
                    <tr key={plan.id} className="border-t border-slate-100 hover:bg-brand-soft/30">
                      <td className="num px-3 py-2.5 font-bold">{plan.code}</td>
                      <td className="px-3 py-2.5">
                        <span className="block font-extrabold text-ink">{plan.name}</span>
                        <span className="text-[10px] text-slate-400">
                          {plan.items.length} بند · {plan.line} · {plan.owner || 'بدون مسؤول'}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><Badge tone={meta.tone}>{meta.label}</Badge></td>
                      <td className="num px-3 py-2.5 font-bold">{fmt(rowMetrics.unitCount)}</td>
                      <td className="num px-3 py-2.5 font-bold">{money(rowMetrics.totalCost)}</td>
                      <td className="num px-3 py-2.5 font-bold">{money(rowMetrics.totalRevenue)}</td>
                      <td className="num px-3 py-2.5">{rowMetrics.days} يوم</td>
                      <td className="num px-3 py-2.5">{plan.startDate || '—'}</td>
                      <td className="num px-3 py-2.5">{rowMetrics.endDate || '—'}</td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <IconButton label="فتح الخطة" className="h-8 w-8 hover:bg-brand-soft hover:text-brand" onClick={() => openPlan(plan)}>
                            <Pencil size={14} />
                          </IconButton>
                          {canDelete && (plan.status === 'draft' || plan.status === 'cancelled') ? (
                            <IconButton
                              label="حذف الخطة"
                              className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                              onClick={async () => {
                                await deletePlan(plan.id);
                                log('حذف خطة إنتاج', `${plan.code} — ${plan.name}`);
                                toast('تم حذف الخطة');
                              }}
                            >
                              <Trash2 size={14} />
                            </IconButton>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-mist/50 px-4 py-10 text-center">
            <CalendarRange size={26} className="mx-auto text-slate-300" />
            <p className="mt-2 text-[12px] font-bold text-slate-500">لا توجد خطط إنتاج بهذه الحالة.</p>
            {canCreate ? (
              <Button size="sm" variant="outline" className="mt-3" onClick={startNew}>
                <Plus size={14} /> إنشاء أول خطة
              </Button>
            ) : null}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft ? `${draft.name} — ${draft.code}` : ''}
        subtitle="خطة إنتاج مرتبطة بتركيبات المنتجات، مع تكلفة وزمن وطاقة محسوبة من البيانات الفعلية."
        size="xl"
        overlayClassName="plan-print-overlay"
        panelClassName="plan-print-modal"
        footer={
          <>
            {draft ? (
              <>
                <Button variant="outline" size="sm" onClick={exportPlan} disabled={!metrics?.items.length}>
                  <FileSpreadsheet size={14} /> Excel
                </Button>
                <Button variant="outline" size="sm" onClick={() => window.print()} disabled={!metrics?.items.length}>
                  <Printer size={14} /> طباعة / PDF
                </Button>
              </>
            ) : null}
            <Button variant="ghost" onClick={() => setDraft(null)}>إغلاق</Button>
            {draft && editable ? (
              <Button onClick={() => persist(draft, 'تم حفظ الخطة', 'حفظ خطة إنتاج')} disabled={saving}>
                <Save size={15} /> حفظ الخطة
              </Button>
            ) : null}
          </>
        }
      >
        {draft && metrics ? (
          <>
          <div className="plan-editor space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-mist/60 p-3">
              <Badge tone={PLAN_STATUS_META[draft.status].tone}>{PLAN_STATUS_META[draft.status].label}</Badge>
              {draft.snapshot ? (
                <Badge tone="green">
                  <CheckCircle2 size={11} /> تكاليف معتمدة {new Date(draft.snapshot.at).toLocaleDateString('ar-EG')}
                </Badge>
              ) : null}
              <span className="text-[10px] font-semibold text-slate-400">
                أنشئت {new Date(draft.createdAt).toLocaleDateString('ar-EG')} · {draft.owner || 'بدون مسؤول'}
              </span>
              <div className="mr-auto flex flex-wrap items-center gap-1.5">
                {draft.status === 'draft' && canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => transition('review', 'تم إرسال الخطة للمراجعة')}>
                    <Send size={13} /> إرسال للمراجعة
                  </Button>
                ) : null}
                {draft.status === 'review' && canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => transition('draft', 'تمت إعادة الخطة لمسودة')}>
                    <RotateCcw size={13} /> مسودة
                  </Button>
                ) : null}
                {draft.status === 'review' && canApprove ? (
                  <Button size="sm" onClick={approve}>
                    <CheckCircle2 size={13} /> اعتماد وتثبيت التكاليف
                  </Button>
                ) : null}
                {draft.status === 'approved' && canApprove ? (
                  <Button size="sm" variant="outline" onClick={() => transition('review', 'تمت إعادة الخطة للتعديل')}>
                    <Pencil size={13} /> إعادة للتعديل
                  </Button>
                ) : null}
                {draft.status === 'approved' && canEdit ? (
                  <Button size="sm" variant="outline" onClick={() => transition('ready', 'الخطة جاهزة للتشغيل')}>
                    <Play size={13} /> جاهزة للتشغيل
                  </Button>
                ) : null}
                {draft.status === 'ready' && canEdit ? (
                  <Button size="sm" onClick={() => transition('running', 'بدأ تنفيذ الخطة')}>
                    <Play size={13} /> بدء التشغيل
                  </Button>
                ) : null}
                {draft.status === 'running' && canEdit ? (
                  <>
                    <Button size="sm" variant="outline" onClick={() => transition('paused', 'تم إيقاف الخطة مؤقتًا')}>
                      <Pause size={13} /> إيقاف مؤقت
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => transition('completed', 'تم إكمال الخطة')}>
                      <CheckCircle2 size={13} /> إكمال
                    </Button>
                  </>
                ) : null}
                {draft.status === 'paused' && canEdit ? (
                  <Button size="sm" onClick={() => transition('running', 'تم استئناف الخطة')}>
                    <Play size={13} /> استئناف
                  </Button>
                ) : null}
                {!['completed', 'cancelled'].includes(draft.status) && canDelete ? (
                  <Button size="sm" variant="danger" onClick={() => transition('cancelled', 'تم إلغاء الخطة')}>
                    <Ban size={13} /> إلغاء
                  </Button>
                ) : null}
              </div>
            </div>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <p className="text-[12px] font-black text-ink">بيانات الخطة الأساسية</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">اسم الخطة ومكان التنفيذ والمسؤول عنها</p>
                </div>
                <span className="rounded-full bg-mist px-2 py-0.5 text-[9px] font-bold text-slate-500 num">{draft.code}</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Field label="اسم الخطة" wide>
                  <input className="input" value={draft.name} disabled={!editable} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                </Field>
                <Field label="تاريخ بدء الإنتاج">
                  <input type="date" className="input num" value={draft.startDate} disabled={!editable} onChange={(event) => setDraft({ ...draft, startDate: event.target.value })} />
                </Field>
                <Field label="المصنع">
                  <input className="input" value={draft.factory} disabled={!editable} onChange={(event) => setDraft({ ...draft, factory: event.target.value })} />
                </Field>
                <Field label="خط الإنتاج">
                  <input className="input" value={draft.line} disabled={!editable} onChange={(event) => setDraft({ ...draft, line: event.target.value })} />
                </Field>
                <Field label="الوردية">
                  <input className="input" value={draft.shift} disabled={!editable} onChange={(event) => setDraft({ ...draft, shift: event.target.value })} />
                </Field>
                <Field label="المسؤول عن الخطة">
                  <input className="input" value={draft.owner} disabled={!editable} onChange={(event) => setDraft({ ...draft, owner: event.target.value })} />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                <div>
                  <p className="text-[12px] font-black text-ink">الطاقة والتشغيل</p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">تُستخدم هذه القيم في حساب الأيام والاختناق واستغلال الطاقة</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="مدة التنفيذ المستهدفة (يوم)">
                  <input className="input num" type="number" min={0} value={draft.targetDays} disabled={!editable} onChange={(event) => setDraft({ ...draft, targetDays: Number(event.target.value) || 0 })} />
                </Field>
                <Field label="ساعات الوردية">
                  <input className="input num" type="number" min={0.5} step={0.5} value={draft.shiftHours} disabled={!editable} onChange={(event) => setDraft({ ...draft, shiftHours: Number(event.target.value) || 8 })} />
                </Field>
                <Field label="عدد الورديات/يوم">
                  <input className="input num" type="number" min={1} value={draft.shiftsPerDay} disabled={!editable} onChange={(event) => setDraft({ ...draft, shiftsPerDay: Number(event.target.value) || 1 })} />
                </Field>
                <Field label="عدد الآلات المتاحة">
                  <input className="input num" type="number" min={1} value={draft.machinesAvailable} disabled={!editable} onChange={(event) => setDraft({ ...draft, machinesAvailable: Number(event.target.value) || 1 })} />
                </Field>
                <Field label="توقف وصيانة مخططة %">
                  <input className="input num" type="number" min={0} max={90} value={draft.plannedDowntimePct} disabled={!editable} onChange={(event) => setDraft({ ...draft, plannedDowntimePct: Number(event.target.value) || 0 })} />
                </Field>
                <Field label="ساعات تجهيز وتغيير مقاسات">
                  <input className="input num" type="number" min={0} step={0.5} value={draft.setupHours} disabled={!editable} onChange={(event) => setDraft({ ...draft, setupHours: Number(event.target.value) || 0 })} />
                </Field>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <Field label="ملاحظات الخطة">
                <textarea
                  className="input min-h-[64px] resize-y"
                  value={draft.notes}
                  disabled={!editable}
                  onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
                  placeholder="تعليمات التشغيل أو ملاحظات الجودة والتسليم"
                />
              </Field>
            </section>

            {editable ? (
              <div className="rounded-2xl border border-brand/15 bg-brand-soft/40 p-3">
                <p className="mb-2 text-[11px] font-black text-brand-dark">إضافة بند إنتاج (كل تركيبة منتج/مقاس/لون بند مستقل)</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
                  <label className="block lg:col-span-2">
                    <span className="label">المنتج</span>
                    <select
                      className="input"
                      value={itemForm.productCode}
                      onChange={(event) => {
                        const nextProduct = db.products.find((product) => product.code === event.target.value);
                        setItemForm({
                          ...itemForm,
                          productCode: event.target.value,
                          variantId:
                            nextProduct?.variants?.find((variant) => variant.active !== false)?.id ?? '',
                        });
                      }}
                    >
                      {db.products.filter((product) => !product.archived).map((product) => (
                        <option key={product.id} value={product.code}>{product.name} — {product.code}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">المقاس/اللون</span>
                    <select className="input" value={itemForm.variantId} onChange={(event) => setItemForm({ ...itemForm, variantId: event.target.value })}>
                      <option value="">المواصفات الأساسية</option>
                      {variants.map((variant) => (
                        <option key={variant.id} value={variant.id}>{variant.sizeLabel} — {variant.colorName}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="label">الكمية</span>
                    <input className="input num" type="number" min={1} value={itemForm.qty} onChange={(event) => setItemForm({ ...itemForm, qty: event.target.value })} />
                  </label>
                  <label className="block">
                    <span className="label">ملاحظات البند</span>
                    <input className="input" value={itemForm.notes} onChange={(event) => setItemForm({ ...itemForm, notes: event.target.value })} />
                  </label>
                  <div className="flex items-end">
                    <Button className="w-full" onClick={addItem}><Plus size={14} /> إضافة</Button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[980px] text-right text-[11px]">
                <thead>
                  <tr className="bg-mist/80 text-[10px] font-bold text-slate-500">
                    <th className="px-2 py-2">#</th>
                    <th className="px-2 py-2">المنتج</th>
                    <th className="px-2 py-2">المقاس</th>
                    <th className="px-2 py-2">اللون</th>
                    <th className="px-2 py-2">الكمية</th>
                    <th className="px-2 py-2">زمن/قطعة</th>
                    <th className="px-2 py-2">تكلفة الوحدة</th>
                    <th className="px-2 py-2">إجمالي التكلفة</th>
                    <th className="px-2 py-2">سعر البيع</th>
                    <th className="px-2 py-2">الإيراد</th>
                    <th className="px-2 py-2">الساعات</th>
                    <th className="px-2 py-2">الحالة</th>
                    <th className="px-2 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {metrics.items.length ? (
                    metrics.items.map((row, index) => {
                      const state = rowStatus(row);
                      return (
                        <tr key={row.item.id} className="border-t border-slate-100 align-top">
                          <td className="num px-2 py-2 text-slate-400">{index + 1}</td>
                          <td className="px-2 py-2">
                            <span className="block font-bold text-ink">{row.item.productName}</span>
                            <span className="num text-[9px] text-slate-400">{row.item.productCode}</span>
                          </td>
                          <td className="num px-2 py-2">{row.item.sizeLabel}</td>
                          <td className="px-2 py-2">{row.item.colorName}</td>
                          <td className="px-2 py-2">
                            {editable ? (
                              <input
                                className="input h-8 w-20 num text-[11px]"
                                type="number"
                                min={1}
                                value={row.item.qty}
                                onChange={(event) => updateItem(row.item.id, { qty: Math.max(1, Number(event.target.value) || 1) })}
                              />
                            ) : (
                              <span className="num font-bold">{fmt(row.item.qty)}</span>
                            )}
                          </td>
                          <td className="num px-2 py-2">{row.cycle ? `${Math.round(row.cycle)} ث` : '—'}</td>
                          <td className="num px-2 py-2 font-bold">{money(row.unitCost)}</td>
                          <td className="num px-2 py-2 font-bold">{money(row.totalCost)}</td>
                          <td className="num px-2 py-2">{money(row.price)}</td>
                          <td className="num px-2 py-2 font-bold text-crown">{money(row.revenue)}</td>
                          <td className="num px-2 py-2">{fmt1(row.hours)}</td>
                          <td className="px-2 py-2">
                            <Badge tone={state.tone}>{state.text}</Badge>
                            {row.frozen ? <span className="mt-1 block text-[9px] text-emerald-600">سعر مثبت</span> : null}
                          </td>
                          <td className="px-2 py-2">
                            {editable ? (
                              <IconButton label="حذف البند" className="h-7 w-7 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeItem(row.item.id)}>
                                <Trash2 size={13} />
                              </IconButton>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={13} className="px-3 py-6 text-center text-[11px] font-semibold text-slate-400">
                        لا توجد بنود بعد. أضف منتجًا ومقاسًا ولونًا وكمية.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 lg:grid-cols-3">
              <Card className="p-4 lg:col-span-2">
                <SectionHeading title="ملخص الجدوى والتكلفة" subtitle="كل القيم محسوبة من التكاليف الفعلية للتركيبات المختارة" icon={<Gauge size={16} />} />
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { label: 'إجمالي الوحدات', value: fmt(metrics.unitCount) },
                    { label: 'منتجات مختلفة', value: fmt(metrics.distinctProducts) },
                    { label: 'إجمالي التكلفة', value: `${money(metrics.totalCost)} ج.م` },
                    { label: 'تكلفة التعبئة', value: `${money(metrics.packagingCost)} ج.م` },
                    { label: 'تكلفة التشغيل', value: `${money(metrics.operatingCost)} ج.م` },
                    { label: 'الإيراد المتوقع', value: `${money(metrics.totalRevenue)} ج.م` },
                    { label: 'الربح المتوقع', value: `${money(metrics.totalProfit)} ج.م` },
                    { label: 'هامش الربح', value: pct(metrics.marginPct, 1) },
                    { label: 'متوسط تكلفة الوحدة', value: `${money(metrics.avgUnitCost)} ج.م` },
                  ].map((item) => (
                    <div key={item.label} className="rounded-xl bg-mist/70 px-3 py-2">
                      <p className="text-[9px] font-bold text-slate-400">{item.label}</p>
                      <p className="num mt-0.5 text-[12px] font-black text-ink">{item.value}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4">
                <SectionHeading title="الزمن والطاقة" subtitle="تقدير من الطاقة الفعلية وخطوط التشغيل" icon={<Clock3 size={16} />} />
                <div className="mt-3 space-y-2 text-[11px]">
                  <div className="flex justify-between"><span className="text-slate-500">ساعات التشغيل المطلوبة</span><span className="num font-bold">{fmt1(metrics.requiredHours)} س</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">ساعات التجهيز</span><span className="num font-bold">{fmt1(metrics.setupHours)} س</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">طاقة يومية متاحة</span><span className="num font-bold">{fmt1(metrics.effectiveDailyHours)} س</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">أيام التشغيل</span><span className="num font-bold">{fmt(metrics.days)} يوم</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">تاريخ الانتهاء المتوقع</span><span className="num font-bold">{metrics.endDate || '—'}</span></div>
                  <div className="flex justify-between"><span className="text-slate-500">الاختناق</span><span className="font-bold">{metrics.bottleneck?.item.productName ?? '—'}</span></div>
                  <div>
                    <div className="flex justify-between"><span className="text-slate-500">استغلال الطاقة</span><span className="num font-bold">{pct(metrics.utilization, 1)}</span></div>
                    <ProgressBar value={Math.min(metrics.utilization, 100)} color={metrics.utilization > 100 ? '#ec1c24' : '#447a72'} className="mt-1 h-2" />
                  </div>
                </div>
              </Card>
            </div>

            {metrics.warnings.length ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="flex items-center gap-1 text-[11px] font-black text-amber-800">
                  <AlertTriangle size={14} /> تنبيهات — التقدير غير نهائي حتى استكمال البيانات
                </p>
                <ul className="mt-2 space-y-1 text-[10px] font-semibold text-amber-700">
                  {metrics.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="flex items-center gap-1 text-[11px] font-black text-slate-600"><Package size={13} /> توافر الخامات والتعبئة</p>
                <div className="mt-2 space-y-1.5 text-[10px]">
                  {metrics.items.map((row) => (
                    <div key={`avail-${row.item.id}`} className="flex flex-wrap items-center justify-between gap-1 rounded-lg bg-mist/60 px-2.5 py-1.5">
                      <span className="font-bold text-ink">{row.item.productName} — {row.item.sizeLabel}</span>
                      <span className={row.rawOk ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>
                        خام: {row.rawOk ? row.rawName : 'غير مرتبط'}
                      </span>
                      <span className={row.packagingOk ? 'font-bold text-emerald-600' : 'font-bold text-rose-600'}>
                        تعبئة: {row.packagingOk ? `${row.packagingNames.length} مادة` : 'غير مرتبطة'}
                      </span>
                    </div>
                  ))}
                  {!metrics.items.length ? <p className="text-slate-400">أضف بنودًا لعرض التوافر.</p> : null}
                </div>
                <p className="mt-2 text-[9px] leading-relaxed text-slate-400">
                  لا توجد كميات مخزون حالية للخامات في النظام؛ يتم التحقق من الارتباط والمواصفات فقط.
                  أضف أرصدة المخزون لاحقًا لتفعيل مقارنة الكمية المطلوبة بالمخزون.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="flex items-center gap-1 text-[11px] font-black text-slate-600"><Factory size={13} /> مقارنة المخطط بالفعلي</p>
                {['approved', 'ready', 'running', 'paused', 'completed'].includes(draft.status) ? (
                  <div className="mt-2 space-y-2">
                    {metrics.items.map((row) => {
                      const actual = row.item.actual;
                      const deviation = actual
                        ? actual.producedQty - row.item.qty
                        : 0;
                      return (
                        <div key={`actual-${row.item.id}`} className="rounded-xl border border-slate-100 p-2.5">
                          <p className="text-[10px] font-bold text-ink">{row.item.productName} — {row.item.sizeLabel}</p>
                          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                            <label className="block">
                              <span className="text-[9px] text-slate-400">المنتج فعليًا</span>
                              <input className="input h-7 num text-[10px]" type="number" min={0} value={actual?.producedQty ?? 0} onChange={(event) => saveActual(row.item, { producedQty: Number(event.target.value) || 0 })} />
                            </label>
                            <label className="block">
                              <span className="text-[9px] text-slate-400">ساعات فعلية</span>
                              <input className="input h-7 num text-[10px]" type="number" min={0} step={0.5} value={actual?.actualHours ?? 0} onChange={(event) => saveActual(row.item, { actualHours: Number(event.target.value) || 0 })} />
                            </label>
                            <label className="block">
                              <span className="text-[9px] text-slate-400">تكلفة فعلية</span>
                              <input className="input h-7 num text-[10px]" type="number" min={0} value={actual?.actualCost ?? 0} onChange={(event) => saveActual(row.item, { actualCost: Number(event.target.value) || 0 })} />
                            </label>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[9px] font-semibold">
                            <span className="text-slate-500">مخطط: {fmt(row.item.qty)} وحدة / {money(row.totalCost)} ج.م</span>
                            <span className={deviation < 0 ? 'text-rose-600' : 'text-emerald-600'}>انحراف الكمية: {deviation >= 0 ? '+' : ''}{fmt(deviation)}</span>
                          </div>
                          <input className="input mt-1.5 h-7 text-[10px]" placeholder="سبب الانحراف" value={actual?.deviationReason ?? ''} onChange={(event) => saveActual(row.item, { deviationReason: event.target.value })} />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl bg-mist/60 px-3 py-4 text-center text-[10px] font-semibold text-slate-400">
                    تظهر مقارنة المخطط بالفعلي بعد اعتماد الخطة وبدء التشغيل.
                  </p>
                )}
                {['approved', 'ready', 'running', 'paused', 'completed'].includes(draft.status) && canEdit ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={() => persist(draft, 'تم حفظ بيانات التنفيذ الفعلي', 'تحديث التنفيذ الفعلي لخطة إنتاج')}
                  >
                    <Save size={13} /> حفظ بيانات التنفيذ الفعلي
                  </Button>
                ) : null}
              </div>
            </div>

            {draft.snapshot ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-[10px] font-semibold text-emerald-800">
                نسخة التكاليف المعتمدة (Cost Snapshot) بتاريخ {new Date(draft.snapshot.at).toLocaleString('ar-EG')} بواسطة {draft.snapshot.approvedBy} —
                {' '}إجمالي التكلفة {money(draft.snapshot.totalCost)} ج.م، الإيراد {money(draft.snapshot.totalRevenue)} ج.م،
                {' '}الوحدات {fmt(draft.snapshot.unitCount)}، الساعات {fmt1(draft.snapshot.totalHours)}.
                تعديل بطاقة المنتج لاحقًا لا يغيّر هذه القيم.
              </div>
            ) : null}

          </div>
          <PlanPrintSheet plan={draft} metrics={metrics} />
          </>
        ) : null}
      </Modal>
    </div>
  );
}
