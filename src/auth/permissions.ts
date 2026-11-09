export type PermissionCategory =
  | 'الخدمات'
  | 'مركز البيانات'
  | 'إدارة النظام'
  | 'الإعدادات';

export interface PermissionDef {
  key: string;
  label: string;
}

export interface PermissionGroupDef {
  id: string;
  label: string;
  category: PermissionCategory;
  permissions: PermissionDef[];
}

export const DATA_TABLES = [
  { key: 'products', label: 'المنتجات' },
  { key: 'rawMaterials', label: 'الخامات' },
  { key: 'accessories', label: 'الإكسسوارات' },
  { key: 'molds', label: 'الإسطمبات' },
  { key: 'machinery', label: 'الماكينات' },
  { key: 'packaging', label: 'التعبئة' },
  { key: 'costElements', label: 'عناصر التكلفة' },
] as const;

export type DataTableKey = (typeof DATA_TABLES)[number]['key'];

export const DATA_ACTIONS = [
  { key: 'view', label: 'عرض الجدول' },
  { key: 'create', label: 'إضافة سجل' },
  { key: 'edit', label: 'تعديل سجل' },
  { key: 'delete', label: 'حذف سجل' },
  { key: 'import', label: 'استيراد Excel / CSV' },
  { key: 'export', label: 'تصدير البيانات والنموذج' },
] as const;

export type DataAction = (typeof DATA_ACTIONS)[number]['key'];

const dataGroups: PermissionGroupDef[] = DATA_TABLES.map((table) => ({
  id: `data.${table.key}`,
  label: table.label,
  category: 'مركز البيانات',
  permissions: DATA_ACTIONS.map((action) => ({
    key: `data.${table.key}.${action.key}`,
    label: action.label,
  })),
}));

export const PERMISSION_GROUPS: PermissionGroupDef[] = [
  {
    id: 'passport',
    label: 'بطاقة المنتج الرقمية',
    category: 'الخدمات',
    permissions: [
      { key: 'passport.view', label: 'الدخول إلى البطاقة' },
      { key: 'passport.cost_view', label: 'عرض التكاليف والأسعار' },
      { key: 'passport.print_technical', label: 'طباعة البطاقة الفنية' },
      { key: 'passport.print_cost', label: 'طباعة بطاقة التكلفة' },
      { key: 'passport.simulate', label: 'استخدام محاكي سعر الخام' },
    ],
  },
  {
    id: 'executive',
    label: 'لوحة الإدارة العليا',
    category: 'الخدمات',
    permissions: [{ key: 'executive.view', label: 'عرض لوحة القيادة التنفيذية' }],
  },
  {
    id: 'finance',
    label: 'التحليل المالي',
    category: 'الخدمات',
    permissions: [
      { key: 'finance.view', label: 'عرض التحليل المالي' },
      { key: 'finance.simulate', label: 'تشغيل محاكي التكلفة' },
      { key: 'finance.edit_costs', label: 'الانتقال لتعديل عناصر التكلفة' },
    ],
  },
  {
    id: 'production',
    label: 'الإنتاج والماكينات',
    category: 'الخدمات',
    permissions: [{ key: 'production.view', label: 'عرض الخطوط والماكينات' }],
  },
  {
    id: 'quality',
    label: 'الجودة والتشغيل',
    category: 'الخدمات',
    permissions: [
      { key: 'quality.view', label: 'عرض البطاقة الفنية' },
      { key: 'quality.inspect', label: 'تسجيل نتائج الفحص' },
      { key: 'quality.reset', label: 'بدء جولة فحص جديدة' },
    ],
  },
  ...dataGroups,
  {
    id: 'users',
    label: 'المستخدمون',
    category: 'إدارة النظام',
    permissions: [
      { key: 'users.view', label: 'عرض المستخدمين' },
      { key: 'users.create', label: 'إضافة مستخدم' },
      { key: 'users.edit', label: 'تعديل مستخدم' },
      { key: 'users.delete', label: 'حذف مستخدم' },
      { key: 'users.reset_password', label: 'إعادة تعيين كلمة المرور' },
    ],
  },
  {
    id: 'roles',
    label: 'الأدوار والصلاحيات',
    category: 'إدارة النظام',
    permissions: [
      { key: 'roles.view', label: 'عرض الأدوار' },
      { key: 'roles.create', label: 'إنشاء دور' },
      { key: 'roles.edit', label: 'تعديل صلاحيات دور' },
      { key: 'roles.delete', label: 'حذف دور' },
    ],
  },
  {
    id: 'audit',
    label: 'سجل العمليات',
    category: 'إدارة النظام',
    permissions: [
      { key: 'audit.view', label: 'عرض سجل العمليات' },
      { key: 'audit.export', label: 'تصدير سجل العمليات' },
    ],
  },
  {
    id: 'settings',
    label: 'إعدادات النظام',
    category: 'الإعدادات',
    permissions: [
      { key: 'settings.edit', label: 'تعديل هامش الربح وسعر الخام' },
      { key: 'settings.reset_demo', label: 'استعادة البيانات التجريبية' },
    ],
  },
];

