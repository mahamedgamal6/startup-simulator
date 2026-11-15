import type {
  Database,
  PlanStatus,
  ProductionPlan,
  ProductionPlanItem,
  Product,
  ProductVariant,
} from '../types';
import {
  computeCostForProduct,
  effectiveSpec,
  economicsOf,
  findPackagingForProduct,
  findRawForProduct,
  packagingUnitQty,
  resolveVariant,
} from './cost';
import { buildJourney, cycleSeconds } from './journey';

export interface PlanItemMetrics {
  item: ProductionPlanItem;
  product?: Product;
  variant?: ProductVariant;
  unitCost: number;
  price: number;
  profit: number;
  cycle: number;
  hours: number;
  totalCost: number;
  revenue: number;
  packagingCost: number;
  operatingCost: number;
  rawName: string;
  rawOk: boolean;
  packagingNames: string[];
  packagingOk: boolean;
  missing: string[];
  frozen: boolean;
}

export interface PlanMetrics {
  items: PlanItemMetrics[];
  unitCount: number;
  distinctProducts: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  marginPct: number;
  packagingCost: number;
  operatingCost: number;
  requiredHours: number;
  setupHours: number;
  effectiveDailyHours: number;
  days: number;
  endDate: string;
  utilization: number;
  avgUnitCost: number;
  bottleneck?: PlanItemMetrics;
  warnings: string[];
}

export function planCycleSeconds(db: Database, product: Product, variant?: ProductVariant): number {
  if (variant?.cycleSeconds && variant.cycleSeconds > 0) return variant.cycleSeconds;
  return cycleSeconds(buildJourney(product, db.machinery, db.molds));
}

export function planItemMetrics(
  db: Database,
  item: ProductionPlanItem,
): PlanItemMetrics {
  const product = db.products.find((row) => row.code === item.productCode);
  const variant = resolveVariant(product, item.variantId);
  const missing: string[] = [];
  if (!product) missing.push('المنتج غير موجود في البيانات');
  const qty = Math.max(0, item.qty || 0);
  const cycle = product
    ? planCycleSeconds(db, product, variant)
    : (item.snapshot?.cycleSeconds ?? 0);
  const liveCost = product
    ? computeCostForProduct(db, product.code, item.variantId)
    : undefined;
  const liveEcon = product
    ? economicsOf(
        db,
        product.code,
        db.settings.aluminumFactor,
        db.settings.marginPct,
        item.variantId,
      )
    : undefined;
  const raw = product ? findRawForProduct(db, product.code) : undefined;
  const packaging = product ? findPackagingForProduct(db, product.code) : [];
  if (product && !raw) missing.push('لا يوجد قرص خام مرتبط');
  if (product && !packaging.length) missing.push('لا توجد مواد تعبئة مرتبطة');
  if (product && !cycle) missing.push('زمن التشغيل غير معروف');
  const packagingCost = product
    ? packaging.reduce(
        (sum, row) => sum + packagingUnitQty(row, variant) * row.unitCost,
        0,
      )
    : 0;
  const operatingCost = (liveCost?.labor ?? 0) + (liveCost?.overhead ?? 0);
  const frozen = Boolean(item.snapshot);
  const unitCost = item.snapshot?.unitCost ?? liveEcon?.total ?? 0;
  const price = item.snapshot?.price ?? liveEcon?.price ?? 0;

  return {
    item,
    product,
    variant,
    unitCost,
    price,
    profit: (price - unitCost) * qty,
    cycle,
    hours: (cycle * qty) / 3600,
    totalCost: unitCost * qty,
    revenue: price * qty,
    packagingCost: packagingCost * qty,
    operatingCost: operatingCost * qty,
    rawName: raw?.name ?? item.snapshot?.rawCode ?? '—',
    rawOk: Boolean(raw) || Boolean(item.snapshot),
    packagingNames: packaging.length
      ? packaging.map((row) => row.name)
      : (item.snapshot?.packagingCodes ?? []),
    packagingOk: packaging.length > 0 || Boolean(item.snapshot),
    missing,
    frozen,
  };
}

export function addWorkingDays(startDate: string, days: number): string {
  const base = new Date(`${startDate || new Date().toISOString().slice(0, 10)}T00:00:00`);
  if (Number.isNaN(base.getTime())) return '';
  let remaining = Math.max(0, Math.ceil(days));
  const cursor = new Date(base);
  let guard = 0;
  while (remaining > 0 && guard < 3650) {
    cursor.setDate(cursor.getDate() + 1);
    // الجمعة يوم راحة أسبوعي في المصنع
    if (cursor.getDay() !== 5) remaining -= 1;
    guard += 1;
  }
  return cursor.toISOString().slice(0, 10);
}

