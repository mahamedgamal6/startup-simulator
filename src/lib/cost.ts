import type {
  CostElement,
  Database,
  PackagingRow,
  Product,
  RawMaterial,
  SprayCoating,
} from '../types';

export const COMPONENT_COLORS = {
  raw: '#ec1c24',
  accessories: '#a95e6b',
  spray: '#7c3aed',
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
  price: number;
  priceBase: number;
  profit: number;
  profitBase: number;
}

function isCartonPackaging(row: PackagingRow): boolean {
  return /كرتون|كرتونة|ماستر|صندوق|box|carton/i.test(`${row.name} ${row.code}`);
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

/** يحسب عناصر التكلفة تلقائيًا لكل منتج من بياناته المرتبطة (بدون تخزين يدوي). */
export function computeCostForProduct(db: Database, productCode: string): CostElement {
  const raw = findRawForProduct(db, productCode);
  const rawMaterial = raw ? raw.discWeightKg * raw.pricePerKg : 0;
  const accessories = findAccessoriesForProduct(db, productCode).reduce(
    (sum, item) => sum + item.qtyPerProduct * item.unitCost,
    0,
  );
  const packaging = findPackagingForProduct(db, productCode);
  const carton = packaging.filter(isCartonPackaging).reduce((sum, row) => sum + row.unitCost, 0);
  const wrapPlastics = packaging
    .filter((row) => !isCartonPackaging(row))
    .reduce((sum, row) => sum + row.unitCost, 0);
  const sprayCost = findSpraysForProduct(db, productCode).reduce(
    (sum, row) => sum + row.costPerProduct,
    0,
  );
  const plastics = wrapPlastics + sprayCost;
  const direct = rawMaterial + accessories + plastics + carton;
  const labor = direct * AUTO_LABOR_RATE;
  const overhead = direct * AUTO_OVERHEAD_RATE;

  return {
    id: `auto-${productCode}`,
    productCode,
    rawMaterial,
    accessories,
    plastics,
    carton,
    labor,
    overhead,
  };
}

export function findCostForProduct(db: Database, productCode: string): CostElement {
  return computeCostForProduct(db, productCode);
}

export function totalOf(cost: CostElement | undefined): number {
  if (!cost) return 0;
  return (
    cost.rawMaterial +
    cost.accessories +
    cost.plastics +
    cost.carton +
    cost.labor +
    cost.overhead
  );
}

export function economicsOf(
  dbOrCost: Database | CostElement | undefined,
  productCodeOrFactor: string | number,
  aluminumFactorOrMargin: number,
  maybeMargin?: number,
): Economics {
  let cost: CostElement | undefined;
  let aluminumFactor: number;
  let marginPct: number;
  let sprayCost = 0;

  if (
    typeof productCodeOrFactor === 'string' &&
    dbOrCost &&
    typeof (dbOrCost as Database).products !== 'undefined'
  ) {
    const db = dbOrCost as Database;
    cost = computeCostForProduct(db, productCodeOrFactor);
    sprayCost = findSpraysForProduct(db, productCodeOrFactor).reduce(
      (sum, row) => sum + row.costPerProduct,
      0,
    );
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
    {
      key: 'packaging',
      label: sprayCost > 0 ? 'تغليف ومواد مساعدة' : 'تغليف وبلاستيك',
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
  ];

  const total = components.reduce((sum, item) => sum + item.value, 0);
  const totalBase = rawBase + accessories + packagingCost + labor + overhead;
  const safeMargin = Math.min(Math.max(marginPct, 0), 90);
  const price = total / (1 - safeMargin / 100);
  const priceBase = totalBase / (1 - safeMargin / 100);

  return {
    rawBase,
    rawAdjusted,
    sprayCost,
    components,
    totalBase,
    total,
    marginPct: safeMargin,
    price,
    priceBase,
    profit: price - total,
    profitBase: priceBase - totalBase,
  };
}

export function discCostOf(raw: RawMaterial | undefined, aluminumFactor: number): number {
  if (!raw) return 0;
  return raw.discWeightKg * raw.pricePerKg * aluminumFactor;
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

export function containerLoads(product: Product, unitPrice: number): ContainerLoad[] {
  const specs = [
    { standard: 'حاوية 20 قدم', volumeCbm: 28, maxTons: 21 },
    { standard: 'حاوية 40 قدم', volumeCbm: 58, maxTons: 26 },
  ];

  const weightPerCarton = product.grossWeightKg * product.pcsPerCarton;

  return specs.map((spec) => {
    const byVolume = product.cbm > 0 ? Math.floor(spec.volumeCbm / product.cbm) : 0;
    const byWeight =
      weightPerCarton > 0 ? Math.floor((spec.maxTons * 1000) / weightPerCarton) : 0;
    const cartons = Math.max(0, Math.min(byVolume, byWeight));
    const pieces = cartons * product.pcsPerCarton;
    return {
      standard: spec.standard,
      volumeCbm: spec.volumeCbm,
      maxTons: spec.maxTons,
      cartons,
      pieces,
      weightTons: (cartons * weightPerCarton) / 1000,
      volumeUsed: cartons * product.cbm,
      value: pieces * unitPrice,
    };
  });
}

export function productMargin(
  db: Database,
  product: Product,
  marginPct: number,
  aluminumFactor: number,
) {
  return economicsOf(db, product.code, aluminumFactor, marginPct);
}
