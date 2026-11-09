import { useMemo, useState } from 'react';
import { Clock, Download, LogIn, ScrollText, ShieldCheck, UserCog } from 'lucide-react';
import { Badge, Button, Card, EmptyState, SearchInput, Stat, useToast } from '../components/ui';
import { useAuth } from '../auth/AuthContext';

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

function actionTone(action: string) {
  if (action.includes('فاشلة') || action.includes('حذف')) return 'rose' as const;
  if (action.includes('دخول')) return 'green' as const;
  if (action.includes('إنشاء') || action.includes('إضافة')) return 'blue' as const;
  if (action.includes('تعديل') || action.includes('تعيين')) return 'amber' as const;
  return 'slate' as const;
}

export function AuditLogScreen() {
  const { audit, can, log } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return audit;
    return audit.filter((entry) =>
      [entry.userName, entry.action, entry.detail].join(' ').toLowerCase().includes(term),
    );
  }, [audit, query]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayCount = audit.filter((entry) => new Date(entry.at) >= todayStart).length;
  const loginCount = audit.filter((entry) => entry.action.includes('تسجيل دخول')).length;
  const uniqueUsers = new Set(audit.map((entry) => entry.userId)).size;

  const exportCsv = () => {
    if (!can('audit.export')) {
      toast('لا تملك صلاحية تصدير سجل العمليات', 'error');
      return;
    }
    const rows = [
      ['الوقت', 'المستخدم', 'العملية', 'التفاصيل'],
      ...filtered.map((entry) => [
        formatDateTime(entry.at),
        entry.userName,
        entry.action,
        entry.detail,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `سجل-العمليات-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    log('تصدير سجل العمليات', `${filtered.length} سجل`);
    toast('تم تصدير سجل العمليات');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Audit Trail</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">سجل العمليات</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            تتبّع كل دخول، إنشاء، تعديل، حذف، استيراد، تصدير وطباعة على المنصة مع هوية المنفّذ
            وتوقيت العملية.
          </p>
        </div>
        <Button variant="outline" onClick={exportCsv} disabled={!can('audit.export')}>
          <Download size={16} /> تصدير CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي العمليات" value={audit.length} icon={<ScrollText size={18} />} />
        <Stat label="عمليات اليوم" value={todayCount} tone="crown" icon={<Clock size={18} />} />
        <Stat label="مرات الدخول" value={loginCount} tone="elora" icon={<LogIn size={18} />} />
        <Stat
          label="مستخدمون نشطون بالسجل"
          value={uniqueUsers}
          hint="حسب العمليات المسجلة"
          tone="prime"
          icon={<UserCog size={18} />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="بحث بالمستخدم أو العملية أو التفاصيل..."
            className="sm:w-96"
          />
          <span className="text-[11px] font-bold text-slate-400 sm:mr-auto">
            عرض {Math.min(filtered.length, 300)} من {filtered.length} عملية — آخر 500 عملية
            محفوظة
          </span>
        </div>

        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[860px] text-right text-[12px]">
            <thead>
              <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                <th className="px-4 py-3">التوقيت</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">العملية</th>
                <th className="px-4 py-3">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 300).map((entry) => (
                <tr key={entry.id} className="border-t border-slate-100 hover:bg-mist/40">
                  <td className="whitespace-nowrap px-4 py-3 text-[10px] font-semibold text-slate-500">
                    {formatDateTime(entry.at)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink text-[9px] font-black text-white">
                        {entry.userName.replace(/^(م\.|أ\.|د\.)\s*/, '').slice(0, 2)}
                      </span>
                      <span className="text-[11px] font-bold text-ink">{entry.userName}</span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <Badge tone={actionTone(entry.action)}>{entry.action}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[11px] font-medium text-slate-500">
                    {entry.detail}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<ShieldCheck size={26} />}
                title="لا توجد عمليات مطابقة"
                description="ستظهر العمليات هنا تلقائيًا بمجرد تنفيذ أي إجراء على المنصة."
              />
            </div>
          ) : null}
        </div>
      </Card>

      <p className="flex items-center gap-1.5 text-[10px] font-medium text-slate-400">
        <ShieldCheck size={12} /> السجل غير قابل للتعديل من الواجهة، ويُحفظ محليًا على هذا الجهاز
        بحد أقصى 500 عملية.
      </p>
    </div>
  );
}
