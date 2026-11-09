import { useEffect, useState } from 'react';
import { Boxes, Clock3, Coins, PackagePlus, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import type { Machinery, SparePart } from '../types';
import { makeId, useData } from '../lib/db';
import { fmt, money } from '../lib/format';
import { Badge, Button, IconButton, Modal, useToast } from './ui';

const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const emptyForm = () => ({
  code: '',
  name: '',
  unitCost: '0',
  stockQty: '0',
  replacementIntervalHours: '0',
  notes: '',
});

function SparePartForm({
  initial,
  machineId,
  onCancel,
  onSaved,
}: {
  initial: SparePart | null;
  machineId: string;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const { upsertSparePart } = useData();
  const toast = useToast();
  const [form, setForm] = useState(() =>
    initial
      ? {
          code: initial.code,
          name: initial.name,
          unitCost: String(initial.unitCost),
          stockQty: String(initial.stockQty),
          replacementIntervalHours: String(initial.replacementIntervalHours),
          notes: initial.notes,
        }
      : emptyForm(),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('كود القطعة واسمها مطلوبان.');
      return;
    }
    setBusy(true);
    const saved = await upsertSparePart({
      id: initial?.id ?? makeId('part'),
      machineId,
      code: form.code.trim(),
      name: form.name.trim(),
      unitCost: Math.max(0, toNumber(form.unitCost)),
      stockQty: Math.max(0, toNumber(form.stockQty)),
      replacementIntervalHours: Math.max(0, toNumber(form.replacementIntervalHours)),
      notes: form.notes.trim(),
    });
    setBusy(false);
    if (!saved) return;
    toast(initial ? 'تم تحديث قطعة الغيار' : 'تمت إضافة قطعة الغيار');
    onSaved();
  };

  return (
    <div className="mb-4 rounded-2xl border border-brand/15 bg-brand-soft/30 p-3.5">
      <p className="text-[12px] font-extrabold text-ink">
        {initial ? 'تعديل قطعة الغيار' : 'قطعة غيار جديدة'}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">كود القطعة</span>
          <input
            className="field num"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            placeholder="SP-001"
          />
        </label>
        <label className="block">
          <span className="label">اسم القطعة</span>
          <input
            className="field"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="سير، فلتر، بلي، سكين..."
          />
        </label>
        <label className="block">
          <span className="label">تكلفة الوحدة (ج.م)</span>
          <input
            className="field num"
            type="number"
            min={0}
            step={0.01}
            value={form.unitCost}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, unitCost: event.target.value }))
            }
          />
        </label>
        <label className="block">
          <span className="label">المخزون الحالي</span>
          <input
            className="field num"
            type="number"
            min={0}
            step={1}
            value={form.stockQty}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, stockQty: event.target.value }))
            }
          />
        </label>
        <label className="block">
          <span className="label">فترة الاستبدال (ساعة تشغيل)</span>
          <input
            className="field num"
            type="number"
            min={0}
            step={1}
            value={form.replacementIntervalHours}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                replacementIntervalHours: event.target.value,
              }))
            }
          />
        </label>
        <label className="block">
          <span className="label">ملاحظات</span>
          <input
            className="field"
            value={form.notes}
            onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
            placeholder="المورد أو رقم القطعة الأصلي"
          />
        </label>
      </div>
      {error ? (
        <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-bold text-rose-600">
          {error}
        </p>
      ) : null}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel}>
          إلغاء
        </Button>
        <Button size="sm" onClick={() => void submit()} disabled={busy}>
          <Save size={14} /> {initial ? 'حفظ التعديل' : 'إضافة القطعة'}
        </Button>
      </div>
    </div>
  );
}

