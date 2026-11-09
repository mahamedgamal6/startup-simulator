import { useEffect, useState, type ReactNode } from 'react';
import { Image as ImageIcon, Plus, Save } from 'lucide-react';
import { Button, Modal, cn } from './ui';
import { EntityImage } from './EntityImage';
import { makeId } from '../lib/db';
import type { Accessory, Product, ProductFamily } from '../types';

const FAMILIES: ProductFamily[] = [
  'باور',
  'باور بلس',
  'برايم استانلس',
  'كراون تيتانيوم',
  'إيلورا جرانيت',
  'صينية فرن',
];

const toNumber = (value: string): number => {
  const parsed = Number.parseFloat(value.replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

function FormField({
  label,
  required,
  wide,
  children,
}: {
  label: string;
  required?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn('block', wide && 'sm:col-span-2')}>
      <span className="label">
        {label}
        {required ? <span className="text-brand"> *</span> : null}
      </span>
      {children}
    </div>
  );
}

const PRODUCT_FIELDS: Array<{
  key: keyof Omit<Product, 'id' | 'stageMachines' | 'stageOverrides'>;
  label: string;
  type?: 'text' | 'number' | 'select';
  step?: number;
  wide?: boolean;
  required?: boolean;
}> = [
  { key: 'code', label: 'كود المنتج', required: true },
  { key: 'name', label: 'اسم المنتج', wide: true, required: true },
  { key: 'family', label: 'عائلة المنتج', type: 'select' },
  { key: 'sizeCm', label: 'المقاس (سم)', type: 'number', step: 0.5, required: true },
  { key: 'heightCm', label: 'الارتفاع (سم)', type: 'number', step: 0.1 },
  { key: 'capacityL', label: 'السعة (لتر)', type: 'number', step: 0.1 },
  { key: 'netWeightKg', label: 'الوزن الصافي (كجم)', type: 'number', step: 0.001 },
  { key: 'grossWeightKg', label: 'الوزن بعد التعبئة (كجم)', type: 'number', step: 0.001 },
  { key: 'cbm', label: 'حجم الكرتونة CBM', type: 'number', step: 0.001 },
  { key: 'pcsPerCarton', label: 'عدد القطع بالكرتونة', type: 'number', step: 1 },
  { key: 'barcode', label: 'الباركود الدولي', wide: true },
];

const emptyProduct = (): Record<string, string> => ({
  code: '',
  name: '',
  family: 'باور',
  sizeCm: '20',
  heightCm: '8',
  capacityL: '1',
  netWeightKg: '0.4',
  grossWeightKg: '0.6',
  cbm: '0.04',
  pcsPerCarton: '8',
  barcode: '',
});

export function ProductFormModal({
  open,
  product,
  products,
  onClose,
  onSave,
}: {
  open: boolean;
  product: Product | null;
  products: Product[];
  onClose: () => void;
  onSave: (product: Product) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(emptyProduct);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      product
        ? {
            code: product.code,
            name: product.name,
            family: product.family,
            sizeCm: String(product.sizeCm),
            heightCm: String(product.heightCm),
            capacityL: String(product.capacityL),
            netWeightKg: String(product.netWeightKg),
            grossWeightKg: String(product.grossWeightKg),
            cbm: String(product.cbm),
            pcsPerCarton: String(product.pcsPerCarton),
            barcode: product.barcode,
          }
        : emptyProduct(),
    );
  }, [open, product]);

  const submit = () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('كود المنتج واسم المنتج مطلوبان.');
      return;
    }
    if (products.some((item) => item.code === form.code.trim() && item.id !== product?.id)) {
      setError('كود المنتج مستخدم بالفعل. اختر كودًا آخر.');
      return;
    }
    const next: Product = {
      id: product?.id ?? makeId('prd'),
      code: form.code.trim(),
      name: form.name.trim(),
      family: form.family as ProductFamily,
      sizeCm: toNumber(form.sizeCm),
      heightCm: toNumber(form.heightCm),
      capacityL: toNumber(form.capacityL),
      netWeightKg: toNumber(form.netWeightKg),
      grossWeightKg: toNumber(form.grossWeightKg),
      cbm: toNumber(form.cbm),
      pcsPerCarton: toNumber(form.pcsPerCarton),
      barcode: form.barcode.trim(),
      stageMachines: product?.stageMachines ?? {},
      stageOverrides: product?.stageOverrides ?? {},
    };
    onSave(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={product ? 'تعديل بطاقة المنتج' : 'إضافة منتج جديد'}
      subtitle="كل الحقول قابلة للتعديل لاحقًا من بطاقة المنتج أو مركز البيانات."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit}>
            {product ? <Save size={16} /> : <Plus size={16} />}
            {product ? 'حفظ التعديلات' : 'إضافة المنتج'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {PRODUCT_FIELDS.map((field) => (
          <FormField
            key={field.key}
            label={field.label}
            required={field.required}
            wide={field.wide}
          >
            {field.type === 'select' ? (
              <select
                className="field"
                value={form[field.key] ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              >
                {FAMILIES.map((family) => (
                  <option key={family} value={family}>
                    {family}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={cn('field', field.type === 'number' && 'num')}
                type={field.type === 'number' ? 'number' : 'text'}
                step={field.step}
                value={form[field.key] ?? ''}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
                }
              />
            )}
          </FormField>
        ))}
      </div>
      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}

const emptyAccessory = (productCode: string): Record<string, string> => ({
  code: '',
  name: '',
  material: '',
  qtyPerProduct: '1',
  unitCost: '0',
  origin: 'تصنيع محلي',
  productCode,
});

export function AccessoryFormModal({
  open,
  accessory,
  productCode,
  products,
  onClose,
  onSave,
}: {
  open: boolean;
  accessory: Accessory | null;
  productCode: string;
  products: Product[];
  onClose: () => void;
  onSave: (accessory: Accessory) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>(() => emptyAccessory(productCode));
  const [linked, setLinked] = useState<string[]>([productCode]);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setForm(
      accessory
        ? {
            code: accessory.code,
            name: accessory.name,
            material: accessory.material,
            qtyPerProduct: String(accessory.qtyPerProduct),
            unitCost: String(accessory.unitCost),
            origin: accessory.origin,
            productCode,
          }
        : emptyAccessory(productCode),
    );
    setLinked(
      accessory
        ? Array.from(new Set([...accessory.productCodes, productCode]))
        : [productCode],
    );
  }, [open, accessory, productCode]);

  const toggleProduct = (code: string) => {
    setLinked((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code],
    );
  };

  const submit = () => {
    if (!form.code.trim() || !form.name.trim()) {
      setError('كود الإكسسوار واسم الصنف مطلوبان.');
      return;
    }
    if (!linked.length) {
      setError('اختر منتجًا واحدًا على الأقل لربط الإكسسوار به.');
      return;
    }
    onSave({
      id: accessory?.id ?? makeId('acc'),
      code: form.code.trim(),
      name: form.name.trim(),
      material: form.material.trim(),
      qtyPerProduct: toNumber(form.qtyPerProduct),
      unitCost: toNumber(form.unitCost),
      origin: form.origin.trim(),
      productCodes: linked,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={accessory ? 'تعديل إكسسوار' : 'إضافة إكسسوار للمنتج'}
      subtitle="يُربط الإكسسوار بالمنتج المحدد، ويمكن ربطه بمنتجات أخرى بالاختيار من القائمة."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={submit}>
            {accessory ? <Save size={16} /> : <Plus size={16} />}
            {accessory ? 'حفظ التعديلات' : 'إضافة الإكسسوار'}
          </Button>
        </>
      }
    >
      {accessory ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-slate-100 bg-mist/50 p-3">
          <EntityImage
            ownerTable="accessories"
            ownerId={accessory.id}
            canEdit
            alt={accessory.name}
            className="h-24 w-24 shrink-0 rounded-xl"
            fallback={<ImageIcon size={26} className="text-slate-400" />}
          />
          <div className="min-w-0">
            <p className="text-[12px] font-extrabold text-ink">صورة الإكسسوار</p>
            <p className="mt-0.5 text-[10px] font-semibold leading-relaxed text-slate-500">
              مرّر على الصورة لإظهار أزرار رفع/استبدال الصورة وحذفها. هذه الإجراءات تخص صورة
              الإكسسوار فقط.
            </p>
          </div>
        </div>
      ) : (
        <p className="mb-4 rounded-xl bg-mist/60 px-3 py-2 text-[11px] font-semibold text-slate-500">
          احفظ الإكسسوار أولًا، ثم افتحه للتعديل لإضافة صورته.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label="كود الإكسسوار" required>
          <input
            className="field"
            value={form.code}
            onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value }))}
            placeholder="ACC-07"
          />
        </FormField>
        <FormField label="اسم الصنف" required>
          <input
            className="field"
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </FormField>
        <FormField label="مادة الصنع">
          <input
            className="field"
            value={form.material}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, material: event.target.value }))
            }
          />
        </FormField>
        <FormField label="عدد القطع للمنتج">
          <input
            className="field num"
            type="number"
            step={1}
            value={form.qtyPerProduct}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, qtyPerProduct: event.target.value }))
            }
          />
        </FormField>
        <FormField label="تكلفة الوحدة (ج.م)">
          <input
            className="field num"
            type="number"
            step={0.01}
            value={form.unitCost}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, unitCost: event.target.value }))
            }
          />
        </FormField>
        <FormField label="المورد / بلد المنشأ">
          <input
            className="field"
            value={form.origin}
            onChange={(event) => setForm((prev) => ({ ...prev, origin: event.target.value }))}
          />
        </FormField>
        <FormField label="المنتجات المرتبطة" wide>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {products.map((item) => {
              const active = linked.includes(item.code);
              return (
                <button
                  key={item.code}
                  type="button"
                  onClick={() => toggleProduct(item.code)}
                  className={cn('chip', active ? 'chip-active' : 'chip-muted')}
                >
                  <span className="num">{item.code}</span>
                  <span className="max-w-[150px] truncate text-[10px] opacity-80">
                    {item.name}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-1 text-[10px] font-medium text-slate-400">
            اختر من القائمة بدل كتابة أكواد المنتجات.
          </p>
        </FormField>
      </div>
      {error ? (
        <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-[12px] font-bold text-rose-600">
          {error}
        </p>
      ) : null}
    </Modal>
  );
}
