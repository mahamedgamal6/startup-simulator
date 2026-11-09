import { useEffect, useRef, useState } from 'react';
import {
  Calculator,
  ChevronDown,
  Database,
  Factory,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  UserCog,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { BrandMark } from './ProductArt';
import { Button, Modal, cn, useToast } from './ui';
import { useData } from '../lib/db';
import { permissionCount } from '../auth/permissions';
import { todayLong } from '../lib/format';
import type { AppRole, AppUser, ViewKey } from '../types';

export interface NavItem {
  key: ViewKey;
  label: string;
  icon: LucideIcon;
  group: 'الخدمات' | 'إدارة النظام';
  permission: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    key: 'executive',
    label: 'لوحة القيادة',
    icon: LayoutDashboard,
    group: 'الخدمات',
    permission: 'executive.view',
  },
  { key: 'passport', label: 'بطاقة المنتج', icon: Package, group: 'الخدمات', permission: 'passport.view' },
  { key: 'finance', label: 'التحليل المالي', icon: Calculator, group: 'الخدمات', permission: 'finance.view' },
  { key: 'production', label: 'الإنتاج والماكينات', icon: Factory, group: 'الخدمات', permission: 'production.view' },
  { key: 'quality', label: 'الجودة والتشغيل', icon: ShieldCheck, group: 'الخدمات', permission: 'quality.view' },
  { key: 'data', label: 'مركز البيانات', icon: Database, group: 'الخدمات', permission: 'data.any' },
  { key: 'users', label: 'المستخدمون', icon: Users, group: 'إدارة النظام', permission: 'users.view' },
  { key: 'roles', label: 'الأدوار والصلاحيات', icon: UserCog, group: 'إدارة النظام', permission: 'roles.view' },
  { key: 'audit', label: 'سجل العمليات', icon: ScrollText, group: 'إدارة النظام', permission: 'audit.view' },
];

export function canAccessNav(
  item: NavItem,
  can: (permission: string) => boolean,
  canAnyData: boolean,
): boolean {
  return item.permission === 'data.any' ? canAnyData : can(item.permission);
}

export const VIEW_META: Record<
  ViewKey,
  { label: string; subtitle: string; icon: LucideIcon }
> = {
  passport: {
    label: 'بطاقة المنتج',
    subtitle: 'بطاقة المنتج الرقمية والمسار الصناعي',
    icon: Package,
  },
  data: {
    label: 'مركز البيانات',
    subtitle: 'إدارة الجداول والاستيراد والتصدير',
    icon: Database,
  },
  production: {
    label: 'الإنتاج والماكينات',
    subtitle: 'الخطوط والإسطمبات وأزمنة التشغيل',
    icon: Factory,
  },
  finance: {
    label: 'التحليل المالي',
    subtitle: 'التكاليف والهوامش ومحاكي الخام',
    icon: Calculator,
  },
  executive: {
    label: 'لوحة القيادة',
    subtitle: 'مؤشرات الأداء والربحية والتصدير',
    icon: LayoutDashboard,
  },
  quality: {
    label: 'الجودة والتشغيل',
    subtitle: 'البطاقة الفنية وخطة الفحص',
    icon: ShieldCheck,
  },
  users: {
    label: 'المستخدمون',
    subtitle: 'الحسابات والحالة وكلمات المرور',
    icon: Users,
  },
  roles: {
    label: 'الأدوار والصلاحيات',
    subtitle: 'مصفوفة الخدمات والعمليات',
    icon: UserCog,
  },
  audit: {
    label: 'سجل العمليات',
    subtitle: 'تتبّع كل إجراء على المنصة',
    icon: ScrollText,
  },
};

const initialsOf = (name: string) => name.replace(/^(م\.|أ\.|د\.)\s*/, '').slice(0, 2);

