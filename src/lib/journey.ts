import type {
  Machinery,
  Mold,
  MoldSlot,
  Product,
  ResolvedStage,
  StageDef,
} from '../types';

export const STAGE_DEFS: StageDef[] = [
  {
    key: 'blanking',
    name: 'ختم القطعة',
    group: 'forming',
    description: 'قص أقراص الألومنيوم من الرول أو الشرائح بمقاس القرص المعتمد.',
    machineCode: '16',
    moldSlot: 'press',
    baseSeconds: 16,
    workers: 2,
  },
  {
    key: 'press-1',
    name: 'كبس القطعة',
    group: 'forming',
    description: 'السحب العميق الأول لتشكيل جسم الحلة على المكبس الهيدروليكي.',
    machineCode: '17',
    moldSlot: 'press',
    baseSeconds: 40,
    workers: 2,
  },
  {
    key: 'press-2',
    name: 'كبس مرحلة ثانية',
    group: 'forming',
    description: 'سحب ثانٍ لضبط السماكة وتوزيع المعدن على الجدار والقاع.',
    machineCode: '76',
    moldSlot: 'second',
    baseSeconds: 34,
    workers: 2,
  },
  {
    key: 'trim',
    name: 'التحرير',
    group: 'forming',
    description: 'تحرير الحواف وتشكيل حرف الحلة على ماكينة التحرير الأوتوماتيكية.',
    machineCode: '71',
    moldSlot: 'trim',
    baseSeconds: 12,
    workers: 1,
  },
  {
    key: 'conveyor',
    name: 'السير',
    group: 'finishing',
    description: 'نقل القطع بين المحطات على السير الناقل مع فرز أولي للقطع.',
    machineCode: '77',
    moldSlot: null,
    baseSeconds: 6,
    workers: 1,
  },
  {
    key: 'base-turning',
    name: 'خرط القاع',
    group: 'finishing',
    description: 'خرط قاع القطعة وتسطيحه لضمان الثبات على مصادر الحرارة.',
    machineCode: '74',
    moldSlot: null,
    baseSeconds: 26,
    workers: 1,
  },
  {
    key: 'grinding',
    name: 'الرحو',
    group: 'finishing',
    description: 'تجليخ السطح وإزالة العلامات الناتجة عن عمليات السحب.',
    machineCode: '74',
    moldSlot: null,
    baseSeconds: 21,
    workers: 1,
  },
  {
    key: 'washing',
    name: 'غسيل',
    group: 'finishing',
    description: 'غسيل صناعي لإزالة زيوت التشحيم وبقايا الخراطة.',
    machineCode: '22',
    moldSlot: null,
    baseSeconds: 14,
    workers: 1,
  },
  {
    key: 'deburring',
    name: 'إزالة زوائد الكبس',
    group: 'finishing',
    description: 'إزالة الزوائد المعدنية يدويًا وفحص الحواف قبل التلميع.',
    machineCode: '',
    moldSlot: null,
    baseSeconds: 18,
    workers: 2,
  },
  {
    key: 'polish-1',
    name: 'تلميع أولي',
    group: 'polishing',
    description: 'تلميع أولي متعدد الرؤوس لتهيئة السطح للتلميع النهائي.',
    machineCode: '73',
    moldSlot: null,
    baseSeconds: 24,
    workers: 1,
  },
  {
    key: 'sanding',
    name: 'صنفرة',
    group: 'polishing',
    description: 'صنفرة دقيقة لإزالة الخدوش الدقيقة وتوحيد الملمس.',
    machineCode: '73',
    moldSlot: null,
    baseSeconds: 17,
    workers: 1,
  },
  {
    key: 'polish-final',
    name: 'تلميع أخير',
    group: 'polishing',
    description: 'تلميع نهائي أوتوماتيكي يعطي اللمعان المعتمد لعلامة الزنوكي.',
    machineCode: '24',
    moldSlot: null,
    baseSeconds: 19,
    workers: 1,
  },
  {
    key: 'riveting',
    name: 'برشمة وتركيب اليد',
    group: 'assembly',
    description: 'برشمة المقابض الجانبية وتثبيت المسامير بضغط هوائي معاير.',
    machineCode: '75',
    moldSlot: null,
    baseSeconds: 15,
    workers: 2,
  },
  {
    key: 'holes',
    name: 'الثقوب',
    group: 'assembly',
    description: 'ثقب مواضع البزبوز والمصفي بمقاسات معتمدة.',
    machineCode: '78',
    moldSlot: null,
    baseSeconds: 8,
    workers: 1,
  },
  {
    key: 'strainer',
    name: 'تجميع المصفي والبزبوز',
    group: 'assembly',
    description: 'تركيب المصفي والبزبوز وفحص ثباتهما.',
    machineCode: '78',
    moldSlot: null,
    baseSeconds: 11,
    workers: 1,
  },
  {
    key: 'lid',
    name: 'تجميع الغطاء',
    group: 'assembly',
    description: 'تجميع الغطاء مع المقبض العلوي والحلقة العازلة.',
    machineCode: '77',
    moldSlot: null,
    baseSeconds: 12,
    workers: 1,
  },
  {
    key: 'packing',
    name: 'التجميع والتعبئة',
    group: 'assembly',
    description: 'تجميع المنتج النهائي وفحصه بصريًا ثم تعبئته وترقيمه.',
    machineCode: '77',
    moldSlot: null,
    baseSeconds: 22,
    workers: 2,
  },
];

