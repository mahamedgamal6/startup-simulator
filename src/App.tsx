import { useState } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Sidebar, Topbar, NAV_ITEMS, canAccessNav } from './components/Shell';
import { PrintSheet, type PrintPayload } from './components/PrintSheet';
import { Button, Card, useToast } from './components/ui';
import { PassportScreen } from './screens/Passport';
import { DataStudioScreen } from './screens/DataStudio';
import { ProductionScreen } from './screens/Production';
import { FinanceScreen } from './screens/Finance';
import { ExecutiveScreen } from './screens/Executive';
import { QualityScreen } from './screens/Quality';
import { LoginScreen } from './screens/Login';
import { UsersAdminScreen } from './screens/UsersAdmin';
import { RolesAdminScreen } from './screens/RolesAdmin';
import { AuditLogScreen } from './screens/AuditLog';
import { useAuth } from './auth/AuthContext';
import { useData } from './lib/db';
import { canAnyDataView } from './auth/permissions';
import type { TableKey, ViewKey } from './types';

export default function App() {
  const { currentUser, currentRole, can, logout, log, loading } = useAuth();
  const { syncState } = useData();
  const toast = useToast();

  const [view, setView] = useState<ViewKey>('executive');
  const [productCode, setProductCode] = useState('01020020');
  const [dataTable, setDataTable] = useState<TableKey | undefined>();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);

  if (loading) {
    return (
      <div className="mesh flex min-h-screen items-center justify-center bg-mist p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <ShieldCheck size={24} />
          </span>
          <p className="text-sm font-extrabold text-ink">جارٍ التحقق من الجلسة الآمنة…</p>
          <p className="text-[11px] font-medium text-slate-400">
            يتم التحقق من الرمز وصلاحيات دورك عبر Supabase.
          </p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  if (!syncState.ready) {
    return (
      <div className="mesh flex min-h-screen items-center justify-center bg-mist p-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-14 w-14 animate-pulse items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <ShieldCheck size={24} />
          </span>
          <p className="text-sm font-extrabold text-ink">جارٍ تحميل بيانات المصنع…</p>
          <p className="text-[11px] font-medium text-slate-400">
            تتم مزامنة المنتجات والماكينات والإسطمبات ونتائج الفحص من Supabase.
          </p>
        </div>
      </div>
    );
  }

  const canAnyData = canAnyDataView(currentRole?.permissions);
  const allowedViews = NAV_ITEMS.filter((item) => canAccessNav(item, can, canAnyData));
  const activeView = allowedViews.some((item) => item.key === view)
    ? view
    : allowedViews[0]?.key;

  const navigate = (nextView: ViewKey, table?: TableKey) => {
    setView(nextView);
    setDataTable(table);
    setMobileOpen(false);
  };

  const requestPrint = (payload: PrintPayload) => {
    const permission =
      payload.mode === 'cost' ? 'passport.print_cost' : 'passport.print_technical';
    if (!can(permission)) {
      toast('لا تملك صلاحية طباعة هذه الوثيقة', 'error');
      return;
    }
    log(
      'طباعة وثيقة',
      `${payload.mode === 'cost' ? 'بطاقة التكلفة' : 'البطاقة الفنية'} — ${payload.code}`,
    );
    setPrintPayload(payload);
  };

  if (!activeView) {
    return (
      <div className="mesh flex min-h-screen items-center justify-center bg-mist p-6">
        <Card className="flex max-w-md flex-col items-center gap-3 p-8 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <ShieldOff size={24} />
          </span>
          <h1 className="text-base font-extrabold text-ink">لا توجد خدمات مصرّح بها</h1>
          <p className="text-[12px] font-medium leading-relaxed text-slate-500">
            الدور المرتبط بحسابك لا يملك صلاحية عرض أي خدمة حاليًا. راجع مدير النظام لتعديل
            صلاحيات الدور.
          </p>
          <Button variant="outline" onClick={logout} className="mt-1">
            تسجيل الخروج
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-shell min-h-screen bg-mist">
      <Sidebar
        view={activeView}
        onNavigate={navigate}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        can={can}
        canAnyData={canAnyData}
        user={currentUser}
        role={currentRole}
        onLogout={logout}
      />

      <div className="lg:pr-[274px]">
        <Topbar
          view={activeView}
          onOpenMenu={() => setMobileOpen(true)}
          user={currentUser}
          role={currentRole}
          can={can}
          onNavigate={navigate}
          onLogout={logout}
        />
        <main className="mesh mx-auto min-h-[calc(100vh-64px)] max-w-[1500px] px-4 pb-14 pt-4 sm:px-6 lg:px-8">
          {syncState.error ? (
            <div
              role="alert"
              className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-amber-800"
            >
              {syncState.error} — تُعرض آخر نسخة محلية حتى تعود المزامنة.
            </div>
          ) : null}
          {activeView === 'passport' ? (
            <PassportScreen
              can={can}
              productCode={productCode}
              onSelect={setProductCode}
              onPrint={requestPrint}
              log={log}
            />
          ) : null}
          {activeView === 'data' ? (
            <DataStudioScreen can={can} log={log} initialTable={dataTable} />
          ) : null}
          {activeView === 'production' ? (
            <ProductionScreen
              productCode={productCode}
              onSelect={setProductCode}
              can={can}
              onManage={(table) => navigate('data', table)}
            />
          ) : null}
          {activeView === 'finance' ? (
            <FinanceScreen
              can={can}
              productCode={productCode}
              onSelect={setProductCode}
              onNavigateData={(table) => navigate('data', table)}
            />
          ) : null}
          {activeView === 'executive' ? <ExecutiveScreen /> : null}
          {activeView === 'quality' ? (
            <QualityScreen
              can={can}
              productCode={productCode}
              onSelect={setProductCode}
              onPrint={requestPrint}
            />
          ) : null}
          {activeView === 'users' ? <UsersAdminScreen /> : null}
          {activeView === 'roles' ? <RolesAdminScreen /> : null}
          {activeView === 'audit' ? <AuditLogScreen /> : null}
        </main>
      </div>

      <PrintSheet payload={printPayload} onClose={() => setPrintPayload(null)} />
    </div>
  );
}
