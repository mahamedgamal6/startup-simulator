import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Download,
  FileSpreadsheet,
  FileUp,
  Lock,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { buildTables, type FieldDef, type TableDef } from '../data/tables';
import { useToast } from '../components/ui';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  SearchInput,
  cn,
} from '../components/ui';
import { useData, makeId } from '../lib/db';
import { downloadTemplate, exportCsv, exportExcel, readSheet } from '../lib/io';
import { fileStamp, fmt, money } from '../lib/format';

import type { TableKey, TableMap } from '../types';

type RowRecord = Record<string, string | number | string[] | undefined>;

const toNumber = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const cleaned = String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[^\d.-]/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseCodes = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '')
    .split(/[,،;/\n]/)
    .map((part) => part.trim())
    .filter(Boolean);
};

export function DataStudioScreen({
  can,
  log,
  initialTable,
}: {
  can: (permission: string) => boolean;
  log: (action: string, detail: string) => void;
  initialTable?: TableKey;
}) {
  const { db, upsert, upsertMany, remove } = useData();
  const toast = useToast();
  const tables = useMemo(() => buildTables(db), [db]);
  const [activeKey, setActiveKey] = useState<TableKey>(initialTable ?? 'products');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' }>({
    key: 'code',
    dir: 'asc',
  });
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RowRecord | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [deleteTarget, setDeleteTarget] = useState<RowRecord | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const canSeeCosts = can('passport.cost_view') || can('finance.view');
  const active = tables.find((table) => table.key === activeKey) ?? tables[0];
  const canDo = (action: string) => can(`data.${active.key}.${action}`);

  useEffect(() => {
    if (initialTable) setActiveKey(initialTable);
  }, [initialTable]);

  useEffect(() => {
    setQuery('');
    setFilter('');
    const firstField = active.fields[0];
    setSort({ key: firstField?.key ?? 'code', dir: 'asc' });
  }, [activeKey]);

  const visibleFields = active.fields.filter((field) => canSeeCosts || !field.cost);
  const rows = db[active.key] as unknown as RowRecord[];

  const filterField = active.fields.find((field) => field.type === 'select');
  const filterOptions = useMemo(() => {
    if (!filterField) return [];
    return Array.from(
      new Set(rows.map((row) => String(row[filterField.key] ?? '')).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [rows, filterField]);

  const displayRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    let list = rows;
    if (term) {
      list = list.filter((row) =>
        active.fields
          .map((field) => {
            const value = row[field.key];
            return Array.isArray(value) ? value.join(' ') : String(value ?? '');
          })
          .join(' ')
          .toLowerCase()
          .includes(term),
      );
    }
    if (filter && filterField) {
      list = list.filter((row) => String(row[filterField.key] ?? '') === filter);
    }
    return [...list].sort((a, b) => {
      const left = a[sort.key];
      const right = b[sort.key];
      const leftValue = Array.isArray(left) ? left.join(',') : left ?? '';
      const rightValue = Array.isArray(right) ? right.join(',') : right ?? '';
      if (typeof leftValue === 'number' && typeof rightValue === 'number') {
        return sort.dir === 'asc' ? leftValue - rightValue : rightValue - leftValue;
      }
      const comparison = String(leftValue).localeCompare(String(rightValue), 'ar', {
        numeric: true,
      });
      return sort.dir === 'asc' ? comparison : -comparison;
    });
  }, [rows, query, filter, filterField, sort, active.fields]);

  const openAdd = () => {
    setEditing(null);
    setForm(
      Object.fromEntries(
        active.fields.map((field) => {
          const value = active.defaults[field.key];
          return [field.key, Array.isArray(value) ? value.join(', ') : String(value ?? '')];
        }),
      ),
    );
    setFormOpen(true);
  };

  const openEdit = (row: RowRecord) => {
    setEditing(row);
    setForm(
      Object.fromEntries(
        active.fields.map((field) => {
          const value = row[field.key];
          return [field.key, Array.isArray(value) ? value.join(', ') : String(value ?? '')];
        }),
      ),
    );
    setFormOpen(true);
  };

  const save = async () => {
    if (!(editing ? canDo('edit') : canDo('create'))) {
      toast('لا تملك صلاحية تنفيذ هذه العملية على هذا الجدول', 'error');
      return;
    }
    const values: Record<string, string | number | string[]> = {};
    for (const field of active.fields) {
      const rawValue = form[field.key] ?? '';
      if (field.required && !String(rawValue).trim()) {
        toast(`الحقل «${field.label}» مطلوب`, 'error');
        return;
      }
      if (field.type === 'number') values[field.key] = toNumber(rawValue);
      else if (field.type === 'codes') values[field.key] = parseCodes(rawValue);
      else values[field.key] = String(rawValue).trim();
    }

    const primary = String(values[active.primaryKey] ?? '');
    const duplicate = rows.some(
      (row) => String(row[active.primaryKey] ?? '') === primary && row.id !== editing?.id,
    );
    if (duplicate) {
      toast('هذا الكود مستخدم بالفعل، اختر كودًا آخر', 'error');
      return;
    }

    const row = {
      ...(editing ?? { id: makeId(active.prefix) }),
      ...values,
    } as unknown as TableMap[TableKey];

    const saved = await upsert(active.key, row);
    if (!saved) return;
    log(
      editing ? 'تعديل سجل' : 'إضافة سجل',
      `${active.label} — ${String(values[active.primaryKey] ?? '')}`,
    );
    toast(editing ? 'تم تحديث السجل بنجاح' : 'تمت إضافة السجل بنجاح');
    setFormOpen(false);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    if (!canDo('delete')) {
      toast('لا تملك صلاحية حذف سجلات هذا الجدول', 'error');
      return;
    }
    const id = String(deleteTarget.id);
    const deleted = await remove(active.key, id);
    if (!deleted) return;
    /* عناصر التكلفة محسوبة تلقائيًا لكل منتج */
    log(
      'حذف سجل',
      `${active.label} — ${String(deleteTarget[active.primaryKey] ?? deleteTarget.id)}`,
    );
    toast('تم حذف السجل');
    setDeleteTarget(null);
  };

  const exportRows = () => {
    const columns = [
      ...active.fields.map((field) => ({ key: field.key, label: field.label })),
      
    ];
    const data = displayRows.map((row) => {
      const mapped: Record<string, string | number> = {};
      active.fields.forEach((field) => {
        const value = row[field.key];
        mapped[field.label] = Array.isArray(value) ? value.join(', ') : value ?? '';
      });
      
      return mapped;
    });
    return { columns, data };
  };

  const handleExport = (format: 'xlsx' | 'csv') => {
    if (!canDo('export')) {
      toast('لا تملك صلاحية تصدير هذا الجدول', 'error');
      return;
    }
    const { columns, data } = exportRows();
    const payload = {
      fileBase: `${active.label}-${fileStamp()}`,
      sheetName: active.label,
      columns,
      rows: data,
    };
    if (format === 'xlsx') exportExcel(payload);
    else exportCsv(payload);
    log('تصدير جدول', `${active.label} — ${data.length} سجل (${format.toUpperCase()})`);
    toast(`تم تصدير ${data.length} سجل بصيغة ${format === 'xlsx' ? 'Excel' : 'CSV'}`);
  };

  const handleTemplate = () => {
    if (!canDo('export')) {
      toast('لا تملك صلاحية تنزيل نموذج هذا الجدول', 'error');
      return;
    }
    downloadTemplate({
      fileBase: active.label,
      sheetName: active.label,
      columns: active.fields.map((field) => ({ key: field.key, label: field.label })),
    });
    log('تنزيل نموذج', `${active.label} — نموذج فارغ`);
    toast('تم تنزيل نموذج فارغ جاهز للتعبئة');
  };

  const handleImport = async (file: File) => {
    if (!canDo('import')) {
      toast('لا تملك صلاحية استيراد هذا الجدول', 'error');
      return;
    }
    try {
      const parsed = await readSheet(file);
      if (!parsed.length) {
        toast('الملف لا يحتوي على بيانات قابلة للقراءة', 'error');
        return;
      }
      let added = 0;
      let updated = 0;
      let skipped = 0;
      const pending: TableMap[TableKey][] = [];

      parsed.forEach((raw) => {
        const values: Record<string, string | number | string[]> = {};
        for (const field of active.fields) {
          const incoming = raw[field.label] ?? raw[field.key] ?? '';
          if (field.required && !String(incoming).trim()) return;
          if (field.type === 'number') values[field.key] = toNumber(incoming);
          else if (field.type === 'codes') values[field.key] = parseCodes(incoming);
          else values[field.key] = String(incoming).trim();
        }
        const primary = String(values[active.primaryKey] ?? '').trim();
        if (!primary) {
          skipped += 1;
          return;
        }
        const existing = rows.find(
          (row) => String(row[active.primaryKey] ?? '').trim() === primary,
        );
        if (existing) {
          updated += 1;
          pending.push({
            ...(existing as unknown as TableMap[TableKey]),
            ...values,
          } as unknown as TableMap[TableKey]);
        } else {
          added += 1;
          pending.push({
            id: makeId(active.prefix),
            ...values,
          } as unknown as TableMap[TableKey]);
        }
      });

      const imported = await upsertMany(active.key, pending);
      if (!imported) return;
      setImportSummary(
        `تمت قراءة ${parsed.length} صفًا: ${added} إضافة جديدة، ${updated} تحديث، ${skipped} تجاهُل.`,
      );
      log('استيراد جدول', `${active.label} — ${added} جديد و${updated} تحديث`);
      toast(`تم استيراد البيانات: ${added} جديد و${updated} تحديث`, 'success');
    } catch {
      toast('تعذر قراءة الملف. استخدم نموذج Excel أو CSV المرفق.', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const renderCell = (row: RowRecord, field: FieldDef) => {
    const value = row[field.key];
    if (field.type === 'codes') {
      const codes = Array.isArray(value) ? value : parseCodes(value);
      if (!codes.length) return <span className="text-slate-300">—</span>;
      return (
        <span className="flex flex-wrap gap-1">
          {codes.map((code) => (
            <span
              key={code}
              className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 num"
            >
              {code}
            </span>
          ))}
        </span>
      );
    }
    if (field.type === 'number') {
      const numeric = Number(value ?? 0);
      return (
        <span className="num tnum font-semibold text-ink">
          {field.cost ? `${money(numeric)} ج.م` : fmt(numeric)}
          {!field.cost && field.step && field.step < 1 ? '' : ''}
        </span>
      );
    }
    if (field.key === active.primaryKey) {
      return <span className="num rounded-md bg-slate-100 px-1.5 py-1 text-[11px] font-bold">{String(value ?? '')}</span>;
    }
    return <span className="font-medium text-ink-soft">{String(value ?? '—')}</span>;
  };

  const locked = !canDo('view');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="brand">Data Studio</Badge>
            <span className="text-[11px] font-bold text-slate-400">
              {rows.length} سجل في {active.label}
            </span>
          </div>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">مركز إدارة قواعد البيانات</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            {active.subtitle} — إضافة، تعديل، حذف، استيراد وتصدير مع تحكم كامل في الصلاحيات.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleImport(file);
            }}
          />
          {canDo('import') ? (
            <Button variant="outline" size="md" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> استيراد Excel / CSV
            </Button>
          ) : null}
          {canDo('export') ? (
            <Button variant="outline" size="md" onClick={() => handleExport('xlsx')}>
              <Download size={16} /> تصدير
            </Button>
          ) : null}
          {canDo('create') ? (
            <Button size="md" onClick={openAdd}>
              <Plus size={17} /> إضافة سجل جديد
            </Button>
          ) : null}
        </div>
      </div>

      <div className="scrollbar-thin -mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {tables.map((table) => {
          const Icon = table.icon;
          const isActive = table.key === activeKey;
          const isLocked = !can(`data.${table.key}.view`);
          return (
            <button
              key={table.key}
              onClick={() => setActiveKey(table.key)}
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12px] font-bold transition',
                isActive
                  ? 'border-ink bg-ink text-white shadow-md'
                  : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-ink',
              )}
            >
              <Icon size={15} />
              {table.label}
              {isLocked ? <Lock size={12} className="opacity-60" /> : null}
            </button>
          );
        })}
      </div>

      {locked ? (
        <Card className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
            <Lock size={24} />
          </span>
          <h2 className="text-base font-extrabold">غير مصرّح بعرض «{active.label}»</h2>
          <p className="max-w-md text-[13px] font-medium text-slate-500">
            دورك الحالي لا يملك صلاحية عرض هذا الجدول. اطلب من مدير النظام منحك صلاحية
            «عرض» من شاشة الأدوار والصلاحيات، أو انتقل إلى جدول آخر من التبويبات أعلاه.
          </p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={`بحث في ${active.label}...`}
              className="lg:w-80"
            />
            {filterField && filterOptions.length > 0 ? (
              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                className="field lg:w-56"
                aria-label={`تصفية حسب ${filterField.label}`}
              >
                <option value="">كل {filterField.label}</option>
                {filterOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            ) : null}
            <div className="flex flex-wrap items-center gap-2 lg:mr-auto">
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400">
                <Search size={13} /> {displayRows.length} نتيجة
              </span>
              {canDo('export') ? (
                <Button variant="ghost" size="sm" onClick={handleTemplate}>
                  <FileSpreadsheet size={14} /> نموذج فارغ
                </Button>
              ) : null}
              {canDo('export') ? (
                <Button variant="ghost" size="sm" onClick={() => handleExport('csv')}>
                  <FileUp size={14} /> CSV
                </Button>
              ) : null}
            </div>
          </div>

          {importSummary ? (
            <div className="flex items-center justify-between gap-3 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2 text-[11px] font-semibold text-emerald-700">
              <span>{importSummary}</span>
              <button
                className="text-emerald-600 underline"
                onClick={() => setImportSummary(null)}
              >
                إخفاء
              </button>
            </div>
          ) : null}

          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[980px] text-right text-[12px]">
              <thead>
                <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                  <th className="whitespace-nowrap px-4 py-3">#</th>
                  {visibleFields.map((field) => (
                    <th key={field.key} className="whitespace-nowrap px-4 py-3">
                      <button
                        className="inline-flex items-center gap-1 hover:text-ink"
                        onClick={() =>
                          setSort((prev) =>
                            prev.key === field.key
                              ? { key: field.key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
                              : { key: field.key, dir: 'asc' },
                          )
                        }
                      >
                        {field.label}
                        <ArrowDownUp
                          size={12}
                          className={sort.key === field.key ? 'text-brand' : 'text-slate-300'}
                        />
                      </button>
                    </th>
                  ))}
                  
                  <th className="whitespace-nowrap px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row, index) => (
                  <tr
                    key={String(row.id)}
                    className="border-t border-slate-100 transition hover:bg-brand-soft/40"
                  >
                    <td className="px-4 py-3 text-[11px] font-bold text-slate-300 num">
                      {index + 1}
                    </td>
                    {visibleFields.map((field) => (
                      <td key={field.key} className="whitespace-nowrap px-4 py-3">
                        {renderCell(row, field)}
                      </td>
                    ))}
                    <td className="whitespace-nowrap px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canDo('edit') ? (
                          <IconButton
                            label="تعديل السجل"
                            onClick={() => openEdit(row)}
                            className="h-8 w-8 hover:bg-brand-soft hover:text-brand"
                          >
                            <Pencil size={14} />
                          </IconButton>
                        ) : null}
                        {canDo('delete') ? (
                          <IconButton
                            label="حذف السجل"
                            onClick={() => setDeleteTarget(row)}
                            className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        ) : null}
                        {!canDo('edit') && !canDo('delete') ? (
                          <span className="text-[10px] font-semibold text-slate-300">للعرض فقط</span>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayRows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Search size={28} />}
                  title="لا توجد سجلات مطابقة"
                  description="جرّب تعديل كلمة البحث أو التصفية، أو أضف سجلًا جديدًا لهذا الجدول."
                  action={
                    canDo('create') ? (
                      <Button size="sm" onClick={openAdd} className="mt-2">
                        <Plus size={14} /> إضافة سجل
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-mist/50 px-4 py-3 text-[11px] font-semibold text-slate-500">
            <span>
              عرض {displayRows.length} من {rows.length} سجل — جميع التغييرات تُزامن تلقائيًا
              مع Supabase.
            </span>
            <span className="flex items-center gap-1">
              <ArrowDownUp size={12} /> مرتب حسب: {active.fields.find((f) => f.key === sort.key)?.label}
            </span>
          </div>
        </Card>
      )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? `تعديل سجل — ${active.label}` : `إضافة سجل جديد — ${active.label}`}
        subtitle="جميع الحقول الرقمية تُقبل الكسور، والكود يجب أن يكون فريدًا."
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={save}>
              <Plus size={16} /> {editing ? 'حفظ التعديلات' : 'إضافة السجل'}
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {active.fields.map((field) => {
            const selectedCodes = field.type === 'codes' ? parseCodes(form[field.key]) : [];
            const toggleCode = (code: string) => {
              const next = selectedCodes.includes(code)
                ? selectedCodes.filter((value) => value !== code)
                : [...selectedCodes, code];
              setForm((prev) => ({ ...prev, [field.key]: next.join(', ') }));
            };
            return (
              <div
                key={field.key}
                className={cn('block', field.wide && 'sm:col-span-2')}
              >
                <span className="label">
                  {field.label}
                  {field.required ? <span className="text-brand"> *</span> : null}
                </span>
                {field.type === 'codes' && field.options?.length ? (
                  <div className="flex flex-wrap gap-1.5">
                    {db.products.map((product) => {
                      const active = selectedCodes.includes(product.code);
                      return (
                        <button
                          key={product.code}
                          type="button"
                          onClick={() => toggleCode(product.code)}
                          className={cn('chip', active ? 'chip-active' : 'chip-muted')}
                        >
                          <span className="num">{product.code}</span>
                          <span className="max-w-[130px] truncate text-[10px] opacity-80">
                            {product.name}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : field.type === 'select' ? (
                  <select
                    className="field"
                    value={form[field.key] ?? ''}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                  >
                    <option value="">— اختر —</option>
                    {field.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className={cn('field', field.type === 'number' && 'num')}
                    type={field.type === 'number' ? 'number' : 'text'}
                    step={field.step}
                    inputMode={field.type === 'number' ? 'decimal' : undefined}
                    value={form[field.key] ?? ''}
                    placeholder={field.placeholder}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                    }
                  />
                )}
                {field.type === 'codes' ? (
                  <span className="mt-1 block text-[10px] font-medium text-slate-400">
                    {field.options?.length
                      ? 'اختر المنتجات من القائمة بدل كتابة الأكواد.'
                      : 'أكواد المنتجات مفصولة بفاصلة، مثال: 01020020, 01020024'}
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="تأكيد حذف السجل"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Trash2 size={16} /> حذف نهائي
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-[13px] font-medium text-slate-600">
          <p>
            سيتم حذف السجل{' '}
            <span className="num rounded bg-slate-100 px-1.5 py-0.5 font-bold text-ink">
              {String(deleteTarget?.[active.primaryKey] ?? '')}
            </span>{' '}
            من جدول {active.label}.
          </p>
          {active.key === 'products' ? (
            <p className="text-[12px] text-rose-600">
              سيتم أيضًا حذف عناصر التكلفة المرتبطة بهذا المنتج.
            </p>
          ) : null}
          <p className="text-[11px] text-slate-400">لا يمكن التراجع عن هذه العملية.</p>
        </div>
      </Modal>
    </div>
  );
}

export type { TableDef };
