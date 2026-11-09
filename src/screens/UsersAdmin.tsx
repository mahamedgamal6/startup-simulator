import { useMemo, useState } from 'react';
import {
  KeyRound,
  Pencil,
  Search,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserCog,
  UserPlus,
  Users,
  UserX,
} from 'lucide-react';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  IconButton,
  Modal,
  SearchInput,
  Stat,
  useToast,
} from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { permissionCount } from '../auth/permissions';
import type { AppUser } from '../types';

const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('ar-EG-u-nu-latn', {
        dateStyle: 'medium',
        timeStyle: 'short',
      }).format(new Date(value))
    : 'لم يدخل بعد';

interface UserForm {
  name: string;
  username: string;
  password: string;
  roleId: string;
  active: boolean;
}

export function UsersAdminScreen() {
  const {
    users,
    roles,
    currentUser,
    can,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
  } = useAuth();
  const toast = useToast();

  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [form, setForm] = useState<UserForm>({
    name: '',
    username: '',
    password: '',
    roleId: roles[0]?.id ?? '',
    active: true,
  });
  const [resetTarget, setResetTarget] = useState<AppUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);

  const canCreate = can('users.create');
  const canEdit = can('users.edit');
  const canDelete = can('users.delete');
  const canReset = can('users.reset_password');

  const roleName = (roleId: string) =>
    roles.find((role) => role.id === roleId)?.name ?? 'دور محذوف';

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.name, user.username, roleName(user.roleId)].join(' ').toLowerCase().includes(term),
    );
  }, [users, roles, query]);

  const openAdd = () => {
    setEditing(null);
    setForm({
      name: '',
      username: '',
      password: '',
      roleId: roles[0]?.id ?? '',
      active: true,
    });
    setModalOpen(true);
  };

  const openEdit = (user: AppUser) => {
    setEditing(user);
    setForm({
      name: user.name,
      username: user.username,
      password: '',
      roleId: user.roleId,
      active: user.active,
    });
    setModalOpen(true);
  };

  const save = async () => {
    try {
      if (editing) {
        await updateUser(editing.id, {
          name: form.name,
          username: form.username,
          roleId: form.roleId,
          active: form.active,
          password: form.password ? form.password : undefined,
        });
        toast('تم تحديث بيانات المستخدم');
      } else {
        await createUser({
          name: form.name,
          username: form.username,
          password: form.password,
          roleId: form.roleId,
          active: form.active,
        });
        toast('تمت إضافة المستخدم بنجاح');
      }
      setModalOpen(false);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حفظ المستخدم', 'error');
    }
  };

  const confirmReset = async () => {
    if (!resetTarget) return;
    try {
      await resetPassword(resetTarget.id, newPassword);
      toast('تم تعيين كلمة مرور جديدة');
      setResetTarget(null);
      setNewPassword('');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر تعيين كلمة المرور', 'error');
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteUser(deleteTarget.id);
      toast('تم حذف المستخدم');
      setDeleteTarget(null);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'تعذر حذف المستخدم', 'error');
    }
  };

  const activeCount = users.filter((user) => user.active).length;
  const adminCount = users.filter((user) => {
    const role = roles.find((item) => item.id === user.roleId);
    return role?.system;
  }).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Access Control</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">المستخدمون والوصول</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            إنشاء الحسابات وربطها بالأدوار وإعادة تعيين كلمات المرور وإيقاف الوصول — بصلاحيات
            منفصلة لكل عملية.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="slate">
            <ShieldCheck size={12} /> {roles.length} أدوار متاحة
          </Badge>
          {canCreate ? (
            <Button onClick={openAdd}>
              <UserPlus size={16} /> إضافة مستخدم
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="إجمالي المستخدمين" value={users.length} icon={<Users size={18} />} />
        <Stat
          label="حسابات نشطة"
          value={activeCount}
          hint={`${users.length - activeCount} موقوف`}
          tone="crown"
          icon={<UserCheck size={18} />}
        />
        <Stat label="مديرو النظام" value={adminCount} tone="prime" icon={<UserCog size={18} />} />
        <Stat
          label="الأدوار المتاحة"
          value={roles.length}
          hint={`${permissionCount(['*'])} صلاحية قصوى`}
          tone="elora"
          icon={<ShieldCheck size={18} />}
        />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center">
          <SearchInput value={query} onChange={setQuery} placeholder="بحث بالاسم أو اسم الدخول أو الدور..." className="sm:w-80" />
          <span className="text-[11px] font-bold text-slate-400 sm:mr-auto">
            {filtered.length} من {users.length} حساب
          </span>
        </div>

        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[900px] text-right text-[12px]">
            <thead>
              <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">اسم الدخول</th>
                <th className="px-4 py-3">الدور</th>
                <th className="px-4 py-3">الصلاحيات</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">آخر دخول</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => {
                const role = roles.find((item) => item.id === user.roleId);
                const isSelf = user.id === currentUser?.id;
                return (
                  <tr key={user.id} className="border-t border-slate-100 hover:bg-mist/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-ink text-[10px] font-black text-white">
                          {user.name.replace(/^(م\.|أ\.|د\.)\s*/, '').slice(0, 2)}
                        </span>
                        <div>
                          <p className="text-[12px] font-extrabold text-ink">{user.name}</p>
                          {isSelf ? (
                            <span className="text-[9px] font-bold text-brand">حسابك الحالي</span>
                          ) : (
                            <span className="text-[9px] font-medium text-slate-400">
                              أُنشئ {formatDate(user.createdAt)}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="num rounded-md bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                        @{user.username}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={role?.system ? 'brand' : 'blue'}>{roleName(user.roleId)}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <span className="num text-[11px] font-bold text-slate-500">
                        {permissionCount(role?.permissions)} صلاحية
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={user.active ? 'green' : 'rose'}>
                        {user.active ? (
                          <>
                            <UserCheck size={11} /> نشط
                          </>
                        ) : (
                          <>
                            <UserX size={11} /> موقوف
                          </>
                        )}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-[10px] font-semibold text-slate-500">
                      {formatDate(user.lastLoginAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {canEdit ? (
                          <IconButton
                            label="تعديل المستخدم"
                            className="h-8 w-8 hover:bg-brand-soft hover:text-brand"
                            onClick={() => openEdit(user)}
                          >
                            <Pencil size={14} />
                          </IconButton>
                        ) : null}
                        {canReset ? (
                          <IconButton
                            label="إعادة تعيين كلمة المرور"
                            className="h-8 w-8 hover:bg-sky-50 hover:text-sky-600"
                            onClick={() => {
                              setResetTarget(user);
                              setNewPassword('');
                            }}
                          >
                            <KeyRound size={14} />
                          </IconButton>
                        ) : null}
                        {canDelete && !isSelf ? (
                          <IconButton
                            label="حذف المستخدم"
                            className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setDeleteTarget(user)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <div className="p-6">
              <EmptyState
                icon={<Search size={26} />}
                title="لا توجد حسابات مطابقة"
                description="جرّب تعديل كلمة البحث أو أضف مستخدمًا جديدًا."
                action={
                  canCreate ? (
                    <Button size="sm" onClick={openAdd} className="mt-2">
                      <UserPlus size={14} /> إضافة مستخدم
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : null}
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'تعديل بيانات المستخدم' : 'إضافة مستخدم جديد'}
        subtitle="يُمنح المستخدم صلاحيات الدور المحدد فور حفظ البيانات."
        footer={
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={save}>
              <UserPlus size={16} /> {editing ? 'حفظ التعديلات' : 'إنشاء الحساب'}
            </Button>
          </>
        }
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block sm:col-span-2">
            <span className="label">الاسم الكامل</span>
            <input
              className="field"
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              placeholder="م. كريم عبد الله"
            />
          </label>
          <label className="block">
            <span className="label">اسم الدخول</span>
            <input
              className="field num"
              dir="ltr"
              value={form.username}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="karim"
            />
          </label>
          <label className="block">
            <span className="label">
              {editing ? 'كلمة مرور جديدة (اختياري)' : 'كلمة المرور'}
            </span>
            <input
              className="field"
              dir="ltr"
              type="password"
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder={editing ? 'اتركها فارغة للإبقاء' : '6 أحرف على الأقل'}
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">الدور والصلاحيات</span>
            <select
              className="field"
              value={form.roleId}
              onChange={(event) => setForm({ ...form, roleId: event.target.value })}
            >
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name} — {permissionCount(role.permissions)} صلاحية
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 sm:col-span-2">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(event) => setForm({ ...form, active: event.target.checked })}
              className="h-4 w-4 accent-brand"
            />
            <span className="text-[12px] font-bold text-ink">الحساب نشط ويمكنه الدخول</span>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        onClose={() => setResetTarget(null)}
        title="إعادة تعيين كلمة المرور"
        subtitle={resetTarget ? `${resetTarget.name} (@${resetTarget.username})` : ''}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetTarget(null)}>
              إلغاء
            </Button>
            <Button onClick={confirmReset}>
              <KeyRound size={15} /> تعيين
            </Button>
          </>
        }
      >
        <label className="block">
          <span className="label">كلمة المرور الجديدة</span>
          <input
            className="field"
            dir="ltr"
            type="password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            placeholder="6 أحرف على الأقل"
          />
        </label>
        <p className="mt-2 text-[10px] font-medium text-slate-400">
          سيُطلب من المستخدم استخدام كلمة المرور الجديدة في الدخول التالي.
        </p>
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="تأكيد حذف المستخدم"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={confirmDelete}>
              <Trash2 size={15} /> حذف الحساب
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium leading-relaxed text-slate-600">
          سيتم حذف حساب <strong>{deleteTarget?.name}</strong> (@{deleteTarget?.username}) نهائيًا.
          لن يتأثر سجل العمليات السابق.
        </p>
      </Modal>
    </div>
  );
}
