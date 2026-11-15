
export interface BaseRow {
  id: string;
}

export type ProductFamily =
  | 'باور'
  | 'باور بلس'
  | 'برايم استانلس'
  | 'كراون تيتانيوم'
  | 'إيلورا جرانيت'
  | 'صينية فرن';

export interface StageOverride {
  seconds: number;
  workers: number;
}

export interface ProductSize {
  id: string;
  label: string;
  sizeCm: number;
  heightCm: number;
  capacityL: number;
  barcode: string;
  active: boolean;
}

export interface ProductColor {
  id: string;
  name: string;
  hex: string;
  /** صورة توضيحية للون (Data URL) عند الحاجة */
  imageUrl?: string;
  active: boolean;
}

/** تركيبة منتج = مقاس + لون، لكل تركيبة مواصفاتها وتكلفتها وزمنها المستقل. */
export interface ProductVariant {
  id: string;
  productId: string;
  sizeId: string;
  colorId: string;
  sizeLabel: string;
  colorName: string;
  colorHex: string;
  sizeCm: number;
  heightCm: number;
  capacityL: number;
  netWeightKg: number;
  grossWeightKg: number;
  cbm: number;
  pcsPerCarton: number;
  barcode: string;
  /** وزن قرص الخام الفعلي لهذه التركيبة (يتجاوز قرص المنتج الأساسي) */
  rawDiscWeightKg?: number;
  /** فرق تكلفة الخامة/اللون عن التركيبة الأساسية */
  extraCost: number;
  /** زمن التشغيل الفعلي للقطعة بالثواني (يتجاوز زمن رحلة التصنيع) */
  cycleSeconds?: number;
  /** كميات مواد التعبئة المخصصة لهذه التركيبة: معرّف مادة التعبئة ← الكمية */
  packagingQty?: Record<string, number>;
  active: boolean;
}

export interface Product extends BaseRow {
  code: string;
  name: string;
  family: ProductFamily;
  sizeCm: number;
  heightCm: number;
  capacityL: number;
  netWeightKg: number;
  grossWeightKg: number;
  cbm: number;
  pcsPerCarton: number;
  barcode: string;
  /** بيانات التصدير الاختيارية — تظهر في بطاقة الطباعة عند تسجيلها */
  hsCode?: string;
  originCountry?: string;
  exportDestination?: string;
  /** اختيار الماكينة لكل مرحلة؛ القيمة الفارغة تعني عمل يدوي */
  stageMachines?: Record<string, string>;
  /** زمن وعمالة مخصصان لكل مرحلة داخل بطاقة المنتج */
  stageOverrides?: Record<string, StageOverride>;
  /** مقاسات المنتج وألوانه وتركيباته */
  sizes?: ProductSize[];
  colors?: ProductColor[];
  variants?: ProductVariant[];
  /** أرشفة منطقية للمنتج (لا يُحذف نهائيًا إذا ارتبط بخطط إنتاج) */
  archived?: boolean;
}

export interface RawMaterial extends BaseRow {
  code: string;
  name: string;
  alloy: string;
  diameterCm: number;
  thicknessMm: number;
  discWeightKg: number;
  wastePct: number;
  pricePerKg: number;
  productCodes: string[];
}

export interface Accessory extends BaseRow {
  code: string;
  name: string;
  material: string;
  qtyPerProduct: number;
  unitCost: number;
  origin: string;
  productCodes: string[];
}

export interface Mold extends BaseRow {
  code: string;
  name: string;
  sizeCm: number;
  drawType: string;
  condition: string;
  maintenanceNotes: string;
}

export interface Machinery extends BaseRow {
  code: string;
  name: string;
  capacity: string;
  country: string;
  department: string;
  faultRate: number;
  status: string;
  serviceIntervalHours: number;
  hoursSinceService: number;
}

export interface SparePart extends BaseRow {
  machineId: string;
  code: string;
  name: string;
  unitCost: number;
  stockQty: number;
  replacementIntervalHours: number;
  notes: string;
}

export type ImageOwnerTable =
  | 'products'
  | 'machinery'
  | 'molds'
  | 'accessories'
  | 'packaging'
  | 'rawMaterials';

export interface FactoryImage {
  ownerTable: ImageOwnerTable;
  ownerId: string;
  dataUrl: string;
  updatedAt: string;
}

export type PackagingStage = 'inner' | 'outer' | 'shipping';

export interface PackagingRow extends BaseRow {
  code: string;
  name: string;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  emptyWeightKg: number;
  unitCost: number;
  pcsInside: number;
  productCodes: string[];
  /** تصنيف المادة: كرتون، كيس، استيكر، فواصل، شرائط، حماية... */
  type: string;
  material: string;
  description: string;
  unit: string;
  supplier: string;
  minStock: number;
  /** مرحلة الاستخدام: تعبئة داخلية / خارجية / شحن */
  stage: PackagingStage;
  /** الكمية المستهلكة لكل وحدة منتج؛ إن لم تُحدد تُحسب من سعة الكرتونة */
  qtyPerProduct?: number;
}

