import { useMemo, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileJson,
  Lock,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  UserCog,
  Users,
} from 'lucide-react';
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  PERMISSION_GROUPS,
  permissionCount,
} from '../auth/permissions';
import { useAuth } from '../auth/AuthContext';
import {
  Badge,
  Button,
  Card,
  IconButton,
  Modal,
  SearchInput,
  Stat,
  cn,
  useToast,
} from '../components/ui';
import type { AppRole } from '../types';

interface RoleForm {
  name: string;
  description: string;
}

interface ImportRow {
  role: AppRole;
  permissions: string[];
  added: number;
  removed: number;
  unchanged: boolean;
}

interface ImportPreview {
  fileName: string;
  rows: ImportRow[];
  skipped: string[];
}

const rolePermissions = (role: AppRole): string[] =>
  role.permissions.includes('*')
    ? [...ALL_PERMISSIONS]
    : role.permissions.filter((key) => ALL_PERMISSIONS.includes(key));

export function RolesAdminScreen() {
  const { roles, users, can, createRole, updateRole, deleteRole } = useAuth();
  const toast = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppRole | null>(null);
  const [form, setForm] = useState<RoleForm>({ name: '', description: '' });
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AppRole | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<AppRole | null>(null);
  const [duplicateName, setDuplicateName] = useState('');
  const [duplicateDescription, setDuplicateDescription] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importing, setImporting] = useState(false);
  const matrixFileRef = useRef<HTMLInputElement>(null);

  const canCreate = can('roles.create');
  const canEdit = can('roles.edit');
  const canDelete = can('roles.delete');

  const usersOf = (roleId: string) => users.filter((user) => user.roleId === roleId).length;

  const downloadPermissions = (list: AppRole[]) => {
    const payload = {
      kind: 'elzonki.permissions.matrix',
      version: 1,
      exportedAt: new Date().toISOString(),
      roles: list.map((role) => ({
        name: role.name,
        system: Boolean(role.system),
        permissions: rolePermissions(role),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `مصفوفة-الصلاحيات-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast(`تم تصدير صلاحيات ${list.length} دور`);
  };

  const openDuplicate = (role: AppRole) => {
    setDuplicateSource(role);
    setDuplicateName(`${role.name} — نسخة`);
    setDuplicateDescription(role.description);
  };

  const confirmDuplicate = async () => {
    if (!duplicateSource) return;
    if (!duplicateName.trim()) {
      toast('اسم الدور الجديد مطلوب', 'error');
      return;
    }
    try {
      await createRole({
        name: duplicateName.trim(),
        description: duplicateDescription.trim(),
        permissions: rolePermissions(duplicateSource),
      });
      toast(`تم إنشاء دور جديد بنسخة من صلاحيات «${duplicateSource.name}»`);
      setDuplicateSource(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر نسخ الدور', 'error');
    }
  };

  const copyPermissionsFrom = (roleId: string) => {
    setCopyFrom(roleId);
    const role = roles.find((item) => item.id === roleId);
    if (!role) return;
    setSelected(rolePermissions(role));
    toast(`تم نسخ ${permissionCount(role.permissions)} صلاحية من «${role.name}»`);
  };

  const handleMatrixFile = async (file: File) => {
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const source = Array.isArray(parsed)
        ? parsed
        : parsed && typeof parsed === 'object' && Array.isArray((parsed as { roles?: unknown }).roles)
          ? ((parsed as { roles: unknown[] }).roles)
          : null;
      if (!source || !source.length) {
        throw new Error('الملف لا يحتوي على مصفوفة أدوار صالحة');
      }

      const rows: ImportRow[] = [];
      const skipped: string[] = [];

      source.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        const data = entry as { name?: unknown; permissions?: unknown };
        const name = String(data.name ?? '').trim();
        const role = roles.find(
          (item) => item.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (!role) {
          skipped.push(name || 'دور بدون اسم');
          return;
        }
        if (role.system) {
          skipped.push(`${role.name} (دور نظامي محمي)`);
          return;
        }
        const permissions = Array.isArray(data.permissions)
          ? Array.from(
              new Set(
                data.permissions
                  .map((key) => String(key).trim())
                  .filter((key) => ALL_PERMISSIONS.includes(key)),
              ),
            )
          : [];
        const current = rolePermissions(role);
        const added = permissions.filter((key) => !current.includes(key)).length;
        const removed = current.filter((key) => !permissions.includes(key)).length;
        rows.push({
          role,
          permissions,
          added,
          removed,
          unchanged: added === 0 && removed === 0,
        });
      });

      setImportPreview({ fileName: file.name, rows, skipped });
    } catch (error) {
      toast(
        error instanceof Error ? error.message : 'تعذر قراءة ملف المصفوفة',
        'error',
      );
    } finally {
      if (matrixFileRef.current) matrixFileRef.current.value = '';
    }
  };

  const applyImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    let updated = 0;
    try {
      for (const row of importPreview.rows) {
        if (row.unchanged) continue;
        await updateRole(row.role.id, {
          name: row.role.name,
          description: row.role.description,
          permissions: row.permissions,
        });
        updated += 1;
      }
      toast(updated ? `تم تحديث صلاحيات ${updated} دور` : 'لا توجد تغييرات لتطبيقها');
      setImportPreview(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر تطبيق المصفوفة', 'error');
    } finally {
      setImporting(false);
    }
  };

  const filteredGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return PERMISSION_GROUPS;
    return PERMISSION_GROUPS.map((group) => {
      const groupMatch = group.label.toLowerCase().includes(term);
      return {
        ...group,
        permissions: groupMatch
          ? group.permissions
          : group.permissions.filter(
              (permission) =>
                permission.label.toLowerCase().includes(term) ||
                permission.key.toLowerCase().includes(term),
            ),
      };
    }).filter((group) => group.permissions.length > 0);
  }, [search]);

  const selectedCount = selected.length;

  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setSelected([]);
    setSearch('');
    setCopyFrom('');
    setModalOpen(true);
  };

  const openEdit = (role: AppRole) => {
    setEditing(role);
    setForm({ name: role.name, description: role.description });
    setSelected(
      role.permissions.includes('*') ? [...ALL_PERMISSIONS] : [...role.permissions],
    );
    setSearch('');
    setCopyFrom('');
    setModalOpen(true);
  };

  const togglePermission = (key: string) => {
    setSelected((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );
  };

  const toggleGroup = (keys: string[]) => {
    const allSelected = keys.every((key) => selected.includes(key));
    setSelected((prev) =>
      allSelected
        ? prev.filter((key) => !keys.includes(key))
        : Array.from(new Set([...prev, ...keys])),
    );
  };

  const save = async () => {
    try {
      if (editing) {
        await updateRole(editing.id, {
          name: form.name,
          description: form.description,
          permissions: selected,
        });
        toast('تم تحديث صلاحيات الدور');
      } else {
        await createRole({
          name: form.name,
          description: form.description,
          permissions: selected,
        });
        toast('تم إنشاء الدور الجديد');
      }
      setModalOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حفظ الدور', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteRole(deleteTarget.id);
      toast('تم حذف الدور');
      setDeleteTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حذف الدور', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Roles & Permissions</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">الأدوار والصلاحيات</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            أنشئ أدوارًا مخصصة وحدّد بدقة كل خدمة وكل عملية يراها أو ينفّذها صاحب الدور.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={matrixFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleMatrixFile(file);
            }}
          />
          <Button variant="outline" onClick={() => downloadPermissions(roles)}>
            <Download size={16} /> تصدير المصفوفة
          </Button>
          {canEdit ? (
            <Button variant="outline" onClick={() => matrixFileRef.current?.click()}>
              <Upload size={16} /> استيراد المصفوفة
            </Button>
          ) : null}
          {canCreate ? (
            <Button onClick={openAdd}>
              <Plus size={16} /> إنشاء دور جديد
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي الأدوار" value={roles.length} icon={<UserCog size={18} />} />
        <Stat
          label="الصلاحيات المتاحة"
          value={ALL_PERMISSIONS.length}
          hint={`${PERMISSION_GROUPS.length} خدمة تفصيلية`}
          tone="crown"
          icon={<ShieldCheck size={18} />}
        />
        <Stat
          label="أدوار مخصصة"
          value={roles.filter((role) => !role.system).length}
          tone="elora"
          icon={<Users size={18} />}
        />
        <Stat
          label="حسابات مرتبطة"
          value={users.length}
          hint="موزعة على الأدوار"
          tone="prime"
          icon={<Lock size={18} />}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roles.map((role) => (
          <Card key={role.id} className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-2">
              <span
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-xl',
                  role.system ? 'bg-brand-soft text-brand' : 'bg-slate-100 text-ink',
                )}
              >
                <ShieldCheck size={18} />
              </span>
              <div className="flex items-center gap-1.5">
                {role.system ? <Badge tone="brand">نظامي</Badge> : <Badge tone="slate">مخصص</Badge>}
                {canCreate ? (
                  <IconButton
                    label="نسخ الدور"
                    className="h-8 w-8 hover:bg-brand-soft hover:text-brand"
                    onClick={() => openDuplicate(role)}
                  >
                    <Copy size={14} />
                  </IconButton>
                ) : null}
                <IconButton
                  label="تصدير صلاحيات الدور"
                  className="h-8 w-8 hover:bg-slate-100"
                  onClick={() => downloadPermissions([role])}
                >
                  <Download size={14} />
                </IconButton>
                {canEdit && !role.system ? (
                  <IconButton
                    label="تعديل الدور"
                    className="h-8 w-8 hover:bg-brand-soft hover:text-brand"
                    onClick={() => openEdit(role)}
                  >
                    <Pencil size={14} />
                  </IconButton>
                ) : null}
                {canDelete && !role.system ? (
                  <IconButton
                    label="حذف الدور"
                    className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                    onClick={() => setDeleteTarget(role)}
                  >
                    <Trash2 size={14} />
                  </IconButton>
                ) : null}
              </div>
            </div>

            <h3 className="mt-3 text-[15px] font-extrabold text-ink">{role.name}</h3>
            <p className="mt-1 min-h-[34px] text-[11px] font-medium leading-relaxed text-slate-500">
              {role.description || 'بدون وصف'}
            </p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <Badge tone="blue">{permissionCount(role.permissions)} صلاحية</Badge>
              <Badge tone="slate">
                <Users size={11} /> {usersOf(role.id)} حساب
              </Badge>
              {role.system ? (
                <Badge tone="green">
                  <Check size={11} /> كل العمليات
                </Badge>
              ) : null}
            </div>

            <div className="mt-3 flex-1" />
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[10px] font-semibold text-slate-400">
                {role.system
                  ? 'دور محمي — لا يمكن تعديل صلاحياته'
                  : 'يُطبَّق فورًا على كل الحسابات المرتبطة'}
              </span>
              {!role.system && canEdit ? (
                <button
                  className="text-[10px] font-bold text-brand hover:underline"
                  onClick={() => openEdit(role)}
                >
                  إدارة الصلاحيات
                </button>
              ) : null}
            </div>
          </Card>
        ))}
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `صلاحيات دور «${editing.name}»` : 'إنشاء دور جديد'}
        subtitle="اختر الخدمات والعمليات المسموح بها. يمكن تحديد كل خدمة أو كل الصلاحيات دفعة واحدة."
        size="xl"
        footer={
          <>
            <div className="mr-auto flex items-center gap-2 text-[11px] font-bold text-slate-500">
              <span className="num rounded-md bg-brand-soft px-2 py-1 text-brand-dark">
                {selectedCount} / {ALL_PERMISSIONS.length}
              </span>
              صلاحية محددة
            </div>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={save}>
              <Check size={16} /> {editing ? 'حفظ الصلاحيات' : 'إنشاء الدور'}
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">اسم الدور</span>
            <input
              className="field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="مثال: مراقب مخزون"
            />
          </label>
          <label className="block">
            <span className="label">وصف مختصر</span>
            <input
              className="field"
              value={form.description}
              onChange={(event) => setForm({ ...form, description: event.target.value })}
              placeholder="ماذا يستطيع صاحب هذا الدور؟"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-col gap-2 rounded-xl border border-slate-200 bg-mist/60 p-3 sm:flex-row sm:items-center">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="ابحث عن خدمة أو عملية..."
            className="sm:w-72"
          />
          <select
            className="field sm:w-56"
            value={copyFrom}
            onChange={(event) => copyPermissionsFrom(event.target.value)}
            aria-label="نسخ الصلاحيات من دور"
          >
            <option value="">نسخ صلاحيات من دور…</option>
            {roles
              .filter((role) => role.id !== editing?.id)
              .map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} — {permissionCount(role.permissions)} صلاحية
                </option>
              ))}
          </select>
          <div className="flex items-center gap-1.5 sm:mr-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelected([...ALL_PERMISSIONS])}
            >
              تحديد الكل
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
              مسح الكل
            </Button>
          </div>
        </div>

        {PERMISSION_CATEGORIES.map((category) => {
          const groups = filteredGroups.filter((group) => group.category === category);
          if (!groups.length) return null;
          return (
            <div key={category} className="mt-4">
              <div className="mb-2 flex items-center gap-2">
                <p className="text-[11px] font-black text-ink">{category}</p>
                <span className="h-px flex-1 bg-slate-200" />
              </div>
              <div className="space-y-2">
                {groups.map((group) => {
                  const keys = group.permissions.map((permission) => permission.key);
                  const count = keys.filter((key) => selected.includes(key)).length;
                  const allSelected = count === keys.length && keys.length > 0;
                  return (
                    <div key={group.id} className="rounded-xl border border-slate-200 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <p className="text-[12px] font-extrabold text-ink">{group.label}</p>
                          <span className="num rounded bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                            {count} / {group.permissions.length}
                          </span>
                        </div>
                        <button
                          onClick={() => toggleGroup(keys)}
                          className={cn(
                            'rounded-md px-2 py-1 text-[10px] font-bold transition',
                            allSelected
                              ? 'bg-brand-soft text-brand'
                              : 'bg-slate-100 text-slate-500 hover:text-ink',
                          )}
                        >
                          {allSelected ? 'إلغاء تحديد الخدمة' : 'تحديد الخدمة كاملة'}
                        </button>
                      </div>
                      <div className="mt-2 grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {group.permissions.map((permission) => {
                          const checked = selected.includes(permission.key);
                          return (
                            <label
                              key={permission.key}
                              className={cn(
                                'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px] font-semibold transition',
                                checked
                                  ? 'border-brand/25 bg-brand-soft/60 text-brand-dark'
                                  : 'border-slate-100 bg-white text-slate-500 hover:border-slate-200',
                              )}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => togglePermission(permission.key)}
                                className="h-3.5 w-3.5 accent-brand"
                              />
                              <span className="flex-1">{permission.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {filteredGroups.length === 0 ? (
          <p className="mt-6 rounded-xl border border-dashed border-slate-200 py-6 text-center text-[11px] font-semibold text-slate-400">
            لا توجد صلاحيات مطابقة لبحثك.
          </p>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="تأكيد حذف الدور"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Trash2 size={15} /> حذف الدور
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-slate-600">
          سيتم حذف دور <strong>{deleteTarget?.name}</strong>. لا يمكن حذف دور مرتبط بحسابات
          مستخدمين، أو دور مدير النظام المحمي.
        </p>
      </Modal>

      <Modal
        open={Boolean(duplicateSource)}
        onClose={() => setDuplicateSource(null)}
        title={`نسخ دور «${duplicateSource?.name ?? ''}»`}
        subtitle="يُنشأ دور جديد مستقل بنفس الصلاحيات، ثم يمكن تعديله دون التأثير على الدور الأصلي."
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDuplicateSource(null)}>
              إلغاء
            </Button>
            <Button onClick={confirmDuplicate}>
              <Copy size={16} /> إنشاء نسخة
            </Button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="label">اسم الدور الجديد</span>
            <input
              className="field"
              value={duplicateName}
              onChange={(event) => setDuplicateName(event.target.value)}
              placeholder="مثال: مساعد المدير المالي"
            />
          </label>
          <label className="block">
            <span className="label">وصف مختصر</span>
            <input
              className="field"
              value={duplicateDescription}
              onChange={(event) => setDuplicateDescription(event.target.value)}
            />
          </label>
        </div>
        {duplicateSource ? (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-brand/15 bg-brand-soft/60 px-4 py-3">
            <span className="text-[12px] font-bold text-brand-dark">الصلاحيات المنسوخة</span>
            <span className="num text-lg font-black text-brand-dark">
              {permissionCount(duplicateSource.permissions)} صلاحية
            </span>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(importPreview)}
        onClose={() => setImportPreview(null)}
        title="معاينة استيراد مصفوفة الصلاحيات"
        subtitle={importPreview?.fileName}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportPreview(null)}>
              إلغاء
            </Button>
            <Button onClick={applyImport} disabled={importing}>
              <Check size={16} />
              {importing ? 'جارٍ التطبيق…' : 'تطبيق التغييرات'}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {importPreview?.rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[460px] text-right text-[12px]">
                <thead>
                  <tr className="bg-mist/80 text-[10px] font-bold text-slate-500">
                    <th className="px-3 py-2">الدور</th>
                    <th className="px-3 py-2">الصلاحيات بعد الاستيراد</th>
                    <th className="px-3 py-2">إضافة</th>
                    <th className="px-3 py-2">إزالة</th>
                  </tr>
                </thead>
                <tbody>
                  {importPreview.rows.map((row) => (
                    <tr key={row.role.id} className="border-t border-slate-100">
                      <td className="px-3 py-2.5 font-extrabold text-ink">{row.role.name}</td>
                      <td className="num px-3 py-2.5 font-bold">
                        {row.permissions.length}
                      </td>
                      <td className="num px-3 py-2.5 font-bold text-emerald-600">
                        +{row.added}
                      </td>
                      <td className="num px-3 py-2.5 font-bold text-rose-600">
                        −{row.removed}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-[12px] font-bold text-amber-700">
              لا توجد أدوار قابلة للتحديث في هذا الملف.
            </p>
          )}

          {importPreview?.skipped.length ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
              <p className="text-[11px] font-extrabold text-amber-800">
                تم تجاهل الأدوار التالية:
              </p>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-amber-700">
                {importPreview.skipped.join('، ')}
              </p>
            </div>
          ) : null}

          <p className="flex items-start gap-2 rounded-xl bg-mist/70 px-3 py-2.5 text-[11px] font-medium leading-relaxed text-slate-500">
            <FileJson size={14} className="mt-0.5 shrink-0" />
            لا تُعاد تسمية الأدوار أو حذفها عند الاستيراد، ويُطبَّق فقط ما تغيّر في مصفوفة
            الصلاحيات. الأدوار النظامية المحمية لا يمكن استيراد صلاحيات فوقها.
          </p>
        </div>
      </Modal>
    </div>
  );
}