export function planMetrics(db: Database, plan: ProductionPlan): PlanMetrics {
  const items = plan.items.map((item) => planItemMetrics(db, item));
  const unitCount = items.reduce((sum, row) => sum + Math.max(0, row.item.qty || 0), 0);
  const totalCost = items.reduce((sum, row) => sum + row.totalCost, 0);
  const totalRevenue = items.reduce((sum, row) => sum + row.revenue, 0);
  const totalProfit = totalRevenue - totalCost;
  const requiredHours = items.reduce((sum, row) => sum + row.hours, 0);
  const setupHours = Math.max(0, plan.setupHours || 0);
  const shiftHours = Math.max(0.5, plan.shiftHours || 8);
  const shiftsPerDay = Math.max(1, plan.shiftsPerDay || 1);
  const machines = Math.max(1, plan.machinesAvailable || 1);
  const downtime = Math.min(90, Math.max(0, plan.plannedDowntimePct || 0));
  const effectiveDailyHours = shiftHours * shiftsPerDay * machines * (1 - downtime / 100);
  const totalHours = requiredHours + setupHours;
  const days = effectiveDailyHours > 0 ? Math.ceil(totalHours / effectiveDailyHours) : 0;
  const utilization =
    days > 0 && effectiveDailyHours > 0 ? (totalHours / (days * effectiveDailyHours)) * 100 : 0;
  const bottleneck = [...items].sort((a, b) => b.hours - a.hours)[0];

  const warnings: string[] = [];
  if (!items.length) warnings.push('الخطة لا تحتوي على بنود إنتاج بعد.');
  const missingRows = items.filter((row) => row.missing.length);
  if (missingRows.length) {
    warnings.push(
      `${missingRows.length} بندًا ببيانات ناقصة — التقدير غير نهائي حتى استكمال البيانات.`,
    );
  }
  if (!plan.startDate) warnings.push('تاريخ بدء الإنتاج غير محدد.');
  if (!plan.owner.trim()) warnings.push('المسؤول عن الخطة غير محدد.');
  if (!plan.line.trim()) warnings.push('خط الإنتاج غير محدد.');
  if (utilization > 100) warnings.push('الطاقة المتاحة أقل من المطلوب — يوجد اختناق.');
  if (plan.targetDays > 0 && days > plan.targetDays) {
    warnings.push(
      `المدة المتوقعة ${days} يومًا تتجاوز المدة المستهدفة ${plan.targetDays} يومًا.`,
    );
  }

  return {
    items,
    unitCount,
    distinctProducts: new Set(items.map((row) => row.item.productCode)).size,
    totalCost,
    totalRevenue,
    totalProfit,
    marginPct: totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0,
    packagingCost: items.reduce((sum, row) => sum + row.packagingCost, 0),
    operatingCost: items.reduce((sum, row) => sum + row.operatingCost, 0),
    requiredHours,
    setupHours,
    effectiveDailyHours,
    days,
    endDate: addWorkingDays(plan.startDate, days),
    utilization,
    avgUnitCost: unitCount > 0 ? totalCost / unitCount : 0,
    bottleneck,
    warnings,
  };
}

export function itemSpec(db: Database, item: ProductionPlanItem) {
  const product = db.products.find((row) => row.code === item.productCode);
  if (!product) return undefined;
  const variant = resolveVariant(product, item.variantId);
  return { product, variant, spec: effectiveSpec(product, variant) };
}

export const PLAN_STATUS_META: Record<
  PlanStatus,
  { label: string; tone: 'slate' | 'blue' | 'green' | 'amber' | 'rose' | 'brand'; order: number }
> = {
  draft: { label: 'مسودة', tone: 'slate', order: 0 },
  review: { label: 'قيد المراجعة', tone: 'amber', order: 1 },
  approved: { label: 'معتمدة', tone: 'green', order: 2 },
  ready: { label: 'جاهزة للتشغيل', tone: 'blue', order: 3 },
  running: { label: 'قيد التنفيذ', tone: 'brand', order: 4 },
  paused: { label: 'متوقفة', tone: 'amber', order: 5 },
  completed: { label: 'مكتملة', tone: 'green', order: 6 },
  cancelled: { label: 'ملغاة', tone: 'rose', order: 7 },
};

export const PLAN_STATUS_FLOW: PlanStatus[] = [
  'draft',
  'review',
  'approved',
  'ready',
  'running',
  'paused',
  'completed',
  'cancelled',
];
