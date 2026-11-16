import { PLAN_STATUS_META, type PlanMetrics } from '../lib/planning';
import { fmt, fmt1, money, pct } from '../lib/format';
import type { ProductionPlan } from '../types';

const text = (value?: string | null) => (value?.trim() ? value : 'غير محدد');

export function PlanPrintSheet({
  plan,
  metrics,
}: {
  plan: ProductionPlan;
  metrics: PlanMetrics;
}) {
  const actualRows = metrics.items.filter((row) => row.item.actual);
  const setupAndRunHours = metrics.requiredHours + metrics.setupHours;
  const printedAt = new Date().toLocaleString('ar-EG');

  return (
    <div className="plan-print-sheet hidden print:block" dir="rtl">
      <header className="plan-print-header">
        <div>
          <p className="plan-print-brand">مصانع الزنوكي للأواني المنزلية</p>
          <h1>خطة إنتاج وتشغيل</h1>
          <p className="plan-print-subtitle">قطاع التصنيع والتكاليف الصناعية</p>
        </div>
        <div className="plan-print-doc">
          <p><span>رقم الخطة</span><strong className="num">{plan.code}</strong></p>
          <p><span>الحالة</span><strong>{PLAN_STATUS_META[plan.status].label}</strong></p>
          <p><span>تاريخ الطباعة</span><strong className="num">{printedAt}</strong></p>
        </div>
      </header>

      <section className="plan-print-block">
        <h2>بيانات الخطة</h2>
        <div className="plan-print-grid">
          {[
            ['اسم الخطة', text(plan.name)],
            ['المصنع', text(plan.factory)],
            ['خط الإنتاج', text(plan.line)],
            ['الوردية', text(plan.shift)],
            ['المسؤول', text(plan.owner)],
            ['تاريخ البدء', plan.startDate || 'غير محدد'],
            ['الانتهاء المتوقع', metrics.endDate || 'غير محدد'],
            ['مدة التنفيذ', `${fmt(metrics.days)} يوم`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="plan-print-block">
        <h2>الطاقة والتشغيل</h2>
        <div className="plan-print-grid plan-print-grid-5">
          {[
            ['ساعات الوردية', `${fmt1(plan.shiftHours)} ساعة`],
            ['ورديات/يوم', fmt(plan.shiftsPerDay)],
            ['آلات متاحة', fmt(plan.machinesAvailable)],
            ['توقف مخطّط', pct(plan.plannedDowntimePct, 0)],
            ['ساعات التجهيز', `${fmt1(metrics.setupHours)} ساعة`],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong className="num">{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="plan-print-block">
        <h2>ملخص التكلفة والطاقة</h2>
        <div className="plan-print-kpis">
          {[
            ['إجمالي الوحدات', fmt(metrics.unitCount)],
            ['إجمالي التكلفة', `${money(metrics.totalCost)} ج.م`],
            ['الإيراد المتوقع', `${money(metrics.totalRevenue)} ج.م`],
            ['الربح المتوقع', `${money(metrics.totalProfit)} ج.م`],
            ['هامش الربح', pct(metrics.marginPct, 1)],
            ['متوسط تكلفة الوحدة', `${money(metrics.avgUnitCost)} ج.م`],
            ['ساعات التشغيل', `${fmt1(setupAndRunHours)} ساعة`],
            ['استغلال الطاقة', pct(metrics.utilization, 1)],
          ].map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong className="num">{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="plan-print-block plan-print-items">
        <h2>بنود الإنتاج</h2>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>المنتج / الكود</th>
              <th>المقاس / اللون</th>
              <th>الكمية</th>
              <th>زمن/قطعة</th>
              <th>تكلفة الوحدة</th>
              <th>إجمالي التكلفة</th>
              <th>سعر البيع</th>
              <th>الإيراد</th>
              <th>الساعات</th>
              <th>الجاهزية</th>
            </tr>
          </thead>
          <tbody>
            {metrics.items.map((row, index) => (
              <tr key={`print-item-${row.item.id}`}>
                <td className="num">{index + 1}</td>
                <td>
                  <strong>{row.item.productName}</strong>
                  <span className="plan-print-code">{row.item.productCode}</span>
                </td>
                <td>{row.item.sizeLabel} / {row.item.colorName}</td>
                <td className="num">{fmt(row.item.qty)}</td>
                <td className="num">{row.cycle ? `${Math.round(row.cycle)} ث` : 'غير محدد'}</td>
                <td className="num">{money(row.unitCost)}</td>
                <td className="num">{money(row.totalCost)}</td>
                <td className="num">{money(row.price)}</td>
                <td className="num">{money(row.revenue)}</td>
                <td className="num">{fmt1(row.hours)}</td>
                <td>{row.missing.length ? 'بيانات ناقصة' : row.frozen ? 'معتمد ومثبت' : 'جاهز'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3}>الإجمالي</td>
              <td className="num">{fmt(metrics.unitCount)}</td>
              <td colSpan={2} />
              <td className="num">{money(metrics.totalCost)}</td>
              <td />
              <td className="num">{money(metrics.totalRevenue)}</td>
              <td className="num">{fmt1(metrics.requiredHours)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="plan-print-block">
        <h2>توافر الخامات والتعبئة</h2>
        <table>
          <thead>
            <tr>
              <th>المنتج</th>
              <th>المقاس / اللون</th>
              <th>الخام المرتبط</th>
              <th>مواد التعبئة</th>
              <th>الجاهزية</th>
            </tr>
          </thead>
          <tbody>
            {metrics.items.map((row) => (
              <tr key={`print-res-${row.item.id}`}>
                <td>{row.item.productName}</td>
                <td>{row.item.sizeLabel} / {row.item.colorName}</td>
                <td>{row.rawOk ? row.rawName : 'غير مرتبط'}</td>
                <td>{row.packagingOk ? row.packagingNames.join('، ') : 'غير مرتبطة'}</td>
                <td>{row.missing.length ? row.missing.join('، ') : 'جاهز'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {actualRows.length ? (
        <section className="plan-print-block">
          <h2>المخطط مقابل الفعلي</h2>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>المخطط</th>
                <th>المنتج فعليًا</th>
                <th>الانحراف</th>
                <th>ساعات فعلية</th>
                <th>تكلفة فعلية</th>
                <th>سبب الانحراف</th>
              </tr>
            </thead>
            <tbody>
              {actualRows.map((row) => {
                const actual = row.item.actual!;
                const deviation = actual.producedQty - row.item.qty;
                return (
                  <tr key={`print-actual-${row.item.id}`}>
                    <td>{row.item.productName} — {row.item.sizeLabel}</td>
                    <td className="num">{fmt(row.item.qty)}</td>
                    <td className="num">{fmt(actual.producedQty)}</td>
                    <td className="num">{deviation >= 0 ? '+' : ''}{fmt(deviation)}</td>
                    <td className="num">{fmt1(actual.actualHours)}</td>
                    <td className="num">{money(actual.actualCost)}</td>
                    <td>{text(actual.deviationReason)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ) : null}

      {metrics.warnings.length ? (
        <section className="plan-print-block plan-print-warning">
          <h2>تنبيهات التقدير</h2>
          <ul>
            {metrics.warnings.map((warning) => <li key={warning}>{warning}</li>)}
          </ul>
        </section>
      ) : null}

      {plan.notes.trim() ? (
        <section className="plan-print-block">
          <h2>ملاحظات الخطة</h2>
          <p className="plan-print-notes">{plan.notes}</p>
        </section>
      ) : null}

      {plan.snapshot ? (
        <section className="plan-print-block plan-print-snapshot">
          <h2>نسخة التكاليف المعتمدة</h2>
          <p>
            اعتمدها {plan.snapshot.approvedBy} في {new Date(plan.snapshot.at).toLocaleString('ar-EG')} —
            إجمالي التكلفة {money(plan.snapshot.totalCost)} ج.م، الإيراد {money(plan.snapshot.totalRevenue)} ج.م،
            الوحدات {fmt(plan.snapshot.unitCount)}، الساعات {fmt1(plan.snapshot.totalHours)}.
          </p>
        </section>
      ) : null}

      <section className="plan-print-signatures">
        <div><span>أعدّها</span><strong>{text(plan.owner)}</strong></div>
        <div><span>اعتمدها</span><strong>{text(plan.approvedBy)}</strong></div>
        <div><span>مسؤول الإنتاج</span><strong>&nbsp;</strong></div>
        <div><span>التوقيع</span><strong>&nbsp;</strong></div>
      </section>

      <footer className="plan-print-footer">
        <span>{plan.code} — {plan.name}</span>
        <span>مصانع الزنوكي · وثيقة داخلية</span>
      </footer>
    </div>
  );
}