export function SparePartsModal({
  machine,
  open,
  onClose,
  canEdit,
}: {
  machine: Machinery | null;
  open: boolean;
  onClose: () => void;
  canEdit: boolean;
}) {
  const { db, removeSparePart } = useData();
  const toast = useToast();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<SparePart | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SparePart | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setShowForm(false);
    setEditing(null);
    setDeleteTarget(null);
  }, [open, machine?.id]);

  const parts = machine
    ? db.spareParts.filter((part) => part.machineId === machine.id)
    : [];
  const stockValue = parts.reduce(
    (sum, part) => sum + part.unitCost * part.stockQty,
    0,
  );
  const lowStock = parts.filter((part) => part.stockQty <= 2).length;

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    const removed = await removeSparePart(deleteTarget.id);
    setBusy(false);
    if (!removed) return;
    toast('تم حذف قطعة الغيار');
    setDeleteTarget(null);
  };

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={machine ? `قطع غيار ماكينة ${machine.code}` : 'قطع الغيار'}
        subtitle={machine?.name}
        size="lg"
        footer={
          <Button variant="ghost" onClick={onClose}>
            إغلاق
          </Button>
        }
      >
        <div className="mb-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl border border-slate-100 bg-mist/60 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <Boxes size={11} /> الأصناف
            </p>
            <p className="num mt-1 text-lg font-black text-ink">{fmt(parts.length)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-mist/60 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <Coins size={11} /> قيمة المخزون
            </p>
            <p className="num mt-1 text-lg font-black text-ink">{money(stockValue)}</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-mist/60 px-3 py-2">
            <p className="flex items-center gap-1 text-[10px] font-bold text-slate-400">
              <Clock3 size={11} /> مخزون منخفض
            </p>
            <p className="num mt-1 text-lg font-black text-ink">{fmt(lowStock)}</p>
          </div>
        </div>

        {canEdit ? (
          <div className="mb-3 flex justify-end">
            {!showForm ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
              >
                <Plus size={14} /> إضافة قطعة غيار
              </Button>
            ) : null}
          </div>
        ) : null}

        {showForm && machine ? (
          <SparePartForm
            initial={editing}
            machineId={machine.id}
            onCancel={() => {
              setShowForm(false);
              setEditing(null);
            }}
            onSaved={() => {
              setShowForm(false);
              setEditing(null);
            }}
          />
        ) : null}

        {parts.length ? (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[680px] text-right text-[12px]">
              <thead>
                <tr className="bg-mist/80 text-[10px] font-bold text-slate-500">
                  <th className="px-3 py-2.5">القطعة</th>
                  <th className="px-3 py-2.5">التكلفة</th>
                  <th className="px-3 py-2.5">المخزون</th>
                  <th className="px-3 py-2.5">فترة الاستبدال</th>
                  <th className="px-3 py-2.5">ملاحظات</th>
                  <th className="px-3 py-2.5">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((part) => (
                  <tr key={part.id} className="border-t border-slate-100">
                    <td className="px-3 py-2.5">
                      <p className="font-bold text-ink">{part.name}</p>
                      <p className="num text-[10px] font-semibold text-slate-400">
                        {part.code}
                      </p>
                    </td>
                    <td className="num px-3 py-2.5 font-bold">{money(part.unitCost)} ج.م</td>
                    <td className="px-3 py-2.5">
                      <Badge tone={part.stockQty <= 2 ? 'amber' : 'green'}>
                        {fmt(part.stockQty)}
                      </Badge>
                    </td>
                    <td className="num px-3 py-2.5 font-semibold text-slate-500">
                      {part.replacementIntervalHours
                        ? `${fmt(part.replacementIntervalHours)} ساعة`
                        : '—'}
                    </td>
                    <td className="max-w-[180px] truncate px-3 py-2.5 text-[11px] text-slate-500">
                      {part.notes || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      {canEdit ? (
                        <div className="flex items-center gap-1">
                          <IconButton
                            label="تعديل قطعة الغيار"
                            className="h-8 w-8 hover:bg-brand-soft hover:text-brand"
                            onClick={() => {
                              setEditing(part);
                              setShowForm(true);
                            }}
                          >
                            <Pencil size={14} />
                          </IconButton>
                          <IconButton
                            label="حذف قطعة الغيار"
                            className="h-8 w-8 hover:bg-rose-50 hover:text-rose-600"
                            onClick={() => setDeleteTarget(part)}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-300">للعرض فقط</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-mist/50 px-4 py-8 text-center">
            <PackagePlus size={22} className="mx-auto text-slate-300" />
            <p className="mt-2 text-[12px] font-bold text-slate-500">
              لا توجد قطع غيار مسجلة لهذه الماكينة
            </p>
            <p className="mt-1 text-[11px] text-slate-400">
              أضف الأصناف الاستهلاكية مع التكلفة والمخزون وفترة الاستبدال لمتابعة الصيانة.
            </p>
          </div>
        )}
      </Modal>

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="حذف قطعة الغيار"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
              <Trash2 size={16} /> حذف نهائي
            </Button>
          </>
        }
      >
        <p className="text-[13px] font-medium text-slate-600">
          سيتم حذف{' '}
          <span className="font-extrabold text-ink">{deleteTarget?.name}</span> من قطع غيار
          هذه الماكينة. لا يمكن التراجع عن العملية.
        </p>
      </Modal>
    </>
  );
}
