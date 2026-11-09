import type {
  CostElement,
  Database,
  PackagingRow,
  Product,
  RawMaterial,
} from '../types';

export const COMPONENT_COLORS = {
  raw: '#ec1c24',
  accessories: '#a95e6b',
  packaging: '#4A90E2',
  labor: '#447a72',
  overhead: '#f0a640',
} as const;

export interface CostBreakdownItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

export interface Economics {
  rawBase: number;
  rawAdjusted: number;
  components: CostBreakdownItem[];
  totalBase: number;
  total: number;
  marginPct: number;
  price: number;
  priceBase: number;
  profit: number;
  profitBase: number;
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
  cost: CostElement | undefined,
  aluminumFactor: number,
  marginPct: number,
): Economics {
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
    {
      key: 'packaging',
      label: 'تغليف وبلاستيك',
      value: packagingCost,
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

export function discCostOf(
  raw: RawMaterial | undefined,
  aluminumFactor: number,
): number {
  if (!raw) return 0;
  return raw.discWeightKg * raw.pricePerKg * aluminumFactor;
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

export function findCostForProduct(
  db: Database,
  productCode: string,
): CostElement | undefined {
  return db.costElements.find((row) => row.productCode === productCode);
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
  return economicsOf(findCostForProduct(db, product.code), aluminumFactor, marginPct);
}
