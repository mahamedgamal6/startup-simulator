import { useMemo, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  BadgeCheck,
  Boxes,
  Calculator,
  Clock3,
  Container,
  Factory,
  Gauge,
  Layers,
  Lock,
  Package,
  PackagePlus,
  Pencil,
  PieChart,
  Plus,
  Printer,
  Ruler,
  Scale,
  Sparkles,
  Trash2,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react';
import { ProductArt, FAMILY_COLORS } from '../components/ProductArt';
import { ProductPicker } from '../components/ProductPicker';
import { EntityImage } from '../components/EntityImage';
import {
  Badge,
  Button,
  Card,
  Donut,
  IconButton,
  Modal,
  ProgressBar,
  RangeSlider,
  SectionHeading,
  cn,
  useToast,
} from '../components/ui';
import { AccessoryFormModal, ProductFormModal } from '../components/RecordForms';
import { useData } from '../lib/db';
import { fmt, fmt1, money, pct } from '../lib/format';
import {
  containerLoads,
  discCostOf,
  economicsOf,
  findCostForProduct,
  findPackagingForProduct,
  findRawForProduct,
} from '../lib/cost';
import {
  STAGE_DEFS,
  STAGE_GROUPS,
  buildJourney,
  cycleSeconds,
  formatCycle,
} from '../lib/journey';
import type { Accessory, Product, ResolvedStage } from '../types';

function Barcode({ value }: { value: string }) {
  const bars = useMemo(
    () =>
      value.split('').flatMap((digit) => {
        const width = 1 + (Number(digit) % 3);
        return [
          { width, dark: true },
          { width: 1, dark: false },
          { width: Math.max(1, (Number(digit) + 1) % 3), dark: true },
          { width: 1, dark: false },
        ];
      }),
    [value],
  );

  return (
    <div className="inline-flex flex-col items-start gap-1" dir="ltr">
      <div className="flex h-7 items-stretch gap-[2px] rounded-sm bg-white px-2 py-1">
        {bars.map((bar, index) => (
          <span
            key={index}
            style={{ width: bar.width, background: bar.dark ? '#1E1E1E' : 'transparent' }}
          />
        ))}
      </div>
      <span className="pl-2 text-[10px] font-semibold tracking-[0.18em] text-white/70 num">
        {value}
      </span>
    </div>
  );
}

function MiniSpec({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-mist/70 px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-[13px] font-extrabold text-ink num">{value}</div>
    </div>
  );
}

export function PassportScreen({
  can,
  productCode,
  onSelect,
  onPrint,
  log,
}: {
  can: (permission: string) => boolean;
  productCode: string;
  onSelect: (code: string) => void;
  onPrint: (payload: { code: string; mode: 'cost' | 'technical' }) => void;
  log: (action: string, detail: string) => void;
}) {
  const { db, upsert, remove, updateSettings, updateProductStages } = useData();
  const toast = useToast();
  const product = db.products.find((item) => item.code === productCode) ?? db.products[0];
  const [activeStage, setActiveStage] = useState<ResolvedStage | null>(null);
  const [productForm, setProductForm] = useState<{
    open: boolean;
    product: Product | null;
  }>({ open: false, product: null });
  const [accessoryForm, setAccessoryForm] = useState<{
    open: boolean;
    accessory: Accessory | null;
  }>({ open: false, accessory: null });
  const [deleteProductOpen, setDeleteProductOpen] = useState(false);
  const [deleteAccessory, setDeleteAccessory] = useState<Accessory | null>(null);
  const [machinesOpen, setMachinesOpen] = useState(false);
  const [machineDraft, setMachineDraft] = useState<Record<string, string>>({});
  const [stageTimeDraft, setStageTimeDraft] = useState<Record<string, string>>({});
  const [stageWorkersDraft, setStageWorkersDraft] = useState<Record<string, string>>({});

  const showCosts = can('passport.cost_view');
  const canSimulate = can('passport.simulate');
  const canEditSettings = can('settings.edit');
  const canPrint = can('passport.print_cost') || can('passport.print_technical');
  const factor = db.settings.aluminumFactor;
  const margin = db.settings.marginPct;

  if (!product) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm font-bold text-slate-500">لا توجد منتجات مسجّلة بعد.</p>
      </Card>
    );
  }

  const handlePrint = () =>
    onPrint({ code: product.code, mode: can('passport.print_cost') ? 'cost' : 'technical' });

  const raw = findRawForProduct(db, product.code);
  const cost = findCostForProduct(db, product.code);
  const packaging = findPackagingForProduct(db, product.code);
  const productAccessories = db.accessories.filter((item) =>
    item.productCodes.includes(product.code),
  );
  const accessoriesCost = productAccessories.reduce(
    (sum, item) => sum + item.qtyPerProduct * item.unitCost,
    0,
  );
  const stages = buildJourney(product, db.machinery, db.molds);
  const cycle = cycleSeconds(stages);
  const econ = economicsOf(cost, factor, margin);
  const discCost = discCostOf(raw, factor);
  const loads = containerLoads(product, econ.price);
  const accent = FAMILY_COLORS[product.family]?.color ?? '#ec1c24';
  const activeIndex = activeStage ? stages.findIndex((stage) => stage.key === activeStage.key) : -1;
  const aluminumPercent = Math.round((factor - 1) * 100);
  const longest = [...stages].sort((a, b) => b.seconds - a.seconds)[0];
  const peakWorkers = Math.max(...stages.map((stage) => stage.workers));

  const setFactor = (percent: number) => updateSettings({ aluminumFactor: 1 + percent / 100 });

  const canCreateProduct = can('data.products.create');
  const canEditProduct = can('data.products.edit');
  const canDeleteProduct = can('data.products.delete');
  const canViewAccessories = can('data.accessories.view');
  const canCreateAccessory = can('data.accessories.create');
  const canEditAccessory = can('data.accessories.edit');
  const canDeleteAccessory = can('data.accessories.delete');

  const saveProduct = async (next: Product) => {
    const isNew = !db.products.some((item) => item.id === next.id);
    if (db.products.some((item) => item.code === next.code && item.id !== next.id)) {
      toast('كود المنتج مستخدم بالفعل', 'error');
      return;
    }
    const productSaved = await upsert('products', next);
    if (!productSaved) return;
    if (!isNew && product.code !== next.code) {
      const oldCode = product.code;
      db.costElements
        .filter((item) => item.productCode === oldCode)
        .forEach((item) =>
          upsert('costElements', { ...item, productCode: next.code }),
        );
      db.rawMaterials
        .filter((item) => item.productCodes.includes(oldCode))
        .forEach((item) =>
          upsert('rawMaterials', {
            ...item,
            productCodes: item.productCodes.map((code) =>
              code === oldCode ? next.code : code,
            ),
          }),
        );
      db.packaging
        .filter((item) => item.productCodes.includes(oldCode))
        .forEach((item) =>
          upsert('packaging', {
            ...item,
            productCodes: item.productCodes.map((code) =>
              code === oldCode ? next.code : code,
            ),
          }),
        );
      db.accessories
        .filter((item) => item.productCodes.includes(oldCode))
        .forEach((item) =>
          upsert('accessories', {
            ...item,
            productCodes: item.productCodes.map((code) =>
              code === oldCode ? next.code : code,
            ),
          }),
        );
    }
    if (isNew) onSelect(next.code);
    log(
      isNew ? 'إضافة منتج' : 'تعديل بطاقة منتج',
      `${next.name} (${next.code})`,
    );
    toast(isNew ? 'تمت إضافة المنتج وفتح بطاقته' : 'تم تحديث بطاقة المنتج');
    setProductForm({ open: false, product: null });
  };

  const confirmDeleteProduct = async () => {
    if (!canDeleteProduct) return;
    const code = product.code;
    const deleted = await remove('products', product.id);
    if (!deleted) return;
    db.costElements
      .filter((item) => item.productCode === code)
      .forEach((item) => remove('costElements', item.id));
    db.rawMaterials
      .filter((item) => item.productCodes.includes(code))
      .forEach((item) =>
        upsert('rawMaterials', {
          ...item,
          productCodes: item.productCodes.filter((value) => value !== code),
        }),
      );
    db.packaging
      .filter((item) => item.productCodes.includes(code))
      .forEach((item) =>
        upsert('packaging', {
          ...item,
          productCodes: item.productCodes.filter((value) => value !== code),
        }),
      );
    db.accessories
      .filter((item) => item.productCodes.includes(code))
      .forEach((item) =>
        upsert('accessories', {
          ...item,
          productCodes: item.productCodes.filter((value) => value !== code),
        }),
      );
    const remaining = db.products.filter((item) => item.id !== product.id);
    if (remaining[0]) onSelect(remaining[0].code);
    log('حذف منتج', `${product.name} (${code})`);
    toast('تم حذف المنتج وتحديث الارتباطات المرتبطة به');
    setDeleteProductOpen(false);
  };

  const saveAccessory = async (next: Accessory) => {
    if (db.accessories.some((item) => item.code === next.code && item.id !== next.id)) {
      toast('كود الإكسسوار مستخدم بالفعل', 'error');
      return;
    }
    const isNew = !db.accessories.some((item) => item.id === next.id);
    const saved = await upsert('accessories', next);
    if (!saved) return;
    log(
      isNew ? 'إضافة إكسسوار' : 'تعديل إكسسوار',
      `${next.name} (${next.code}) — ${next.productCodes.length} منتج`,
    );
    toast(isNew ? 'تمت إضافة الإكسسوار للمنتج' : 'تم تحديث الإكسسوار');
    setAccessoryForm({ open: false, accessory: null });
  };

  const confirmDeleteAccessory = async () => {
    if (!deleteAccessory || !canDeleteAccessory) return;
    const deleted = await remove('accessories', deleteAccessory.id);
    if (!deleted) return;
    log('حذف إكسسوار', `${deleteAccessory.name} (${deleteAccessory.code})`);
    toast('تم حذف الإكسسوار');
    setDeleteAccessory(null);
  };

  const openMachineEditor = () => {
    setMachineDraft(
      Object.fromEntries(
        STAGE_DEFS.map((def) => [
          def.key,
          product.stageMachines?.[def.key] ?? def.machineCode,
        ]),
      ),
    );
    setStageTimeDraft(
      Object.fromEntries(
        STAGE_DEFS.map((def) => [
          def.key,
          String(stages.find((stage) => stage.key === def.key)?.seconds ?? def.baseSeconds),
        ]),
      ),
    );
    setStageWorkersDraft(
      Object.fromEntries(
        STAGE_DEFS.map((def) => [
          def.key,
          String(stages.find((stage) => stage.key === def.key)?.workers ?? def.workers),
        ]),
      ),
    );
    setActiveStage(null);
    setMachinesOpen(true);
  };

  const saveMachines = async () => {
    const overrides = Object.fromEntries(
      STAGE_DEFS.map((def) => [
        def.key,
        {
          seconds: Math.max(1, Math.round(Number(stageTimeDraft[def.key]) || 0)),
          workers: Math.max(1, Math.round(Number(stageWorkersDraft[def.key]) || 0)),
        },
      ]),
    );
    const saved = await updateProductStages(product.id, machineDraft, overrides);
    if (!saved) return;
    log('تعديل إعدادات مراحل المنتج', `${product.name} (${product.code})`);
    toast('تم حفظ الماكينة والزمن والعمالة لكل مرحلة');
    setMachinesOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">Digital Product Passport</Badge>
            <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
              <BadgeCheck size={13} /> بيانات معتمدة
            </span>
          </div>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">بطاقة المنتج الرقمية</h1>
          <p className="mt-1 max-w-2xl text-[13px] font-medium text-slate-500">
            وثيقة صناعية موحّدة تربط مواصفات المنتج بالخام والإسطمبة والماكينات والتكلفة
            والتعبئة في شاشة واحدة.
          </p>
        </div>
        {canPrint ? (
          <Button variant="outline" onClick={handlePrint}>
            <Printer size={16} />{' '}
            {can('passport.print_cost') ? 'طباعة البطاقة الرسمية' : 'طباعة البطاقة الفنية'}
          </Button>
        ) : null}
      </div>

      <Card className="p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <ProductPicker
            products={db.products}
            value={product.code}
            onChange={onSelect}
            className="min-w-0 flex-1"
          />
          <div className="flex flex-wrap items-center gap-2">
            {canCreateProduct ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setProductForm({ open: true, product: null })}
              >
                <Plus size={14} /> منتج جديد
              </Button>
            ) : null}
            {canEditProduct ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setProductForm({ open: true, product })}
              >
                <Pencil size={14} /> تعديل البطاقة
              </Button>
            ) : null}
            {canDeleteProduct ? (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setDeleteProductOpen(true)}
              >
                <Trash2 size={14} /> حذف
              </Button>
            ) : null}
          </div>
        </div>
      </Card>

      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-[#2a0d10] via-[#1d1d20] to-[#141416] p-5 text-white shadow-card sm:p-7">
        <div
          className="pointer-events-none absolute -left-16 -top-20 h-64 w-64 rounded-full opacity-30 blur-3xl"
          style={{ background: accent }}
        />
        <div className="pointer-events-none absolute -bottom-24 right-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center">
          <div
            className="mx-auto flex h-36 w-36 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/10 p-2 backdrop-blur-md lg:mx-0 lg:h-44 lg:w-44"
            style={{ boxShadow: `0 24px 60px -30px ${accent}` }}
          >
            <EntityImage
              ownerTable="products"
              ownerId={product.id}
              canEdit={canEditProduct}
              preview
              alt={product.name}
              className="h-full w-full rounded-2xl"
              fallback={<ProductArt product={product} />}
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="rounded-full px-2.5 py-1 text-[11px] font-extrabold"
                style={{ background: `${accent}2e`, color: '#fff' }}
              >
                خط {product.family}
              </span>
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white/70">
                صنع في مصر
              </span>
              <span className="flex items-center gap-1 rounded-full bg-emerald-400/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                <Sparkles size={12} /> ألومنيوم غذائي
              </span>
            </div>
            <h2 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">
              {product.name}
              <span className="mr-2 text-white/50">| {fmt(product.sizeCm)} سم</span>
            </h2>

            <div className="mt-4 flex flex-wrap items-end gap-5">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">
                  Product code
                </p>
                <p className="num mt-0.5 text-xl font-black tracking-[0.16em]">{product.code}</p>
              </div>
              <Barcode value={product.barcode} />
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
              {[
                { label: 'المقاس', value: `${fmt(product.sizeCm)} سم` },
                { label: 'الارتفاع', value: `${fmt1(product.heightCm)} سم` },
                { label: 'السعة', value: `${fmt1(product.capacityL)} لتر` },
                { label: 'الوزن الصافي', value: `${fmt1(product.netWeightKg * 1000)} جم` },
                { label: 'بعد التعبئة', value: `${fmt1(product.grossWeightKg * 1000)} جم` },
                { label: 'القطع/كرتونة', value: `${fmt(product.pcsPerCarton)} قطعة` },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 backdrop-blur-sm"
                >
                  <p className="text-[10px] font-bold text-white/45">{item.label}</p>
                  <p className="num mt-0.5 text-[13px] font-extrabold text-white">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col gap-2 lg:w-44">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-3 backdrop-blur-sm">
              <p className="flex items-center gap-1 text-[10px] font-bold text-white/45">
                <Clock3 size={12} /> زمن التصنيع للقطعة
              </p>
              <p className="mt-1 text-lg font-black num">{formatCycle(cycle)}</p>
              <p className="mt-0.5 text-[10px] font-medium text-white/40">
                17 مرحلة معتمدة
              </p>
            </div>
            {canPrint ? (
              <Button
                size="sm"
                className="w-full bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20"
                onClick={handlePrint}
              >
                <Printer size={14} /> إصدار PDF
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      {/* Info grid */}
      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-5">
          <SectionHeading
            title="الخامة والقرص"
            subtitle="مدخلات المادة الخام المعتمدة لهذا المنتج"
            icon={<Layers size={17} />}
            action={raw ? <Badge tone="blue">{raw.alloy}</Badge> : <Badge tone="amber">غير مرتبطة</Badge>}
          />

          {raw ? (
            <>
              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <MiniSpec label="قطر القرص" value={`${fmt1(raw.diameterCm)} سم`} icon={<Ruler size={11} />} />
                <MiniSpec label="سُمك الخام" value={`${fmt1(raw.thicknessMm)} مم`} icon={<Gauge size={11} />} />
                <MiniSpec label="وزن القرص" value={`${fmt(raw.discWeightKg * 1000)} جم`} icon={<Scale size={11} />} />
                <MiniSpec label="نسبة الهالك" value={pct(raw.wastePct)} icon={<ArrowLeftRight size={11} />} />
              </div>

              <div className="mt-4 rounded-2xl border border-brand/10 bg-brand-soft/50 p-3.5">
                <div className="flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-bold text-brand-dark/80">تكلفة قرص الخام</p>
                    <p className="mt-0.5 text-[10px] font-medium text-brand-dark/50">
                      {raw.discWeightKg.toFixed(3)} كجم × {money(raw.pricePerKg)} ج.م/كجم
                    </p>
                  </div>
                  <div className="text-left">
                    <p className="num text-xl font-black text-brand-dark">{money(discCost)} ج.م</p>
                    {aluminumPercent !== 0 ? (
                      <p className="text-[10px] font-bold text-brand">
                        {aluminumPercent > 0 ? '+' : ''}
                        {aluminumPercent}% بسعر السوق
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] font-semibold text-slate-500">
                <span>كود الخامة</span>
                <span className="num rounded bg-slate-100 px-1.5 py-0.5 font-bold text-ink">{raw.code}</span>
              </div>
              <p className="mt-2 text-[10px] leading-relaxed text-slate-400">
                سعر الكيلو المعتمد: {money(raw.pricePerKg)} ج.م — قيمة الخامة في التكلفة القياسية:{' '}
                {showCosts ? `${money(econ.rawAdjusted)} ج.م` : 'محجوبة حسب الصلاحية'}.
              </p>
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-amber-200 bg-amber-50/60 px-4 py-6 text-center">
              <p className="text-[12px] font-bold text-amber-700">لا يوجد قرص خام مرتبط بهذا المنتج</p>
              <p className="mt-1 text-[11px] text-amber-600/80">
                أضف قرصًا من مركز البيانات واربطه بكود المنتج {product.code}.
              </p>
            </div>
          )}
        </Card>

        {showCosts ? (
          <Card className="p-5 xl:col-span-7">
            <SectionHeading
              title="التكلفة والتحليل المالي"
              subtitle="تفكيك التكلفة ومحاكي سعر خام الألومنيوم الفوري"
              icon={<Calculator size={17} />}
              action={<Badge tone="green">هامش {fmt(margin)}%</Badge>}
            />

            <div className="mt-4 flex flex-col gap-5 sm:flex-row">
              <div className="mx-auto flex w-full max-w-[210px] shrink-0 flex-col items-center">
                <Donut
                  segments={econ.components.map((item) => ({
                    label: item.label,
                    value: item.value,
                    color: item.color,
                  }))}
                  size={176}
                  thickness={22}
                  center={
                    <>
                      <span className="text-[10px] font-bold text-slate-400">إجمالي التكلفة</span>
                      <span className="num text-xl font-black text-ink">{money(econ.total)}</span>
                      <span className="text-[10px] font-semibold text-slate-400">ج.م / قطعة</span>
                    </>
                  }
                />
                <div className="mt-3 w-full space-y-1.5">
                  {econ.components.map((item) => (
                    <div key={item.key} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2 w-2 rounded-full" style={{ background: item.color }} />
                      <span className="flex-1 font-semibold text-slate-500">{item.label}</span>
                      <span className="num font-bold text-ink">{money(item.value)}</span>
                      <span className="num w-9 text-left font-bold text-slate-400">
                        {pct(econ.total ? (item.value / econ.total) * 100 : 0, 0)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div className="rounded-2xl bg-gradient-to-l from-brand to-brand-deep p-4 text-white shadow-glow">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-[11px] font-bold text-white/70">سعر البيع المقترح</p>
                      <p className="num mt-1 text-2xl font-black">
                        {money(econ.price)} <span className="text-sm font-bold">ج.م</span>
                      </p>
                    </div>
                    <span className="rounded-lg bg-white/15 px-2 py-1 text-[10px] font-bold">
                      <TrendingUp size={11} className="ml-1 inline" />
                      {fmt(margin)}% هامش
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-white/10 px-2.5 py-1.5">
                      <span className="block text-white/60">ربح القطعة</span>
                      <span className="num font-extrabold">{money(econ.profit)} ج.م</span>
                    </div>
                    <div className="rounded-lg bg-white/10 px-2.5 py-1.5">
                      <span className="block text-white/60">تكلفة الخام</span>
                      <span className="num font-extrabold">{money(econ.rawAdjusted)} ج.م</span>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="flex items-center gap-1 text-slate-500">
                      <PieChart size={12} /> محاكي سعر خام الألومنيوم
                    </span>
                    <span
                      className={cn(
                        'num rounded-md px-1.5 py-0.5',
                        aluminumPercent === 0
                          ? 'bg-slate-100 text-slate-500'
                          : aluminumPercent > 0
                            ? 'bg-rose-50 text-rose-600'
                            : 'bg-emerald-50 text-emerald-600',
                      )}
                    >
                      {aluminumPercent > 0 ? '+' : ''}
                      {aluminumPercent}%
                    </span>
                  </div>
                  {canSimulate ? (
                    <div className="mt-2">
                      <RangeSlider
                        label="تغير سعر خام الألومنيوم"
                        value={aluminumPercent}
                        min={-20}
                        max={20}
                        step={1}
                        onChange={setFactor}
                      />
                      <div className="mt-1.5 flex justify-between text-[10px] font-semibold text-slate-400">
                        <span>-20%</span>
                        <button
                          className="text-brand hover:underline"
                          onClick={() => setFactor(0)}
                        >
                          إعادة الضبط
                        </button>
                        <span>+20%</span>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-400">
                      محاكي سعر الخام متاح لدور المدير المالي والإدارة العليا فقط.
                    </p>
                  )}
                </div>

                <div className="rounded-xl border border-slate-100 bg-mist/60 p-3">
                  <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">هامش الربح المستهدف</span>
                    <span className="num text-brand">{fmt(margin)}%</span>
                  </div>
                  {canEditSettings ? (
                    <div className="mt-2">
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
                    <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-2 text-[10px] font-semibold text-slate-400">
                      تعديل هامش الربح متاح للمدير المالي والإدارة العليا فقط.
                    </p>
                  )}
                  <p className="mt-2 flex items-start gap-1 text-[10px] leading-relaxed text-slate-400">
                    <Sparkles size={11} className="mt-0.5 shrink-0" />
                    إجمالي التكلفة وسعر البيع يُعاد حسابهما فوريًا دون تعديل الجداول.
                  </p>
                </div>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5 xl:col-span-7">
            <SectionHeading
              title="ملخص التصنيع"
              subtitle="بيانات تشغيلية معتمدة لمدير الإنتاج ومشرف الجودة"
              icon={<Factory size={17} />}
              action={
                <Badge tone="slate">
                  <Lock size={11} /> التكاليف محجوبة
                </Badge>
              }
            />
            <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <MiniSpec label="عدد المراحل" value="17 مرحلة" icon={<Factory size={11} />} />
              <MiniSpec label="زمن القطعة" value={formatCycle(cycle)} icon={<Clock3 size={11} />} />
              <MiniSpec label="أعلى عمالة بمرحلة" value={`${peakWorkers} عمال`} icon={<Users size={11} />} />
              <MiniSpec label="أطول مرحلة" value={longest ? longest.name : '—'} icon={<Gauge size={11} />} />
              <MiniSpec label="الإسطمبة" value={stages.find((s) => s.moldCode)?.moldCode ?? '—'} icon={<Boxes size={11} />} />
              <MiniSpec label="الماكينات" value={`${new Set(stages.map((s) => s.machineCode).filter(Boolean)).size} ماكينة`} icon={<Factory size={11} />} />
            </div>
            <div className="mt-4 rounded-xl bg-mist/70 p-3">
              <p className="text-[11px] font-bold text-slate-500">ماكينات المسار</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {Array.from(new Set(stages.filter((stage) => stage.machineCode).map((stage) => stage.machineName))).map(
                  (name) => (
                    <span key={name} className="chip chip-muted text-[10px]">
                      {name}
                    </span>
                  ),
                )}
              </div>
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
              <Lock size={12} /> أسعار البيع والتكاليف الحساسة غير متاحة لهذا الدور.
            </p>
          </Card>
        )}

        <Card className="p-5 xl:col-span-7">
          <SectionHeading
            title="التعبئة ومواصفات الشحن"
            subtitle="أبعاد الكرتونة وسعة الحاويات لكل منتج"
            icon={<Container size={17} />}
            action={<Badge tone="blue">{fmt(product.pcsPerCarton)} قطعة / كرتونة</Badge>}
          />

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-xl bg-mist/70 px-3 py-2 text-[11px]">
                <span className="font-semibold text-slate-500">حجم الكرتونة</span>
                <span className="num font-extrabold">
                  {product.cbm} CBM
                </span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mist/70 px-3 py-2 text-[11px]">
                <span className="font-semibold text-slate-500">الوزن بعد التعبئة / قطعة</span>
                <span className="num font-extrabold">{product.grossWeightKg} كجم</span>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-mist/70 px-3 py-2 text-[11px]">
                <span className="font-semibold text-slate-500">وزن الكرتونة الكاملة</span>
                <span className="num font-extrabold">
                  {fmt1(product.grossWeightKg * product.pcsPerCarton)} كجم
                </span>
              </div>

              <div className="rounded-xl border border-slate-100 p-3">
                <p className="flex items-center gap-1 text-[11px] font-bold text-slate-500">
                  <Package size={12} /> مكوّنات التغليف المرتبطة
                </p>
                {packaging.length ? (
                  <div className="mt-2 space-y-1.5">
                    {packaging.map((item) => (
                      <div key={item.id} className="flex items-center justify-between gap-2 text-[10px]">
                        <span className="min-w-0">
                          <span className="block truncate font-bold text-ink">{item.name}</span>
                          <span className="num block font-medium text-slate-400">
                            {item.code} · {fmt(item.lengthCm)}×{fmt(item.widthCm)}×{fmt(item.heightCm)} سم
                          </span>
                        </span>
                        <span className="num shrink-0 font-bold text-slate-600">
                          {showCosts ? `${money(item.unitCost)} ج.م` : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-[10px] text-slate-400">لا توجد مكوّنات تغليف مرتبطة.</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              {loads.map((load) => (
                <div
                  key={load.standard}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-l from-white to-mist/60 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink">
                      <Container size={13} className="text-elora" /> {load.standard}
                    </span>
                    <span className="num rounded-md bg-elora/10 px-1.5 py-0.5 text-[9px] font-bold text-elora">
                      {load.volumeCbm} CBM
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5 text-center">
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">كراتين</p>
                      <p className="num text-sm font-black">{fmt(load.cartons)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">قطعة</p>
                      <p className="num text-sm font-black">{fmt(load.pieces)}</p>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-slate-400">طن</p>
                      <p className="num text-sm font-black">{fmt1(load.weightTons)}</p>
                    </div>
                  </div>
                  <ProgressBar
                    value={(load.volumeUsed / load.volumeCbm) * 100}
                    color="#4A90E2"
                    className="mt-2 h-1.5"
                  />
                  {showCosts ? (
                    <p className="mt-2 flex items-center justify-between text-[10px] font-semibold text-slate-500">
                      <span>قيمة الشحنة بسعر البيع</span>
                      <span className="num font-extrabold text-ink">{money(load.value)} ج.م</span>
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-5 xl:col-span-5">
          <SectionHeading
            title="هوية التصنيع"
            subtitle="الإسطمبة والخطوط ومؤشرات الأداء التشغيلية"
            icon={<Factory size={17} />}
            action={<Badge tone="slate">{product.family}</Badge>}
          />
          <div className="mt-4 grid grid-cols-2 gap-2.5">
            <MiniSpec label="الإسطمبة المركبة" value={stages.find((s) => s.moldCode)?.moldCode ?? '—'} icon={<Boxes size={11} />} />
            <MiniSpec label="مراحل التشغيل" value="17" icon={<Factory size={11} />} />
            <MiniSpec label="زمن الدورة" value={formatCycle(cycle)} icon={<Clock3 size={11} />} />
            <MiniSpec label="أعلى عمالة" value={`${peakWorkers} عمال`} icon={<Users size={11} />} />
          </div>

          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>أطول مرحلة تشغيل</span>
              <span className="num text-ink">{longest?.seconds} ثانية</span>
            </div>
            <div className="rounded-xl bg-mist/70 px-3 py-2">
              <p className="text-[12px] font-extrabold text-ink">{longest?.name}</p>
              <p className="text-[10px] font-medium text-slate-400">{longest?.machineName}</p>
            </div>
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>توزيع المجموعات</span>
              <span>{(Object.keys(STAGE_GROUPS) as Array<keyof typeof STAGE_GROUPS>).length} مجموعات</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {(Object.entries(STAGE_GROUPS) as Array<[keyof typeof STAGE_GROUPS, (typeof STAGE_GROUPS)[keyof typeof STAGE_GROUPS]]>).map(
                ([key, meta]) => (
                  <span
                    key={key}
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold"
                    style={{ background: meta.soft, color: meta.color }}
                  >
                    {meta.label}
                    <span className="num opacity-70">
                      {stages.filter((stage) => stage.group === key).length}
                    </span>
                  </span>
                ),
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-4 w-full"
            onClick={() => document.getElementById('journey')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Factory size={14} /> استعراض رحلة التصنيع الكاملة
          </Button>
        </Card>
      </div>

      {canViewAccessories ? (
        <Card className="p-5">
          <SectionHeading
            title="الإكسسوارات المستخدمة في المنتج"
            subtitle="المقابض والمسامير والأغطية والمواد المرتبطة بهذه البطاقة"
            icon={<Wrench size={17} />}
            action={
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="slate">{productAccessories.length} صنف</Badge>
                {canCreateAccessory ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAccessoryForm({ open: true, accessory: null })}
                  >
                    <Plus size={14} /> إضافة إكسسوار
                  </Button>
                ) : null}
              </div>
            }
          />

          {productAccessories.length ? (
            <>
              <div className="scrollbar-thin mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-right text-[12px]">
                  <thead>
                    <tr className="bg-mist/80 text-[10px] font-bold text-slate-500">
                      <th className="px-3 py-2.5">الصنف</th>
                      <th className="px-3 py-2.5">المادة</th>
                      <th className="px-3 py-2.5">العدد / قطعة</th>
                      {showCosts ? <th className="px-3 py-2.5">تكلفة الوحدة</th> : null}
                      <th className="px-3 py-2.5">المورد</th>
                      <th className="px-3 py-2.5">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productAccessories.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2">
                            <EntityImage
                              ownerTable="accessories"
                              ownerId={item.id}
                              canEdit={canEditAccessory}
                              showControls={false}
                              preview
                              alt={item.name}
                              className="h-10 w-10 shrink-0 rounded-lg"
                              fallback={<Wrench size={15} className="text-slate-400" />}
                            />
                            <div className="min-w-0">
                              <p className="truncate font-bold text-ink">{item.name}</p>
                              <p className="num text-[10px] font-semibold text-slate-400">
                                {item.code}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 font-medium text-ink-soft">
                          {item.material || '—'}
                        </td>
                        <td className="num px-3 py-2.5 font-bold">
                          {fmt(item.qtyPerProduct)}
                        </td>
                        {showCosts ? (
                          <td className="num px-3 py-2.5 font-bold">
                            {money(item.unitCost)} ج.م
                          </td>
                        ) : null}
                        <td className="px-3 py-2.5 font-medium text-slate-500">
                          {item.origin || '—'}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1">
                            {canEditAccessory ? (
                              <IconButton
                                label="تعديل الإكسسوار"
                                className="h-8 w-8 hover:bg-brand-soft hover:text-brand"
                                onClick={() => setAccessoryForm({ open: true, accessory: item })}
                              >
                                <Pencil size={14} />
                              </IconButton>
                            ) : null}
                            {canDeleteAccessory ? (
                              <IconButton
                                label="حذف الإكسسوار"
                                className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                                onClick={() => setDeleteAccessory(item)}
                              >
                                <Trash2 size={14} />
                              </IconButton>
                            ) : null}
                            {!canEditAccessory && !canDeleteAccessory ? (
                              <span className="text-[10px] font-semibold text-slate-300">
                                للعرض فقط
                              </span>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {showCosts ? (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-brand/15 bg-brand-soft/60 px-4 py-3">
                  <span className="text-[12px] font-bold text-brand-dark">
                    تكلفة الإكسسوارات للقطعة
                  </span>
                  <span className="num text-lg font-black text-brand-dark">
                    {money(accessoriesCost)} ج.م
                  </span>
                </div>
              ) : null}
            </>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-200 bg-mist/50 px-4 py-8 text-center">
              <PackagePlus size={22} className="mx-auto text-slate-300" />
              <p className="mt-2 text-[12px] font-bold text-slate-500">
                لا توجد إكسسوارات مرتبطة بهذا المنتج بعد
              </p>
              <p className="mt-1 text-[11px] text-slate-400">
                أضف المقابض أو المسامير أو الغطاء من زر «إضافة إكسسوار» أعلاه، واختر المنتجات
                من القائمة دون كتابة أكوادها.
              </p>
            </div>
          )}
        </Card>
      ) : null}

      {/* Journey */}
      <Card className="p-5" id="journey">
        <SectionHeading
          title="مخطط مسار رحلة المنتج"
          subtitle="17 مرحلة تشغيل معتمدة — اضغط أي مرحلة لعرض الماكينة والإسطمبة وزمن التشغيل"
          icon={<Factory size={17} />}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{formatCycle(cycle)} / قطعة</Badge>
              {canEditProduct ? (
                <Button size="sm" variant="outline" onClick={openMachineEditor}>
                  <Wrench size={14} /> تعديل المراحل
                </Button>
              ) : null}
            </div>
          }
        />

        <div className="mt-5">
          <div className="scrollbar-thin overflow-x-auto pb-3">
            <div className="relative flex min-w-max items-start gap-1 px-1">
              <div className="absolute right-6 left-6 top-6 h-[3px] rounded-full bg-gradient-to-l from-brand/50 via-elora/40 to-crown/40" />
              {stages.map((stage, index) => {
                const meta = STAGE_GROUPS[stage.group];
                return (
                  <button
                    key={stage.key}
                    onClick={() => setActiveStage(stage)}
                    className="group relative z-10 w-[116px] shrink-0 rounded-xl px-1 py-1 text-center transition hover:bg-mist"
                  >
                    <span
                      className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-white text-[13px] font-black shadow-md transition group-hover:-translate-y-0.5 group-hover:shadow-lg"
                      style={{ background: meta.soft, color: meta.color }}
                    >
                      {index + 1}
                    </span>
                    <span className="mt-2 block min-h-[30px] text-[11px] font-bold leading-tight text-ink">
                      {stage.name}
                    </span>
                    <span className="num mt-0.5 block text-[10px] font-semibold text-slate-400">
                      {stage.seconds} ثانية · {stage.workers}{' '}
                      {stage.workers === 1 ? 'عامل' : 'عمال'}
                    </span>
                    <span
                      className={cn(
                        'mt-1 block truncate text-[9px] font-bold',
                        stage.machineCode ? 'text-slate-500' : 'text-amber-600',
                      )}
                    >
                      {stage.machineName}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3 text-[10px] font-semibold text-slate-500">
            <span className="flex items-center gap-1">
              <Clock3 size={12} className="text-brand" /> إجمالي الزمن: {formatCycle(cycle)}
            </span>
            <span className="flex items-center gap-1">
              <Users size={12} className="text-crown" /> إجمالي محطات العمل: 17
            </span>
            <span className="flex items-center gap-1">
              <Gauge size={12} className="text-elora" /> متوسط الزمن/مرحلة:{' '}
              {fmt1(cycle / 17)} ثانية
            </span>
          </div>
        </div>
      </Card>

      <Modal
        open={Boolean(activeStage)}
        onClose={() => setActiveStage(null)}
        title={activeIndex >= 0 ? `المرحلة ${activeIndex + 1} — ${activeStage?.name}` : ''}
        subtitle={activeStage?.description}
        size="md"
        footer={
          <>
            {canEditProduct ? (
              <Button variant="outline" onClick={openMachineEditor}>
                <Wrench size={14} /> تعديل إعدادات المرحلة
              </Button>
            ) : null}
            <Button variant="ghost" onClick={() => setActiveStage(null)}>
              إغلاق
            </Button>
          </>
        }
      >
        {activeStage ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold"
                style={{
                  background: STAGE_GROUPS[activeStage.group].soft,
                  color: STAGE_GROUPS[activeStage.group].color,
                }}
              >
                {STAGE_GROUPS[activeStage.group].label}
              </span>
              <Badge tone="blue">{activeStage.seconds} ثانية للقطعة</Badge>
              <Badge tone="green">
                {activeStage.workers} {activeStage.workers === 1 ? 'عامل' : 'عمال'}
              </Badge>
              <Badge tone="slate">تراكمي: {formatCycle(activeStage.cumulative)}</Badge>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="rounded-xl border border-slate-100 bg-mist/60 p-3">
                <p className="text-[10px] font-bold text-slate-400">الماكينة المستخدمة</p>
                <p className="mt-1 text-[13px] font-extrabold text-ink">{activeStage.machineName}</p>
                <p className="num mt-0.5 text-[10px] font-semibold text-slate-400">
                  {activeStage.machineCode ? `كود ${activeStage.machineCode}` : 'عمل يدوي'}
                </p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-mist/60 p-3">
                <p className="text-[10px] font-bold text-slate-400">الإسطمبة المركبة</p>
                <p className="num mt-1 text-[13px] font-extrabold text-ink">
                  {activeStage.moldCode ?? 'لا تحتاج إسطمبة'}
                </p>
                <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                  {activeStage.moldCode
                    ? db.molds.find((mold) => mold.code === activeStage.moldCode)?.drawType ?? ''
                    : 'محطة تشطيب أو تجميع'}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-100 p-3">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                <span>زمن المرحلة من إجمالي الدورة</span>
                <span className="num">{pct((activeStage.seconds / cycle) * 100)}</span>
              </div>
              <ProgressBar
                value={(activeStage.seconds / cycle) * 100}
                color={STAGE_GROUPS[activeStage.group].color}
                className="mt-2"
              />
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-lg bg-mist/70 px-2.5 py-1.5">
                  <span className="block text-[10px] text-slate-400">زمن تراكمي</span>
                  <span className="num font-bold">{activeStage.cumulative} ثانية</span>
                </div>
                <div className="rounded-lg bg-mist/70 px-2.5 py-1.5">
                  <span className="block text-[10px] text-slate-400">القطعة في الدقيقة</span>
                  <span className="num font-bold">{fmt1(60 / activeStage.seconds)}</span>
                </div>
              </div>
            </div>

            <p className="text-[11px] leading-relaxed text-slate-500">{activeStage.description}</p>
          </div>
        ) : null}
      </Modal>

      <ProductFormModal
        open={productForm.open}
        product={productForm.product}
        products={db.products}
        onClose={() => setProductForm({ open: false, product: null })}
        onSave={saveProduct}
      />

      <AccessoryFormModal
        open={accessoryForm.open}
        accessory={accessoryForm.accessory}
        productCode={product.code}
        products={db.products}
        onClose={() => setAccessoryForm({ open: false, accessory: null })}
        onSave={saveAccessory}
      />

      <Modal
        open={machinesOpen}
        onClose={() => setMachinesOpen(false)}
        title="إعدادات المراحل: الماكينة والزمن والعمالة"
        subtitle="القيم محفوظة لكل منتج على حدة؛ عدّل الزمن بالثواني وعدد العمال لكل مرحلة"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMachinesOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={() => void saveMachines()}>حفظ إعدادات المراحل</Button>
          </>
        }
      >
        <div className="space-y-2">
          {STAGE_DEFS.map((def, index) => {
            const meta = STAGE_GROUPS[def.group];
            return (
              <div
                key={def.key}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 p-2.5 lg:flex-row lg:items-center"
              >
                <span
                  className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[11px] font-black"
                  style={{ background: meta.soft, color: meta.color }}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px] font-extrabold text-ink">{def.name}</p>
                  <p className="text-[10px] font-semibold text-slate-400">{meta.label}</p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(170px,1fr)_88px_78px] lg:w-[430px]">
                  <label className="col-span-2 block sm:col-span-1">
                    <span className="text-[9px] font-bold text-slate-400">الماكينة</span>
                    <select
                      className="field mt-0.5"
                      value={machineDraft[def.key] ?? ''}
                      onChange={(event) =>
                        setMachineDraft((prev) => ({ ...prev, [def.key]: event.target.value }))
                      }
                    >
                      <option value="">عمل يدوي</option>
                      {db.machinery.map((machine) => (
                        <option key={machine.id} value={machine.code}>
                          {machine.code} — {machine.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-bold text-slate-400">الزمن (ث)</span>
                    <input
                      className="field num mt-0.5"
                      type="number"
                      min={1}
                      step={1}
                      value={stageTimeDraft[def.key] ?? ''}
                      onChange={(event) =>
                        setStageTimeDraft((prev) => ({
                          ...prev,
                          [def.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                  <label className="block">
                    <span className="text-[9px] font-bold text-slate-400">العمالة</span>
                    <input
                      className="field num mt-0.5"
                      type="number"
                      min={1}
                      step={1}
                      value={stageWorkersDraft[def.key] ?? ''}
                      onChange={(event) =>
                        setStageWorkersDraft((prev) => ({
                          ...prev,
                          [def.key]: event.target.value,
                        }))
                      }
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={deleteProductOpen}
        onClose={() => setDeleteProductOpen(false)}
        title="حذف بطاقة المنتج"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteProductOpen(false)}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={confirmDeleteProduct}>
              <Trash2 size={16} /> حذف نهائي
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[13px] font-medium text-slate-600">
          <p>
            سيتم حذف المنتج{' '}
            <span className="font-extrabold text-ink">{product.name}</span>{' '}
            <span className="num rounded bg-slate-100 px-1.5 py-0.5 font-bold text-ink">
              {product.code}
            </span>
            .
          </p>
          <p className="text-[12px] text-rose-600">
            ستُحذف عناصر التكلفة المرتبطة، وتُزال روابط الخام والتعبئة والإكسسوارات من هذا
            المنتج.
          </p>
          <p className="text-[11px] text-slate-400">لا يمكن التراجع عن هذه العملية.</p>
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteAccessory)}
        onClose={() => setDeleteAccessory(null)}
        title="حذف الإكسسوار"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteAccessory(null)}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={confirmDeleteAccessory}>
              <Trash2 size={16} /> حذف نهائي
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium text-slate-600">
          سيتم حذف الإكسسوار{' '}
          <span className="font-extrabold text-ink">{deleteAccessory?.name}</span> من جميع
          المنتجات المرتبطة به. لا يمكن التراجع عن هذه العملية.
        </p>
      </Modal>
    </div>
  );
}