export const ALL_PERMISSIONS: string[] = PERMISSION_GROUPS.flatMap((group) =>
  group.permissions.map((permission) => permission.key),
);

export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((group) =>
    group.permissions.map((permission) => [permission.key, permission.label]),
  ),
);

export const PERMISSION_CATEGORIES: PermissionCategory[] = [
  'الخدمات',
  'مركز البيانات',
  'إدارة النظام',
  'الإعدادات',
];

export function hasPermission(permissions: string[] | undefined, key: string): boolean {
  if (!permissions) return false;
  return permissions.includes('*') || permissions.includes(key);
}

export function canAnyDataView(permissions: string[] | undefined): boolean {
  return DATA_TABLES.some((table) => hasPermission(permissions, `data.${table.key}.view`));
}

export function permissionCount(permissions: string[] | undefined): number {
  if (!permissions) return 0;
  return permissions.includes('*') ? ALL_PERMISSIONS.length : permissions.length;
}

const DATA_ALL = DATA_TABLES.flatMap((table) =>
  DATA_ACTIONS.map((action) => `data.${table.key}.${action.key}`),
);
const DATA_VIEW = DATA_TABLES.map((table) => `data.${table.key}.view`);
const ALL_VIEW = ALL_PERMISSIONS.filter((key) => key.endsWith('.view'));

export interface RoleSeed {
  id: string;
  name: string;
  description: string;
  permissions: string[];
  system?: boolean;
}

export const DEFAULT_ROLES: RoleSeed[] = [
  {
    id: 'role-admin',
    name: 'مدير النظام',
    description: 'صلاحيات كاملة على كل الخدمات والعمليات وإدارة المستخدمين والأدوار.',
    permissions: ['*'],
    system: true,
  },
  {
    id: 'role-finance',
    name: 'المدير المالي',
    description: 'التكاليف والهوامش ومحاكي الخام وجميع جداول البيانات.',
    permissions: [
      'passport.view',
      'passport.cost_view',
      'passport.print_technical',
      'passport.print_cost',
      'passport.simulate',
      'finance.view',
      'finance.simulate',
      'finance.edit_costs',
      'executive.view',
      'quality.view',
      ...DATA_ALL,
      'settings.edit',
    ],
  },
  {
    id: 'role-executive',
    name: 'الإدارة العليا',
    description: 'عرض شامل لكل المؤشرات والجداول والتقارير دون إدارة النظام.',
    permissions: [
      ...ALL_VIEW,
      'passport.cost_view',
      'passport.print_technical',
      'passport.print_cost',
      'audit.export',
    ],
  },
  {
    id: 'role-production',
    name: 'مدير الإنتاج',
    description: 'الخطوط والماكينات والإسطمبات وأزمنة التشغيل دون بيانات التكلفة.',
    permissions: [
      'passport.view',
      'passport.print_technical',
      'production.view',
      'quality.view',
      'data.products.view',
      'data.rawMaterials.view',
      'data.packaging.view',
      'data.machinery.view',
      'data.machinery.create',
      'data.machinery.edit',
      'data.machinery.import',
      'data.molds.view',
      'data.molds.create',
      'data.molds.edit',
    ],
  },
  {
    id: 'role-quality',
    name: 'مشرف الجودة',
    description: 'البطاقة الفنية ونقاط الفحص ومراجعة جداول المواصفات.',
    permissions: [
      'passport.view',
      'passport.print_technical',
      'quality.view',
      'quality.inspect',
      'quality.reset',
      'data.products.view',
      'data.rawMaterials.view',
      'data.molds.view',
      'data.packaging.view',
    ],
  },
];

export interface DemoAccount {
  username: string;
  password: string;
  label: string;
  roleName: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { username: 'admin', password: 'admin123', label: 'مدير النظام', roleName: 'مدير النظام' },
  { username: 'finance', password: 'finance123', label: 'المدير المالي', roleName: 'المدير المالي' },
  { username: 'exec', password: 'exec123', label: 'الإدارة العليا', roleName: 'الإدارة العليا' },
  {
    username: 'production',
    password: 'production123',
    label: 'مدير الإنتاج',
    roleName: 'مدير الإنتاج',
  },
  { username: 'quality', password: 'quality123', label: 'مشرف الجودة', roleName: 'مشرف الجودة' },
];

export const DATA_VIEW_PERMISSION = DATA_VIEW;
