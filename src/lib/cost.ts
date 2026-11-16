import type {
  CostElement,
  Database,
  PackagingRow,
  PricingMode,
  Product,
  ProductVariant,
  RawMaterial,
  SprayCoating,
} from '../types';

export const COMPONENT_COLORS = {
  raw: '#ec1c24',
  accessories: '#a95e6b',
  spray: '#7c3aed',
  extra: '#0891b2',
  packaging: '#4A90E2',
  labor: '#447a72',
  overhead: '#f0a640',
} as const;

/** نسب تقديرية للمصنعية والمصاريف عند الحساب التلقائي (من إجمالي التكاليف المباشرة). */
export const AUTO_LABOR_RATE = 0.115;
export const AUTO_OVERHEAD_RATE = 0.125;

export interface CostBreakdownItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface Economics {
  rawBase: number;
  rawAdjusted: number;
  sprayCost: number;
  components: CostBreakdownItem[];
  totalBase: number;
  total: number;
  marginPct: number;
  /** الطريقة الفعلية المطبقة على السعر */
  pricingMode: PricingMode;
  /** هامش الربح الفعلي من سعر البيع بعد التطبيق */
  effectiveMarginPct: number;
  price: number;
  priceBase: number;
  profit: number;
  profitBase: number;
}

export function isCartonPackaging(row: PackagingRow): boolean {
  return /كرتون|كرتونة|ماستر|صندوق|box|carton/i.test(
    `${row.name} ${row.code} ${row.type ?? ''}`,
  );
}

export function resolveVariant(
  product: Product | undefined,
  variantId?: string | null,
): ProductVariant | undefined {
  if (!product || !variantId) return undefined;
  return (product.variants ?? []).find((variant) => variant.id === variantId);
}

/** المواصفات الفعلية للتركيبة المختارة، أو مواصفات المنتج الأساسية عند عدم وجود تركيبة. */
export function effectiveSpec(product: Product, variant?: ProductVariant) {
  return {
    sizeCm: variant?.sizeCm ?? product.sizeCm,
    heightCm: variant?.heightCm ?? product.heightCm,
    capacityL: variant?.capacityL ?? product.capacityL,
    netWeightKg: variant?.netWeightKg ?? product.netWeightKg,
    grossWeightKg: variant?.grossWeightKg ?? product.grossWeightKg,
    cbm: variant?.cbm ?? product.cbm,
    pcsPerCarton: variant?.pcsPerCarton ?? product.pcsPerCarton,
    barcode: variant?.barcode || product.barcode,
    sizeLabel: variant?.sizeLabel ?? `${product.sizeCm} سم`,
    colorName: variant?.colorName ?? product.colors?.find((color) => color.active !== false)?.name ?? 'بدون لون',
    colorHex: variant?.colorHex ?? '#c8ccd4',
  };
}

/**
 * الكمية المستهلكة من مادة تعبئة لكل وحدة منتج.
 * الأولوية: كمية التركيبة ← كمية السجل ← حصة الكرتونة (1 / عدد القطع داخلها).
 */
export function packagingUnitQty(
  row: PackagingRow,
  variant?: ProductVariant,
): number {
  const variantQty = variant?.packagingQty?.[row.id];
  if (typeof variantQty === 'number' && Number.isFinite(variantQty)) {
    return Math.max(0, variantQty);
  }
  if (typeof row.qtyPerProduct === 'number' && Number.isFinite(row.qtyPerProduct)) {
    return Math.max(0, row.qtyPerProduct);
  }
  if (isCartonPackaging(row)) {
    const pcs = variant?.pcsPerCarton || row.pcsInside || 1;
    return 1 / Math.max(1, pcs);
  }
  return 1;
}

export function findSpraysForProduct(db: Database, productCode: string): SprayCoating[] {
  return (db.sprayCoatings ?? []).filter((row) => row.productCodes.includes(productCode));
}

export function findRawForProduct(
  db: Database,
  productCode: string,
): RawMaterial | undefined {
  return db.rawMaterials.find((raw) => raw.productCodes.includes(productCode));
}

export function findPackagingForProduct(
  db: Database,
  productCode: string,
): PackagingRow[] {
  return db.packaging.filter((row) => row.productCodes.includes(productCode));
}

export function findAccessoriesForProduct(db: Database, productCode: string) {
  return db.accessories.filter((item) => item.productCodes.includes(productCode));
}

