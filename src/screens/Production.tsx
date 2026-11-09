import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  Cog,
  Factory,
  Gauge,
  ShieldCheck,
  Timer,
  Users,
  Wrench,
} from 'lucide-react';
import { ProductPicker } from '../components/ProductPicker';
import { EntityImage } from '../components/EntityImage';
import { SparePartsModal } from '../components/SparePartsModal';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SectionHeading,
  Stat,
  cn,
} from '../components/ui';
import { useData } from '../lib/db';
import { fmt, fmt1, pct } from '../lib/format';
import { STAGE_GROUPS, buildJourney, cycleSeconds, formatCycle } from '../lib/journey';
import type { Machinery } from '../types';

export function ProductionScreen({
  productCode,
  onSelect,
  can,
  onManage,
}: {
  productCode: string;
  onSelect: (code: string) => void;
  can: (permission: string) => boolean;
  onManage: (table: 'machinery' | 'molds') => void;
}) {
  const { db } = useData();
  const [department, setDepartment] = useState('الكل');
  const [partsMachine, setPartsMachine] = useState<Machinery | null>(null);

  const product = db.products.find((item) => item.code === productCode) ?? db.products[0];
  const departments = useMemo(
    () => ['الكل', ...Array.from(new Set(db.machinery.map((item) => item.department)))],
    [db.machinery],
  );

  const machines = db.machinery.filter(
    (machine) => department === 'الكل' || machine.department === department,
  );

  const stages = product ? buildJourney(product, db.machinery, db.molds) : [];
  const cycle = cycleSeconds(stages);
  const maxSeconds = Math.max(...stages.map((stage) => stage.seconds), 1);
  const workersTotal = stages.reduce((sum, stage) => sum + stage.workers, 0);
  const avgFault =
    db.machinery.reduce((sum, machine) => sum + machine.faultRate, 0) /
    Math.max(db.machinery.length, 1);
  const working = db.machinery.filter((machine) => machine.status === 'يعمل بكفاءة').length;
  const attention = db.machinery.filter(
    (machine) => machine.serviceIntervalHours - machine.hoursSinceService <= 300,
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Badge tone="brand">Production Control</Badge>
          <h1 className="mt-2 text-xl font-black text-ink sm:text-2xl">إنتاجية الخطوط والماكينات</h1>
          <p className="mt-1 text-[13px] font-medium text-slate-500">
            متابعة الماكينات، الإسطمبات، قطع الغيار وأزمنة التشغيل والمسؤوليات الفنية لخطوط
            الإنتاج.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">
            <ShieldCheck size={12} /> صلاحية مدير الإنتاج
          </Badge>
          {can('data.machinery.view') ? (
            <Button variant="outline" size="sm" onClick={() => onManage('machinery')}>
              <Cog size={14} /> إدارة الماكينات
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="ماكينات عاملة"
          value={`${fmt(working)} / ${fmt(db.machinery.length)}`}
          hint="حالة التشغيل الحالية"
          icon={<Cog size={18} />}
        />
        <Stat
          label="متوسط معدل الأعطال"
          value={pct(avgFault)}
          hint="سنويًا على مستوى المصنع"
          tone="prime"
          icon={<AlertTriangle size={18} />}
        />
        <Stat
          label="زمن دورة القطعة"
          value={formatCycle(cycle)}
          hint={`${product?.name ?? ''} — ${product?.sizeCm ?? ''} سم`}
          tone="crown"
          icon={<Timer size={18} />}
        />
        <Stat
          label="محطات العمل"
          value={`${stages.length}`}
          hint={`${workersTotal} مهمة عمالة موزعة`}
          tone="elora"
          icon={<Users size={18} />}
        />
      </div>

      {attention.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-[12px] font-semibold text-amber-800">
          <Wrench size={16} />
          <span>تنبيهات صيانة:</span>
          {attention.map((machine) => (
            <span key={machine.id} className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">
              ماكينة {machine.code} — متبقي{' '}
              <span className="num">
                {Math.max(0, machine.serviceIntervalHours - machine.hoursSinceService)}
              </span>{' '}
              ساعة
            </span>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-12">
        <Card className="p-5 xl:col-span-8">
          <SectionHeading
            title="خطوط الإنتاج والماكينات"
            subtitle="اضغط قسمًا لتصفية الماكينات — حالة الصيانة محسوبة من ساعات التشغيل"
            icon={<Cog size={17} />}
            action={<Badge tone="slate">{machines.length} ماكينة</Badge>}
          />
          <div className="scrollbar-thin mt-3 flex gap-1.5 overflow-x-auto pb-1">
            {departments.map((item) => (
              <button
                key={item}
                onClick={() => setDepartment(item)}
                className={cn('chip shrink-0', department === item ? 'chip-active' : 'chip-muted')}
              >
                {item}
              </button>
            ))}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {machines.map((machine) => {
              const remaining = machine.serviceIntervalHours - machine.hoursSinceService;
              const servicePct = (machine.hoursSinceService / machine.serviceIntervalHours) * 100;
              const healthy = machine.status === 'يعمل بكفاءة';
              return (
                <div
                  key={machine.id}
                  className="rounded-2xl border border-slate-100 bg-gradient-to-l from-white to-mist/40 p-3.5 transition hover:border-slate-200 hover:shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <EntityImage
                      ownerTable="machinery"
                      ownerId={machine.id}
                      canEdit={can('data.machinery.edit')}
                      alt={machine.name}
                      className="h-11 w-11 shrink-0 rounded-xl"
                      fallback={<Factory size={16} className="text-brand" />}
                    />
                    <div className="flex items-center gap-1.5">
                      <span className="num rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                        {machine.code}
                      </span>
                      <Badge tone={healthy ? 'green' : 'amber'}>{machine.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2 text-[13px] font-extrabold leading-snug text-ink">
                    {machine.name}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">
                    {machine.capacity} · {machine.country}
                  </p>
                  <p className="mt-1 text-[10px] font-semibold text-slate-500">{machine.department}</p>

                  <div className="mt-3 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>معدل الأعطال السنوي</span>
                      <span className={machine.faultRate >= 2.5 ? 'text-rose-600' : 'text-ink'}>
                        {pct(machine.faultRate)}
                      </span>
                    </div>
                    <ProgressBar
                      value={machine.faultRate * 20}
                      color={machine.faultRate >= 2.5 ? '#ec1c24' : '#447a72'}
                      className="h-1.5"
                    />
                  </div>

                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between text-[10px] font-bold text-slate-500">
                      <span>استهلاك فترة الصيانة</span>
                      <span className={remaining <= 300 ? 'text-amber-600' : 'text-slate-500'}>
                        {remaining <= 0 ? 'متأخرة' : `متبقي ${fmt(remaining)} ساعة`}
                      </span>
                    </div>
                    <ProgressBar
                      value={servicePct}
                      color={remaining <= 300 ? '#f0a640' : '#4A90E2'}
                      className="h-1.5"
                    />
                  </div>

                  {can('data.machinery.view') ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="mt-2 w-full justify-between"
                      onClick={() => setPartsMachine(machine)}
                    >
                      <span className="flex items-center gap-1">
                        <Wrench size={13} /> قطع الغيار
                      </span>
                      <Badge tone="slate">
                        {db.spareParts.filter((part) => part.machineId === machine.id).length}
                      </Badge>
                    </Button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-4 xl:col-span-4">
          <Card className="p-5">
            <SectionHeading
              title="الإسطمبات وقوالب التشكيل"
              subtitle="الحالة الفنية وملاحظات الصيانة"
              icon={<Boxes size={17} />}
              action={
                can('data.molds.view') ? (
                  <Button variant="ghost" size="sm" onClick={() => onManage('molds')}>
                    إدارة الإسطمبات
                  </Button>
                ) : undefined
              }
            />
            <div className="mt-3 space-y-2">
              {db.molds.map((mold) => (
                <div key={mold.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <EntityImage
                        ownerTable="molds"
                        ownerId={mold.id}
                        canEdit={can('data.molds.edit')}
                        alt={mold.name}
                        className="h-10 w-10 shrink-0 rounded-lg"
                        fallback={<Boxes size={15} className="text-slate-400" />}
                      />
                      <div className="min-w-0">
                        <p className="text-[12px] font-extrabold text-ink">{mold.name}</p>
                        <p className="num mt-0.5 text-[10px] font-semibold text-slate-400">
                          {mold.code} · {fmt(mold.sizeCm)} سم
                        </p>
                      </div>
                    </div>
                    <Badge tone={mold.condition === 'حالة ممتازة' ? 'green' : 'amber'}>
                      {mold.condition}
                    </Badge>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-semibold text-slate-600">
                      {mold.drawType}
                    </span>
                    <span className="font-medium text-slate-400">{mold.maintenanceNotes}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeading
              title="تحليل زمن المراحل"
              subtitle="أزمنة التشغيل بالثواني لكل قطعة"
              icon={<Gauge size={17} />}
              action={<Badge tone="blue">{formatCycle(cycle)}</Badge>}
            />
            <div className="mt-3">
              <ProductPicker
                products={db.products}
                value={product?.code ?? ''}
                onChange={onSelect}
                compact
              />
            </div>
            <div className="scrollbar-thin mt-3 max-h-[340px] space-y-1.5 overflow-y-auto pl-1">
              {stages.map((stage, index) => {
                const meta = STAGE_GROUPS[stage.group];
                return (
                  <div key={stage.key} className="flex items-center gap-2">
                    <span className="num w-4 text-[9px] font-bold text-slate-300">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1 text-[10px]">
                        <span className="truncate font-bold text-ink">{stage.name}</span>
                        <span className="num shrink-0 font-bold" style={{ color: meta.color }}>
                          {stage.seconds}ث
                        </span>
                      </div>
                      <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(stage.seconds / maxSeconds) * 100}%`,
                            background: meta.color,
                          }}
                        />
                      </div>
                      <p
                        className={cn(
                          'mt-0.5 truncate text-[9px] font-bold',
                          stage.machineCode ? 'text-slate-500' : 'text-amber-600',
                        )}
                      >
                        {stage.machineName}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[10px] font-semibold text-slate-400">
              <span>الماكينة الرئيسية</span>
              <span className="text-ink">{stages[1]?.machineName ?? '—'}</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() =>
                document.getElementById('molds')?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              <Wrench size={14} /> مراجعة خطة الصيانة
            </Button>
          </Card>
        </div>
      </div>

      <Card className="p-5" id="molds">
        <SectionHeading
          title="جدول الإسطمبات التفصيلي"
          subtitle="المقاس، نوع السحب، الحالة الفنية وملاحظات الصيانة الدورية"
          icon={<Wrench size={17} />}
          action={<Badge tone="slate">{db.molds.length} إسطمبة</Badge>}
        />
        <div className="scrollbar-thin mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-right text-[12px]">
            <thead>
              <tr className="bg-mist/80 text-[11px] font-bold text-slate-500">
                <th className="px-4 py-2.5">الكود</th>
                <th className="px-4 py-2.5">اسم الإسطمبة</th>
                <th className="px-4 py-2.5">المقاس</th>
                <th className="px-4 py-2.5">نوع السحب</th>
                <th className="px-4 py-2.5">الحالة</th>
                <th className="px-4 py-2.5">ملاحظات الصيانة</th>
              </tr>
            </thead>
            <tbody>
              {db.molds.map((mold) => (
                <tr key={mold.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <span className="num rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold">
                      {mold.code}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 font-bold text-ink">{mold.name}</td>
                  <td className="num px-4 py-2.5 font-semibold">{fmt(mold.sizeCm)} سم</td>
                  <td className="px-4 py-2.5 font-medium text-slate-500">{mold.drawType}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={mold.condition === 'حالة ممتازة' ? 'green' : 'amber'}>
                      {mold.condition}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-[11px] font-medium text-slate-500">
                    {mold.maintenanceNotes}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] font-medium text-slate-400">
          إجمالي ساعات التشغيل المسجلة:{' '}
          <span className="num font-bold text-slate-500">
            {fmt1(db.machinery.reduce((sum, machine) => sum + machine.hoursSinceService, 0))} ساعة
          </span>{' '}
          — تُحدّث من مركز البيانات.
        </p>
      </Card>

      <SparePartsModal
        machine={partsMachine}
        open={Boolean(partsMachine)}
        onClose={() => setPartsMachine(null)}
        canEdit={can('data.machinery.edit')}
      />
    </div>
  );
}