export function Sidebar({
  view,
  onNavigate,
  open,
  onClose,
  can,
  canAnyData,
  user,
  role,
  onLogout,
}: {
  view: ViewKey;
  onNavigate: (view: ViewKey) => void;
  open: boolean;
  onClose: () => void;
  can: (permission: string) => boolean;
  canAnyData: boolean;
  user: AppUser;
  role: AppRole | null;
  onLogout: () => void;
}) {
  const { db, resetDemo } = useData();
  const toast = useToast();
  const [confirmReset, setConfirmReset] = useState(false);
  const canResetDemo = can('settings.reset_demo');

  const visible = NAV_ITEMS.filter((item) => canAccessNav(item, can, canAnyData));
  const sections = (['الخدمات', 'إدارة النظام'] as const)
    .map((label) => ({ label, items: visible.filter((item) => item.group === label) }))
    .filter((section) => section.items.length > 0);

  return (
    <>
      {open ? (
        <div
          className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={onClose}
        />
      ) : null}
      <aside
        className={cn(
          'scrollbar-thin fixed inset-y-0 right-0 z-50 flex w-[274px] flex-col overflow-y-auto bg-gradient-to-b from-[#1c1c20] via-[#1c1517] to-[#120f10] px-4 py-5 text-white transition-transform duration-300 lg:translate-x-0',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="flex items-center gap-3 px-1">
          <BrandMark className="h-11 w-11" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-black">مصانع الزنوكي</p>
            <p className="text-[10px] font-semibold text-white/45">للأواني المنزلية — Industrial OS</p>
          </div>
          <button
            onClick={onClose}
            aria-label="إغلاق القائمة"
            className="mr-auto rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.06] p-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand text-[10px] font-black text-white">
              {initialsOf(user.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-extrabold">{user.name}</p>
              <p className="truncate text-[9px] font-semibold text-white/45">{role?.name}</p>
            </div>
          </div>
          <p className="mt-2 flex items-center gap-1 text-[9px] font-bold text-white/40">
            <ShieldCheck size={10} />
            {role?.permissions.includes('*')
              ? 'صلاحيات كاملة على المنصة'
              : `${permissionCount(role?.permissions)} صلاحية مصرّح بها`}
          </p>
        </div>

        <nav className="mt-4 space-y-3">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="mb-1 px-2 text-[9px] font-bold uppercase tracking-widest text-white/30">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      onClick={() => onNavigate(item.key)}
                      className={cn('sidebar-link', view === item.key && 'sidebar-link-active')}
                    >
                      <Icon size={17} />
                      <span className="flex-1 text-right">{item.label}</span>
                      {view === item.key ? (
                        <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="mt-5 rounded-xl border border-white/10 p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold text-white/40">
            <Database size={12} /> ملخص قاعدة البيانات
          </p>
          <div className="mt-2 space-y-1 text-[10px] font-semibold text-white/55">
            <p className="flex justify-between">
              <span>المنتجات</span>
              <span className="num">{db.products.length}</span>
            </p>
            <p className="flex justify-between">
              <span>الخامات</span>
              <span className="num">{db.rawMaterials.length}</span>
            </p>
            <p className="flex justify-between">
              <span>الماكينات</span>
              <span className="num">{db.machinery.length}</span>
            </p>
            <p className="flex justify-between">
              <span>أنواع الرش</span>
              <span className="num">{(db.sprayCoatings ?? []).length}</span>
            </p>
          </div>
        </div>

        <div className="mt-auto space-y-2 pt-4">
          {canResetDemo ? (
            <button
              onClick={() => setConfirmReset(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[11px] font-bold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              <RotateCcw size={13} /> استعادة البيانات التجريبية
            </button>
          ) : null}
          <button
            onClick={onLogout}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand/90 px-3 py-2.5 text-[11px] font-bold text-white transition hover:bg-brand"
          >
            <LogOut size={13} /> تسجيل الخروج
          </button>
          <p className="text-center text-[9px] font-medium text-white/25">
            إصدار 1.5 — البيانات والصور (مع صور افتراضية للإكسسوارات) وقطع الغيار والماكينات والإسطمبات والفحوصات متزامنة عبر Supabase
          </p>
        </div>
      </aside>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="استعادة البيانات التجريبية"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              إلغاء
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                setConfirmReset(false);
                const restored = await resetDemo();
                if (restored) toast('تمت استعادة قاعدة البيانات التجريبية بنجاح');
              }}
            >
              <RotateCcw size={15} /> استعادة
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-slate-600">
          سيتم استبدال جميع الجداول ونتائج الفحص بالبيانات التجريبية الأصلية. أي تعديلات أو
          سجلات أضفتها ستُفقد. الحسابات والصلاحيات لن تتأثر.
        </p>
      </Modal>
    </>
  );
}

function UserMenu({
  user,
  role,
  can,
  onNavigate,
  onLogout,
}: {
  user: AppUser;
  role: AppRole | null;
  can: (permission: string) => boolean;
  onNavigate: (view: ViewKey) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items = [
    { view: 'audit' as ViewKey, label: 'سجل العمليات', permission: 'audit.view' },
    { view: 'users' as ViewKey, label: 'المستخدمون', permission: 'users.view' },
    { view: 'roles' as ViewKey, label: 'الأدوار والصلاحيات', permission: 'roles.view' },
  ].filter((item) => can(item.permission));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 transition hover:border-slate-300"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[9px] font-black text-white">
          {initialsOf(user.name)}
        </span>
        <span className="hidden text-right sm:block">
          <span className="block max-w-[130px] truncate text-[11px] font-extrabold text-ink">
            {user.name}
          </span>
          <span className="block text-[9px] font-semibold text-slate-400">{role?.name}</span>
        </span>
        <ChevronDown
          size={14}
          className={cn('text-slate-400 transition-transform', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl animate-fade-up">
          <div className="border-b border-slate-100 p-3">
            <p className="text-[12px] font-extrabold text-ink">{user.name}</p>
            <p className="num mt-0.5 text-[10px] font-semibold text-slate-400">@{user.username}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[9px] font-bold text-brand-dark">
                {role?.name ?? 'بدون دور'}
              </span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500">
                {role?.permissions.includes('*')
                  ? 'كل الصلاحيات'
                  : `${permissionCount(role?.permissions)} صلاحية`}
              </span>
            </div>
          </div>
          {items.length ? (
            <div className="p-1.5">
              {items.map((item) => (
                <button
                  key={item.view}
                  onClick={() => {
                    setOpen(false);
                    onNavigate(item.view);
                  }}
                  className="flex w-full items-center rounded-lg px-2.5 py-2 text-right text-[11px] font-bold text-slate-600 transition hover:bg-mist hover:text-ink"
                >
                  {item.label}
                </button>
              ))}
            </div>
          ) : null}
          <div className="border-t border-slate-100 p-1.5">
            <button
              onClick={() => {
                setOpen(false);
                onLogout();
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-right text-[11px] font-bold text-rose-600 transition hover:bg-rose-50"
            >
              <LogOut size={14} /> تسجيل الخروج
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({
  view,
  onOpenMenu,
  user,
  role,
  can,
  onNavigate,
  onLogout,
}: {
  view: ViewKey;
  onOpenMenu: () => void;
  user: AppUser;
  role: AppRole | null;
  can: (permission: string) => boolean;
  onNavigate: (view: ViewKey) => void;
  onLogout: () => void;
}) {
  const meta = VIEW_META[view];

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
        <button
          onClick={onOpenMenu}
          aria-label="فتح القائمة"
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 lg:hidden"
        >
          <Menu size={18} />
        </button>

        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <meta.icon size={17} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-extrabold text-ink">{meta.label}</p>
            <p className="hidden truncate text-[10px] font-medium text-slate-400 sm:block">
              {meta.subtitle}
            </p>
          </div>
        </div>

        <div className="mr-auto flex items-center gap-2">
          <span className="hidden rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] font-bold text-slate-500 xl:block">
            {todayLong()}
          </span>
          <UserMenu
            user={user}
            role={role}
            can={can}
            onNavigate={onNavigate}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  );
}