/** يحسب عناصر التكلفة تلقائيًا لكل منتج/تركيبة من بياناتها المرتبطة (بدون تخزين يدوي). */
export function computeCostForProduct(
  db: Database,
  productCode: string,
  variantId?: string | null,
): CostElement {
  const product = db.products.find((item) => item.code === productCode);
  const variant = resolveVariant(product, variantId);
  const raw = findRawForProduct(db, productCode);
  const rawWeight = variant?.rawDiscWeightKg ?? raw?.discWeightKg ?? 0;
  const rawMaterial = raw ? rawWeight * raw.pricePerKg : 0;
  const accessories = findAccessoriesForProduct(db, productCode).reduce(
    (sum, item) => sum + item.qtyPerProduct * item.unitCost,
    0,
  );
  const packaging = findPackagingForProduct(db, productCode);
  const carton = packaging
    .filter(isCartonPackaging)
    .reduce((sum, row) => sum + packagingUnitQty(row, variant) * row.unitCost, 0);
  const wrapPlastics = packaging
    .filter((row) => !isCartonPackaging(row))
    .reduce((sum, row) => sum + packagingUnitQty(row, variant) * row.unitCost, 0);
  const sprayCost = findSpraysForProduct(db, productCode).reduce(
    (sum, row) => sum + row.costPerProduct,
    0,
  );
  const extra = Math.max(0, variant?.extraCost ?? 0);
  const plastics = wrapPlastics + sprayCost;
  const direct = rawMaterial + accessories + plastics + carton + extra;
  const labor = direct * AUTO_LABOR_RATE;
  const overhead = direct * AUTO_OVERHEAD_RATE;

  return {
    id: `auto-${productCode}${variantId ? `-${variantId}` : ''}`,
    productCode,
    rawMaterial,
    accessories,
    plastics,
    carton,
    labor,
    overhead,
    extra,
  };
}

export function findCostForProduct(
  db: Database,
  productCode: string,
  variantId?: string | null,
): CostElement {
  return computeCostForProduct(db, productCode, variantId);
}

export function totalOf(cost: CostElement | undefined): number {
  if (!cost) return 0;
  return (
    cost.rawMaterial +
    cost.accessories +
    cost.plastics +
    cost.carton +
    cost.labor +
    cost.overhead +
    (cost.extra ?? 0)
  );
}

export interface PricingResult {
  price: number;
  pricingMode: PricingMode;
  pct: number;
  effectiveMarginPct: number;
}

/**
 * سياسة التسعير:
 * - حتى 99.99% وبوضع "هامش": السعر = التكلفة ÷ (1 - النسبة).
 * - عند 100% أو أكثر (أو وضع "زيادة"): السعر = التكلفة × (1 + النسبة)، لأن هامش
 *   100% من سعر البيع غير قابل للتمثيل (قسمة على صفر وما بعدها سالبة).
 * النطاق المقبول 0% إلى 200% في الحالتين.
 */
export function pricingOf(
  total: number,
  pct: number,
  mode: PricingMode = 'margin',
): PricingResult {
  const safePct = Math.min(Math.max(Number.isFinite(pct) ? pct : 0, 0), 200);
  const appliedMode: PricingMode = mode === 'markup' || safePct >= 100 ? 'markup' : 'margin';
  const price =
    appliedMode === 'markup'
      ? total * (1 + safePct / 100)
      : total / (1 - safePct / 100);
  return {
    price,
    pricingMode: appliedMode,
    pct: safePct,
    effectiveMarginPct: price > 0 ? ((price - total) / price) * 100 : 0,
  };
}

