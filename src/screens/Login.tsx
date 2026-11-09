import { useState, type FormEvent } from 'react';
import {
  BadgeCheck,
  Eye,
  EyeOff,
  Factory,
  Layers,
  LockKeyhole,
  LogIn,
  Printer,
  ShieldCheck,
  User,
  Users,
} from 'lucide-react';
import { BrandMark } from '../components/ProductArt';
import { Button, cn } from '../components/ui';
import { useAuth } from '../auth/AuthContext';
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from '../auth/permissions';

export function LoginScreen() {
  const { login, demoAccounts } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin123');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const result = await login(username, password);
      if (!result.ok) setError(result.error ?? 'تعذر تسجيل الدخول');
    } finally {
      setSubmitting(false);
    }
  };

  const features = [
    { icon: Layers, title: '7 جداول صناعية', text: 'منتجات وخامات وإسطمبات وتكاليف في قاعدة واحدة' },
    { icon: ShieldCheck, title: 'صلاحيات تفصيلية', text: `${ALL_PERMISSIONS.length} صلاحية موزعة على ${PERMISSION_GROUPS.length} خدمة` },
    { icon: Printer, title: 'وثائق جاهزة', text: 'بطاقة تكلفة واستمارة جودة قابلة للطباعة' },
    { icon: Users, title: 'حسابات وأدوار', text: 'أنشئ أدوارًا مخصصة وحدّد كل عملية بدقة' },
  ];

  return (
    <div className="mesh flex min-h-screen items-center justify-center bg-mist p-4 sm:p-6">
      <div className="grid w-full max-w-[1080px] overflow-hidden rounded-[28px] border border-white bg-white shadow-2xl lg:grid-cols-[1.02fr_1fr]">
        {/* Brand panel */}
        <div className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-b from-[#1d1d21] via-[#211316] to-[#130f10] p-9 text-white lg:flex">
          <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-crown/25 blur-3xl" />

          <div className="relative">
            <div className="flex items-center gap-3">
              <BrandMark className="h-12 w-12" />
              <div>
                <p className="text-[16px] font-black">مصانع الزنوكي</p>
                <p className="text-[10px] font-semibold text-white/45">للأواني المنزلية — Industrial OS</p>
              </div>
            </div>

            <p className="mt-10 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold text-white/60">
              <BadgeCheck size={12} className="text-emerald-400" /> منصة التكاليف الصناعية
            </p>
            <h1 className="mt-4 text-[30px] font-black leading-[1.25]">
              كل قطعة ألومنيوم
              <br />
              لها <span className="text-brand">هوية وتكلفة</span> موثّقة.
            </h1>
            <p className="mt-3 max-w-sm text-[12px] font-medium leading-relaxed text-white/55">
              بطاقة منتج رقمية، مسار تصنيع من 17 مرحلة، تكاليف دقيقة، ووصول محكوم بالصلاحيات
              لكل فريق في المصنع.
            </p>

            <div className="mt-7 grid gap-2.5">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.05] px-3 py-2.5"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white/80">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="text-[11px] font-extrabold">{feature.title}</p>
                      <p className="text-[10px] font-medium text-white/45">{feature.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mt-8 flex items-center justify-between border-t border-white/10 pt-4 text-[10px] font-semibold text-white/35">
            <span className="flex items-center gap-1.5">
              <Factory size={13} /> خطوط باور · برايم · كراون · إيلورا
            </span>
            <span>v1.5</span>
          </div>
        </div>

        {/* Form panel */}
        <div className="flex flex-col justify-center bg-white p-6 sm:p-10">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <BrandMark className="h-10 w-10" />
            <div>
              <p className="text-[14px] font-black text-ink">مصانع الزنوكي</p>
              <p className="text-[10px] font-semibold text-slate-400">نظام إدارة التكاليف الصناعية</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] font-bold text-brand">بوابة الدخول الآمنة</p>
            <h2 className="mt-1 text-2xl font-black text-ink">تسجيل الدخول</h2>
            <p className="mt-1 text-[12px] font-medium text-slate-500">
              أدخل بيانات حسابك للوصول إلى الخدمات المصرّح بها لدورك فقط.
            </p>
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block">
              <span className="label">اسم المستخدم</span>
              <div className="relative">
                <User
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="field pr-9"
                  autoComplete="username"
                  placeholder="admin"
                  dir="ltr"
                />
              </div>
            </label>

            <label className="block">
              <span className="label">كلمة المرور</span>
              <div className="relative">
                <LockKeyhole
                  size={16}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="field pl-10 pr-9"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-ink"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </label>

            {error ? (
              <div className="rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[11px] font-bold text-rose-700">
                {error}
              </div>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={submitting}>
              <LogIn size={17} /> دخول إلى المنصة
            </Button>
          </form>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-mist/60 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-500">حسابات تجريبية جاهزة</p>
              <span className="rounded bg-white px-1.5 py-0.5 text-[9px] font-bold text-slate-400">
                اضغط للتعبئة
              </span>
            </div>
            <div className="mt-2 grid gap-1">
              {demoAccounts.map((account) => {
                const active = username === account.username;
                return (
                  <button
                    key={account.username}
                    type="button"
                    onClick={() => {
                      setUsername(account.username);
                      setPassword(account.password);
                      setError('');
                    }}
                    className={cn(
                      'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-right transition',
                      active
                        ? 'border-brand/30 bg-brand-soft'
                        : 'border-transparent bg-white hover:border-slate-200',
                    )}
                  >
                    <span className="text-[10px] font-extrabold text-ink">{account.label}</span>
                    <span className="flex items-center gap-2 text-[9px] font-semibold text-slate-400">
                      <span className="num rounded bg-slate-100 px-1.5 py-0.5 text-slate-600">
                        {account.username}
                      </span>
                      <span className="num" dir="ltr">
                        {account.password}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <p className="mt-4 flex items-center gap-1.5 text-[10px] font-medium leading-relaxed text-slate-400">
            <ShieldCheck size={12} className="shrink-0 text-slate-300" />
            دخول آمن عبر Supabase: كلمات المرور مُجزَّأة بـ bcrypt على الخادم، والجلسة
            محمية برمز عشوائي تنتهي صلاحيته بعد 12 ساعة.
          </p>
        </div>
      </div>
    </div>
  );
}