export interface CostElement extends BaseRow {
  productCode: string;
  rawMaterial: number;
  accessories: number;
  plastics: number;
  carton: number;
  labor: number;
  overhead: number;
  /** فرق تكلفة اللون/الخامة للتركيبة المختارة */
  extra?: number;
}

export interface SprayCoating extends BaseRow {
  code: string;
  name: string;
  type: string;
  color: string;
  costPerProduct: number;
  supplier: string;
  notes: string;
  /** المنتجات التي يُطبَّق عليها هذا الرش/الطلاء؛ فارغة تعني غير مستخدم حالياً */
  productCodes: string[];
}

export type InspectionStatus = 'pass' | 'fail' | 'rework';

export interface Inspection extends BaseRow {
  productCode: string;
  checkId: string;
  status: InspectionStatus;
  note: string;
  updatedAt: string;
}

export type PricingMode = 'margin' | 'markup';

export interface Settings {
  /** هامش الربح أو نسبة الزيادة على التكلفة: من 0% إلى 200% */
  marginPct: number;
  aluminumFactor: number;
  /** طريقة التسعير المعتمدة */
  pricingMode: PricingMode;
}

export type PlanStatus =
  | 'draft'
  | 'review'
  | 'approved'
  | 'ready'
  | 'running'
  | 'paused'
  | 'completed'
  | 'cancelled';

export interface PlanItemSnapshot {
  unitCost: number;
  price: number;
  cycleSeconds: number;
  rawCode: string;
  packagingCodes: string[];
  at: string;
}

export interface ProductionPlanItem {
  id: string;
  productId: string;
  productCode: string;
  productName: string;
  variantId?: string;
  sizeLabel: string;
  colorName: string;
  qty: number;
  notes: string;
  snapshot?: PlanItemSnapshot;
  /** تنفيذ فعلي للمقارنة مع المخطط */
  actual?: {
    producedQty: number;
    actualHours: number;
    actualCost: number;
    wastePct: number;
    deviationReason: string;
    updatedAt: string;
  };
}

export interface PlanSnapshot {
  at: string;
  approvedBy: string;
  unitCount: number;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  totalHours: number;
  avgUnitCost: number;
}

export interface ProductionPlan {
  id: string;
  code: string;
  name: string;
  createdAt: string;
  startDate: string;
  factory: string;
  line: string;
  shift: string;
  owner: string;
  targetDays: number;
  notes: string;
  status: PlanStatus;
  shiftHours: number;
  shiftsPerDay: number;
  machinesAvailable: number;
  plannedDowntimePct: number;
  setupHours: number;
  items: ProductionPlanItem[];
  snapshot?: PlanSnapshot;
  approvedAt?: string;
  approvedBy?: string;
}

export interface Database {
  products: Product[];
  rawMaterials: RawMaterial[];
  accessories: Accessory[];
  molds: Mold[];
  machinery: Machinery[];
  spareParts: SparePart[];
  images: FactoryImage[];
  packaging: PackagingRow[];
  /** محسوبة تلقائيًا لكل منتج (للتوافق فقط — لا تُخزَّن ولا تُعدَّل) */
  costElements: CostElement[];
  sprayCoatings: SprayCoating[];
  inspections: Inspection[];
  wastePct?: number;
  /** خطط الإنتاج والتشغيل (محفوظة محليًا وتتزامن عند توفر الجدول على الخادم) */
  productionPlans: ProductionPlan[];
  settings: Settings;
}

export interface TableMap {
  products: Product;
  rawMaterials: RawMaterial;
  accessories: Accessory;
  molds: Mold;
  machinery: Machinery;
  packaging: PackagingRow;
  sprayCoatings: SprayCoating;
}


export type TableKey = keyof TableMap;

export type DbTables = { [K in TableKey]: TableMap[K][] };

export type ViewKey =
  | 'passport'
  | 'data'
  | 'production'
  | 'planning'
  | 'finance'
  | 'executive'
  | 'quality'
  | 'users'
  | 'roles'
  | 'audit';

export interface AppUser {
  id: string;
  name: string;
  username: string;
  roleId: string;
  active: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export interface AppRole {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  system?: boolean;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  at: string;
  userId: string;
  userName: string;
  action: string;
  detail: string;
}

export type MoldSlot = 'press' | 'second' | 'trim' | null;

export interface StageDef {
  key: string;
  name: string;
  group: 'forming' | 'finishing' | 'polishing' | 'assembly';
  description: string;
  machineCode: string;
  moldSlot: MoldSlot;
  baseSeconds: number;
  workers: number;
}

export interface ResolvedStage extends StageDef {
  seconds: number;
  cumulative: number;
  machineName: string;
  moldCode: string | null;
}

export interface QualityCheck {
  id: string;
  label: string;
  criteria: string;
  appliesTo?: string;
}