export function economicsOf(
  dbOrCost: Database | CostElement | undefined,
  productCodeOrFactor: string | number,
  aluminumFactorOrMargin: number,
  maybeMargin?: number,
  variantId?: string | null,
  maybeMode?: PricingMode,
): Economics {
  let cost: CostElement | undefined;
  let aluminumFactor: number;
  let marginPct: number;
  let pricingMode: PricingMode = maybeMode ?? 'margin';
  let sprayCost = 0;

  if (
    typeof productCodeOrFactor === 'string' &&
    dbOrCost &&
    typeof (dbOrCost as Database).products !== 'undefined'
  ) {
    const db = dbOrCost as Database;
    cost = computeCostForProduct(db, productCodeOrFactor, variantId);
    sprayCost = findSpraysForProduct(db, productCodeOrFactor).reduce(
      (sum, row) => sum + row.costPerProduct,
      0,
    );
    pricingMode = maybeMode ?? db.settings.pricingMode ?? 'margin';
    aluminumFactor = aluminumFactorOrMargin;
    marginPct = maybeMargin ?? 0;
  } else {
    cost = dbOrCost as CostElement | undefined;
    aluminumFactor = productCodeOrFactor as number;
    marginPct = aluminumFactorOrMargin;
    sprayCost = 0;
  }

  const rawBase = cost?.rawMaterial ?? 0;
  const rawAdjusted = rawBase * aluminumFactor;
  const accessories = cost?.accessories ?? 0;
  const packagingCost = (cost?.plastics ?? 0) + (cost?.carton ?? 0);
  const extra = cost?.extra ?? 0;
  const labor = cost?.labor ?? 0;
  const overhead = cost?.overhead ?? 0;

  const components: CostBreakdownItem[] = [
    { key: 'raw', label: 'الخام المباشر', value: rawAdjusted, color: COMPONENT_COLORS.raw },
    {
      key: 'accessories',
      label: 'الإكسسوارات',
      value: accessories,
      color: COMPONENT_COLORS.accessories,
    },
    ...(sprayCost > 0
      ? [
          {
            key: 'spray',
            label: 'الرش والطلاء',
            value: sprayCost,
            color: COMPONENT_COLORS.spray,
          },
        ]
      : []),
    ...(extra > 0
      ? [
          {
            key: 'extra',
            label: 'فرق اللون/الخامة',
            value: extra,
            color: COMPONENT_COLORS.extra,
          },
        ]
      : []),
    {
      key: 'packaging',
      label: 'التعبئة والتغليف',
      value: Math.max(packagingCost - sprayCost, 0),
      color: COMPONENT_COLORS.packaging,
    },
    { key: 'labor', label: 'مصنعية وعمالة', value: labor, color: COMPONENT_COLORS.labor },
    {
      key: 'overhead',
      label: 'مصاريف غير مباشرة',
      value: overhead,
      color: COMPONENT_COLORS.overhead,
    },
  ].filter((item) => item.value > 0 || item.key === 'raw' || item.key === 'packaging');

  const total = components.reduce((sum, item) => sum + item.value, 0);
  const totalBase = rawBase + accessories + packagingCost + extra + labor + overhead;
  const pricing = pricingOf(total, marginPct, pricingMode);

  return {
    rawBase,
    rawAdjusted,
    sprayCost,
    components,
    totalBase,
    total,
    marginPct: pricing.pct,
    pricingMode: pricing.pricingMode,
    effectiveMarginPct: pricing.effectiveMarginPct,
    price: pricing.price,
    priceBase:
      pricing.pricingMode === 'markup'
        ? totalBase * (1 + pricing.pct / 100)
        : totalBase / (1 - pricing.pct / 100),
    profit: pricing.price - total,
    profitBase:
      (pricing.pricingMode === 'markup'
        ? totalBase * (1 + pricing.pct / 100)
        : totalBase / (1 - pricing.pct / 100)) - totalBase,
  };
}

export function discCostOf(raw: RawMaterial | undefined, aluminumFactor: number): number {
  if (!raw) return 0;
  return raw.discWeightKg * raw.pricePerKg * aluminumFactor;
}

/** القدرة الإنتاجية بالساعة لزمن دورة معين. */
export function unitsPerHour(cycleSeconds: number): number {
  return cycleSeconds > 0 ? 3600 / cycleSeconds : 0;
}

export interface ContainerLoad {
  standard: string;
  volumeCbm: number;
  maxTons: number;
  cartons: number;
  pieces: number;
  weightTons: number;
  volumeUsed: number;
  value: number;
}

export function containerLoads(
  product: Product,
  unitPrice: number,
  spec?: { cbm: number; grossWeightKg: number; pcsPerCarton: number },
): ContainerLoad[] {
  const specs = [
    { standard: 'حاوية 20 قدم', volumeCbm: 28, maxTons: 21 },
    { standard: 'حاوية 40 قدم', volumeCbm: 58, maxTons: 26 },
  ];

  const cbm = spec?.cbm ?? product.cbm;
  const gross = spec?.grossWeightKg ?? product.grossWeightKg;
  const pcsPerCarton = spec?.pcsPerCarton ?? product.pcsPerCarton;
  const weightPerCarton = gross * pcsPerCarton;

  return specs.map((item) => {
    const byVolume = cbm > 0 ? Math.floor(item.volumeCbm / cbm) : 0;
    const byWeight =
      weightPerCarton > 0 ? Math.floor((item.maxTons * 1000) / weightPerCarton) : 0;
    const cartons = Math.max(0, Math.min(byVolume, byWeight));
    const pieces = cartons * pcsPerCarton;
    return {
      standard: item.standard,
      volumeCbm: item.volumeCbm,
      maxTons: item.maxTons,
      cartons,
      pieces,
      weightTons: (cartons * weightPerCarton) / 1000,
      volumeUsed: cartons * cbm,
      value: pieces * unitPrice,
    };
  });
}

export function productMargin(
  db: Database,
  product: Product,
  marginPct: number,
  aluminumFactor: number,
  variantId?: string,
) {
  return economicsOf(db, product.code, aluminumFactor, marginPct, variantId);
}
