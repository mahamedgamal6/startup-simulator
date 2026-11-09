
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
  /** اختيار الماكينة لكل مرحلة؛ القيمة الفارغة تعني عمل يدوي */
  stageMachines?: Record<string, string>;
  /** زمن وعمالة مخصصان لكل مرحلة داخل بطاقة المنتج */
  stageOverrides?: Record<string, StageOverride>;
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

export type ImageOwnerTable = 'products' | 'machinery' | 'molds' | 'accessories';

export interface FactoryImage {
  ownerTable: ImageOwnerTable;
  ownerId: string;
  dataUrl: string;
  updatedAt: string;
}

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
}

export interface CostElement extends BaseRow {
  productCode: string;
  rawMaterial: number;
  accessories: number;
  plastics: number;
  carton: number;
  labor: number;
  overhead: number;
}

export type InspectionStatus = 'pass' | 'fail' | 'rework';

export interface Inspection extends BaseRow {
  productCode: string;
  checkId: string;
  status: InspectionStatus;
  note: string;
  updatedAt: string;
}

export interface Settings {
  marginPct: number;
  aluminumFactor: number;
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
  costElements: CostElement[];
  inspections: Inspection[];
  settings: Settings;
}

export interface TableMap {
  products: Product;
  rawMaterials: RawMaterial;
  accessories: Accessory;
  molds: Mold;
  machinery: Machinery;
  packaging: PackagingRow;
  costElements: CostElement;
}


export type TableKey = keyof TableMap;

export type DbTables = { [K in TableKey]: TableMap[K][] };

export type ViewKey =
  | 'passport'
  | 'data'
  | 'production'
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
