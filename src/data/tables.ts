import {
  Boxes,
  Coins,
  Cog,
  Layers,
  Package,
  PackageCheck,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { Database, ProductFamily, TableKey } from '../types';

export type FieldType = 'text' | 'number' | 'select' | 'codes';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  cost?: boolean;
  step?: number;
  suffix?: string;
  options?: string[];
  placeholder?: string;
  wide?: boolean;
}

export interface TableDef {
  key: TableKey;
  label: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  prefix: string;
  primaryKey: string;
  fields: FieldDef[];
  defaults: Record<string, string | number | string[]>;
}

const FAMILIES: ProductFamily[] = [
  'باور',
  'باور بلس',
  'برايم استانلس',
  'كراون تيتانيوم',
  'إيلورا جرانيت',
  'صينية فرن',
];

const DEPARTMENTS = [
  'قسم المكابس والتشكيل',
  'قسم التحرير والقص',
  'قسم الخراطة والتشغيل',
  'قسم الغسيل والتشطيب',
  'قسم التلميع والتشطيب',
  'قسم البرشمة والتجميع',
  'قسم التجميع والتعبئة',
];

export function buildTables(db: Database): TableDef[] {
  const productCodes = db.products.map((product) => product.code);

  return [
    {
      key: 'products',
      label: 'المنتجات',
      title: 'المنتجات الأساسية',
      subtitle: 'بطاقة كل منتج: الأبعاد، الأوزان، سعة الكرتونة والباركود الدولي.',
      icon: Package,
      prefix: 'prd',
      primaryKey: 'code',
      defaults: {
        code: '',
        name: '',
        family: 'باور',
        sizeCm: 20,
        heightCm: 8,
        capacityL: 1,
        netWeightKg: 0.4,
        grossWeightKg: 0.6,
        cbm: 0.04,
        pcsPerCarton: 8,
        barcode: '',
      },
      fields: [
        { key: 'code', label: 'كود المنتج', type: 'text', required: true, placeholder: '01020020' },
        { key: 'name', label: 'اسم المنتج', type: 'text', required: true, wide: true },
        { key: 'family', label: 'عائلة المنتج', type: 'select', options: FAMILIES },
        { key: 'sizeCm', label: 'المقاس (سم)', type: 'number', step: 0.5, required: true },
        { key: 'heightCm', label: 'الارتفاع (سم)', type: 'number', step: 0.1 },
        { key: 'capacityL', label: 'السعة (لتر)', type: 'number', step: 0.1 },
        { key: 'netWeightKg', label: 'الوزن الصافي (كجم)', type: 'number', step: 0.001 },
        { key: 'grossWeightKg', label: 'الوزن بعد التعبئة (كجم)', type: 'number', step: 0.001 },
        { key: 'cbm', label: 'حجم الكرتونة CBM', type: 'number', step: 0.001 },
        { key: 'pcsPerCarton', label: 'عدد القطع بالكرتونة', type: 'number', step: 1 },
        { key: 'barcode', label: 'الباركود الدولي', type: 'text' },
      ],
    },
    {
      key: 'rawMaterials',
      label: 'الخامات',
      title: 'مواصفات الأقراص والخامات المباشرة',
      subtitle: 'الأقراص، السبائك، نسب الهالك وسعر الكيلو المعتمد.',
      icon: Layers,
      prefix: 'raw',
      primaryKey: 'code',
      defaults: {
        code: '',
        name: '',
        alloy: 'سبيكة 1050 نقية',
        diameterCm: 34,
        thicknessMm: 2.5,
        discWeightKg: 0.7,
        wastePct: 12,
        pricePerKg: 195,
        productCodes: [],
      },
      fields: [
        { key: 'code', label: 'كود الخامة', type: 'text', required: true, placeholder: 'RAW-1050-34' },
        { key: 'name', label: 'اسم قرص الخام', type: 'text', required: true, wide: true },
        { key: 'alloy', label: 'سبيكة الألومنيوم', type: 'text' },
        { key: 'diameterCm', label: 'قطر القرص (سم)', type: 'number', step: 0.5 },
        { key: 'thicknessMm', label: 'سُمك الخام (مم)', type: 'number', step: 0.1 },
        { key: 'discWeightKg', label: 'الوزن النظري للقرص (كجم)', type: 'number', step: 0.001 },
        { key: 'wastePct', label: 'نسبة هالك التشكيل والخراطة %', type: 'number', step: 0.1 },
        { key: 'pricePerKg', label: 'سعر الكيلو بالجنيه', type: 'number', step: 0.5, cost: true },
        {
          key: 'productCodes',
          label: 'المنتجات المرتبطة',
          type: 'codes',
          wide: true,
          options: productCodes,
        },
      ],
    },
    {
      key: 'accessories',
      label: 'الإكسسوارات',
      title: 'الإكسسوارات والمقابض',
      subtitle: 'المقابض والمسامير والأغطية وتكلفة الوحدة والمورد.',
      icon: Wrench,
      prefix: 'acc',
      primaryKey: 'code',
      defaults: {
        code: '',
        name: '',
        material: '',
        qtyPerProduct: 1,
        unitCost: 0,
        origin: 'تصنيع محلي',
        productCodes: [],
      },
      fields: [
        { key: 'code', label: 'كود الإكسسوار', type: 'text', required: true, placeholder: 'ACC-01' },
        { key: 'name', label: 'اسم الصنف', type: 'text', required: true, wide: true },
        { key: 'material', label: 'مادة الصنع', type: 'text' },
        { key: 'qtyPerProduct', label: 'عدد القطع للمنتج', type: 'number', step: 1 },
        { key: 'unitCost', label: 'تكلفة الوحدة بالجنيه', type: 'number', step: 0.01, cost: true },
        { key: 'origin', label: 'المورد / بلد المنشأ', type: 'text' },
        {
          key: 'productCodes',
          label: 'المنتجات المرتبطة',
          type: 'codes',
          wide: true,
          options: productCodes,
        },
      ],
    },
    {
      key: 'molds',
      label: 'الإسطمبات',
      title: 'الإسطمبات وقوالب التشكيل',
      subtitle: 'حالة الإسطمبة، نوع السحب وملاحظات الصيانة.',
      icon: Boxes,
      prefix: 'mold',
      primaryKey: 'code',
      defaults: {
        code: '',
        name: '',
        sizeCm: 20,
        drawType: 'سحب عميق هيدروليكي',
        condition: 'حالة جيدة',
        maintenanceNotes: 'لا توجد',
      },
      fields: [
        { key: 'code', label: 'كود الإسطمبة', type: 'text', required: true, placeholder: 'MOLD-08' },
        { key: 'name', label: 'اسم الإسطمبة', type: 'text', required: true, wide: true },
        { key: 'sizeCm', label: 'المقاس المتوافق (سم)', type: 'number', step: 0.5 },
        {
          key: 'drawType',
          label: 'نوع السحب',
          type: 'select',
          options: ['سحب عميق هيدروليكي', 'سحب أول', 'سحب ثانٍ', 'تحرير', 'تشكيل وقص'],
        },
        {
          key: 'condition',
          label: 'الحالة الفنية',
          type: 'select',
          options: ['حالة ممتازة', 'حالة جيدة', 'تحتاج صيانة'],
        },
        { key: 'maintenanceNotes', label: 'ملاحظات الصيانة', type: 'text', wide: true },
      ],
    },
    {
      key: 'machinery',
      label: 'الماكينات',
      title: 'خطوط الإنتاج والماكينات',
      subtitle: 'الأقسام، معدلات الأعطال وساعات التشغيل منذ آخر صيانة.',
      icon: Cog,
      prefix: 'mc',
      primaryKey: 'code',
      defaults: {
        code: '',
        name: '',
        capacity: '',
        country: 'إيطاليا',
        department: 'قسم المكابس والتشكيل',
        faultRate: 1.5,
        status: 'يعمل بكفاءة',
        serviceIntervalHours: 4000,
        hoursSinceService: 0,
      },
      fields: [
        { key: 'code', label: 'كود الماكينة', type: 'text', required: true, placeholder: '16' },
        { key: 'name', label: 'اسم الماكينة والطراز', type: 'text', required: true, wide: true },
        { key: 'capacity', label: 'القوة / الحمولة', type: 'text' },
        { key: 'country', label: 'بلد الصنع', type: 'text' },
        { key: 'department', label: 'القسم', type: 'select', options: DEPARTMENTS },
        { key: 'faultRate', label: 'معدل الأعطال السنوي %', type: 'number', step: 0.1 },
        {
          key: 'status',
          label: 'حالة التشغيل',
          type: 'select',
          options: ['يعمل بكفاءة', 'تحتاج صيانة قريبة', 'متوقفة للصيانة'],
        },
        { key: 'serviceIntervalHours', label: 'فترة الصيانة (ساعة)', type: 'number', step: 100 },
        { key: 'hoursSinceService', label: 'ساعات التشغيل منذ الصيانة', type: 'number', step: 10 },
      ],
    },
    {
      key: 'packaging',
      label: 'التعبئة',
      title: 'مواصفات التعبئة والتغليف',
      subtitle: 'الكراتين، الأبعاد، التكلفة وعدد المنتجات الداخلية.',
      icon: PackageCheck,
      prefix: 'pkg',
      primaryKey: 'code',
      defaults: {
        code: '',
        name: '',
        lengthCm: 45,
        widthCm: 45,
        heightCm: 35,
        emptyWeightKg: 0.8,
        unitCost: 0,
        pcsInside: 8,
        productCodes: [],
      },
      fields: [
        { key: 'code', label: 'كود الكرتونة', type: 'text', required: true, placeholder: 'BOX-S20' },
        { key: 'name', label: 'نوع الغلاف', type: 'text', required: true, wide: true },
        { key: 'lengthCm', label: 'الطول (سم)', type: 'number', step: 0.5 },
        { key: 'widthCm', label: 'العرض (سم)', type: 'number', step: 0.5 },
        { key: 'heightCm', label: 'الارتفاع (سم)', type: 'number', step: 0.5 },
        { key: 'emptyWeightKg', label: 'وزن الكرتونة فارغة (كجم)', type: 'number', step: 0.001 },
        { key: 'unitCost', label: 'التكلفة للوحدة بالجنيه', type: 'number', step: 0.01, cost: true },
        { key: 'pcsInside', label: 'عدد المنتجات الداخلية', type: 'number', step: 1 },
        {
          key: 'productCodes',
          label: 'المنتجات المرتبطة',
          type: 'codes',
          wide: true,
          options: productCodes,
        },
      ],
    },
    {
      key: 'costElements',
      label: 'عناصر التكلفة',
      title: 'تكاليف التشغيل والعمالة',
      subtitle: 'تفكيك التكلفة لكل منتج: خام، إكسسوار، تغليف، مصنعية ومصاريف.',
      icon: Coins,
      prefix: 'ce',
      primaryKey: 'productCode',
      defaults: {
        productCode: productCodes[0] ?? '',
        rawMaterial: 0,
        accessories: 0,
        plastics: 0,
        carton: 0,
        labor: 0,
        overhead: 0,
      },
      fields: [
        {
          key: 'productCode',
          label: 'كود المنتج',
          type: 'select',
          options: productCodes,
          required: true,
        },
        { key: 'rawMaterial', label: 'تكلفة الخام المباشر', type: 'number', step: 0.01, cost: true },
        { key: 'accessories', label: 'تكلفة الإكسسوار', type: 'number', step: 0.01, cost: true },
        { key: 'plastics', label: 'خامات بلاستيك ورش', type: 'number', step: 0.01, cost: true },
        { key: 'carton', label: 'كرتون وتغليف', type: 'number', step: 0.01, cost: true },
        {
          key: 'labor',
          label: 'مصنعية وعمالة مباشرة',
          type: 'number',
          step: 0.01,
          cost: true,
        },
        {
          key: 'overhead',
          label: 'مصروفات صناعية غير مباشرة وإدارة',
          type: 'number',
          step: 0.01,
          cost: true,
        },
      ],
    },
  ];
}