const FAMILY_FACTOR: Record<string, number> = {
  باور: 1,
  'باور بلس': 1.05,
  'برايم استانلس': 1,
  'كراون تيتانيوم': 1.15,
  'إيلورا جرانيت': 1.1,
  'صينية فرن': 0.85,
};

export const STAGE_GROUPS: Record<
  StageDef['group'],
  { label: string; color: string; soft: string }
> = {
  forming: { label: 'التشكيل والكبس', color: '#ec1c24', soft: '#fdecec' },
  finishing: { label: 'التشطيب والغسيل', color: '#4A90E2', soft: '#eaf3fd' },
  polishing: { label: 'التلميع والصنفرة', color: '#447a72', soft: '#e9f2f0' },
  assembly: { label: 'التجميع والتعبئة', color: '#a95e6b', soft: '#f6ecee' },
};

function pickMold(product: Product, molds: Mold[]): Mold | undefined {
  const exact = molds.find((mold) => mold.sizeCm === product.sizeCm);
  if (exact) return exact;
  const sorted = [...molds].sort(
    (a, b) => Math.abs(a.sizeCm - product.sizeCm) - Math.abs(b.sizeCm - product.sizeCm),
  );
  return sorted[0];
}

function moldForSlot(mold: Mold | undefined, slot: MoldSlot): string | null {
  if (!slot) return null;
  return mold?.code ?? null;
}

export function buildJourney(
  product: Product,
  machinery: Machinery[],
  molds: Mold[],
): ResolvedStage[] {
  const scale = (product.sizeCm / 22) * (FAMILY_FACTOR[product.family] ?? 1);
  const mold = pickMold(product, molds);
  let cumulative = 0;

  return STAGE_DEFS.map((def) => {
    const custom = product.stageOverrides?.[def.key];
    const customSeconds = Number(custom?.seconds);
    const customWorkers = Number(custom?.workers);
    const seconds =
      Number.isFinite(customSeconds) && customSeconds >= 1
        ? Math.round(customSeconds)
        : Math.max(4, Math.round(def.baseSeconds * scale));
    const workers =
      Number.isFinite(customWorkers) && customWorkers >= 1
        ? Math.round(customWorkers)
        : def.workers;
    cumulative += seconds;
    const override = product.stageMachines?.[def.key];
    const machineCode = override === undefined ? def.machineCode : override;
    const machine = machinery.find((item) => item.code === machineCode);
    return {
      ...def,
      machineCode,
      workers,
      seconds,
      cumulative,
      machineName: machine?.name ?? (machineCode ? 'ماكينة غير مسجلة' : 'عمل يدوي'),
      moldCode: moldForSlot(mold, def.moldSlot),
    };
  });
}

export function cycleSeconds(stages: ResolvedStage[]): number {
  return stages.reduce((sum, stage) => sum + stage.seconds, 0);
}

export function formatCycle(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest} ثانية`;
  return `${minutes} دقيقة${rest ? ` و${rest} ثانية` : ''}`;
}
