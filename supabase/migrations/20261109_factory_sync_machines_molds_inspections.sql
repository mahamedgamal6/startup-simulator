-- مزامنة الإسطمبات والماكينات ونتائج الفحص بين الأجهزة.
-- القراءة تحترم صلاحيات العرض، والكتابة تحترم صلاحيات data.* أو quality.*.

create table if not exists elzonki.molds (
  id text primary key,
  code text not null unique,
  name text not null,
  size_cm numeric not null default 0,
  draw_type text not null default '',
  condition text not null default '',
  maintenance_notes text not null default '',
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.machinery (
  id text primary key,
  code text not null unique,
  name text not null,
  capacity text not null default '',
  country text not null default '',
  department text not null default '',
  fault_rate numeric not null default 0,
  status text not null default '',
  service_interval_hours numeric not null default 0,
  hours_since_service numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.inspections (
  id text primary key,
  product_code text not null
    references elzonki.products(code) on update cascade on delete cascade,
  check_id text not null,
  status text not null default 'pass' check (status in ('pass', 'fail', 'rework')),
  note text not null default '',
  updated_at timestamptz not null default now(),
  constraint inspections_product_check_key unique (product_code, check_id)
);

create index if not exists molds_code_idx on elzonki.molds (code);
create index if not exists machinery_code_idx on elzonki.machinery (code);

alter table elzonki.molds enable row level security;
alter table elzonki.machinery enable row level security;
alter table elzonki.inspections enable row level security;

-- الوصول مسموح فقط عبر RPCs التي تتحقق من الجلسة والصلاحية.
revoke all on table elzonki.molds from anon, authenticated;
revoke all on table elzonki.machinery from anon, authenticated;
revoke all on table elzonki.inspections from anon, authenticated;

insert into elzonki.molds (id, code, name, size_cm, draw_type, condition, maintenance_notes)
values
  ('mold-MOLD-08', 'MOLD-08', 'إسطمبة كبس حلة شاورمة 20', 20, 'سحب عميق هيدروليكي', 'حالة ممتازة', 'لا توجد'),
  ('mold-MOLD-12', 'MOLD-12', 'إسطمبة كبس حلة شاورمة 24', 24, 'سحب عميق هيدروليكي', 'حالة جيدة', 'فحص دوري بعد 5000 ضربة'),
  ('mold-MOLD-20', 'MOLD-20', 'نتاية مشتركة لصينية سوبر وباور 28', 28, 'تشكيل وقص', 'حالة جيدة', 'نتاية مشتركة'),
  ('mold-MOLD-22', 'MOLD-22', 'إسطمبة كبس كراون تيتانيوم 22', 22, 'سحب ثانٍ', 'حالة ممتازة', 'فحص بعد 4000 ضربة'),
  ('mold-MOLD-24', 'MOLD-24', 'إسطمبة كبس برايم استانلس 24', 24, 'تشكيل وقص', 'حالة جيدة', 'ضبط خلوص بعد كل تشغيلة'),
  ('mold-MOLD-26', 'MOLD-26', 'إسطمبة كبس إيلورا جرانيت 26', 26, 'سحب عميق هيدروليكي', 'حالة جيدة', 'صيانة دورية كل 6000 ضربة')
on conflict do nothing;

insert into elzonki.machinery (
  id, code, name, capacity, country, department, fault_rate, status,
  service_interval_hours, hours_since_service
)
values
  ('mc-16', '16', 'مكبس هيدروليكي Galdabini', 'حمولة 50 طن', 'إيطاليا', 'قسم المكابس والتشكيل', 1.8, 'يعمل بكفاءة', 4000, 1850),
  ('mc-17', '17', 'مكبس هيدروليكي Ozkoc', 'حمولة 160 طن', 'تركيا', 'قسم المكابس والتشكيل', 2.1, 'يعمل بكفاءة', 4000, 2900),
  ('mc-71', '71', 'ماكينة تحرير وتشكيل حواف Omera', 'أوتوماتيك', 'إيطاليا', 'قسم التحرير والقص', 1.2, 'يعمل بكفاءة', 3000, 640),
  ('mc-24', '24', 'ماكينة تلميع أوتوماتيكية Palummelal', 'متعددة الرؤوس', 'إيطاليا', 'قسم التلميع والتشطيب', 2.5, 'يعمل بكفاءة', 2500, 1980),
  ('mc-75', '75', 'ماكينة برشمة وتركيب أيدي Cap Riveting', 'هوائية', 'إيطاليا', 'قسم البرشمة والتجميع', 0.9, 'يعمل بكفاءة', 3500, 720),
  ('mc-22', '22', 'غسالة ألومنيوم صناعية Italrinse', 'خط غسيل مستمر', 'إيطاليا', 'قسم الغسيل والتشطيب', 1.5, 'يعمل بكفاءة', 2000, 430),
  ('mc-73', '73', 'ماكينة صنفرة وتلميع أولي Bula', 'متعددة الرؤوس', 'إيطاليا', 'قسم التلميع والتشطيب', 2.2, 'تحتاج صيانة قريبة', 2500, 2360),
  ('mc-74', '74', 'ماكينة خرط قيعان CNC Romai', 'CNC 4 محاور', 'إيطاليا', 'قسم الخراطة والتشغيل', 1.7, 'يعمل بكفاءة', 5000, 2100),
  ('mc-76', '76', 'مكبس كبس ثانٍ Ozkoc', 'حمولة 100 طن', 'تركيا', 'قسم المكابس والتشكيل', 2.4, 'يعمل بكفاءة', 4000, 1250),
  ('mc-77', '77', 'خط سير ناقل وتجميع نهائي', 'خط أوتوماتيكي', 'إيطاليا', 'قسم التجميع والتعبئة', 1.1, 'يعمل بكفاءة', 6000, 940),
  ('mc-78', '78', 'ماكينة ثقب وتجميع البزبوز', 'هوائية', 'محلي', 'قسم البرشمة والتجميع', 1.3, 'يعمل بكفاءة', 3000, 1560)
on conflict do nothing;

create or replace function elzonki.mold_json(p elzonki.molds)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'sizeCm', p.size_cm,
    'drawType', p.draw_type,
    'condition', p.condition,
    'maintenanceNotes', p.maintenance_notes
  );
$$;

create or replace function elzonki.machinery_json(p elzonki.machinery)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'capacity', p.capacity,
    'country', p.country,
    'department', p.department,
    'faultRate', p.fault_rate,
    'status', p.status,
    'serviceIntervalHours', p.service_interval_hours,
    'hoursSinceService', p.hours_since_service
  );
$$;

create or replace function elzonki.inspection_json(p elzonki.inspections)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'productCode', p.product_code,
    'checkId', p.check_id,
    'status', p.status,
    'note', p.note,
    'updatedAt', p.updated_at
  );
$$;

-- دوال مساعدة داخلية جديدة للجداول الإضافية؛ لا تُمنح لـ anon مباشرة.
create or replace function elzonki.upsert_molds(p_token text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row jsonb;
  v_id text;
  v_code text;
  v_name text;
  v_mold elzonki.molds;
  v_result jsonb := '[]'::jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'TOO_MANY_ROWS';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
    v_code := nullif(trim(coalesce(v_row->>'code', '')), '');
    v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
    if v_id is null or v_code is null or v_name is null then
      raise exception 'INVALID_ROW';
    end if;
    if exists (select 1 from elzonki.molds m where m.code = v_code and m.id <> v_id) then
      raise exception 'CODE_TAKEN';
    end if;
    if exists (select 1 from elzonki.molds m where m.id = v_id) then
      perform elzonki.require_permission(p_token, 'data.molds.edit');
    else
      perform elzonki.require_permission(p_token, 'data.molds.create');
    end if;

    insert into elzonki.molds (
      id, code, name, size_cm, draw_type, condition, maintenance_notes, updated_at
    ) values (
      v_id,
      v_code,
      v_name,
      coalesce((v_row->>'sizeCm')::numeric, 0),
      coalesce(v_row->>'drawType', ''),
      coalesce(v_row->>'condition', ''),
      coalesce(v_row->>'maintenanceNotes', ''),
      now()
    )
    on conflict (id) do update set
      code = excluded.code,
      name = excluded.name,
      size_cm = excluded.size_cm,
      draw_type = excluded.draw_type,
      condition = excluded.condition,
      maintenance_notes = excluded.maintenance_notes,
      updated_at = now()
    returning * into v_mold;

    v_result := v_result || jsonb_build_array(elzonki.mold_json(v_mold));
  end loop;

  return v_result;
end;
$$;

create or replace function elzonki.upsert_machinery(p_token text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row jsonb;
  v_id text;
  v_code text;
  v_name text;
  v_machine elzonki.machinery;
  v_result jsonb := '[]'::jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'TOO_MANY_ROWS';
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
    v_code := nullif(trim(coalesce(v_row->>'code', '')), '');
    v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
    if v_id is null or v_code is null or v_name is null then
      raise exception 'INVALID_ROW';
    end if;
    if exists (select 1 from elzonki.machinery m where m.code = v_code and m.id <> v_id) then
      raise exception 'CODE_TAKEN';
    end if;
    if exists (select 1 from elzonki.machinery m where m.id = v_id) then
      perform elzonki.require_permission(p_token, 'data.machinery.edit');
    else
      perform elzonki.require_permission(p_token, 'data.machinery.create');
    end if;

    insert into elzonki.machinery (
      id, code, name, capacity, country, department, fault_rate, status,
      service_interval_hours, hours_since_service, updated_at
    ) values (
      v_id,
      v_code,
      v_name,
      coalesce(v_row->>'capacity', ''),
      coalesce(v_row->>'country', ''),
      coalesce(v_row->>'department', ''),
      coalesce((v_row->>'faultRate')::numeric, 0),
      coalesce(v_row->>'status', ''),
      coalesce((v_row->>'serviceIntervalHours')::numeric, 0),
      coalesce((v_row->>'hoursSinceService')::numeric, 0),
      now()
    )
    on conflict (id) do update set
      code = excluded.code,
      name = excluded.name,
      capacity = excluded.capacity,
      country = excluded.country,
      department = excluded.department,
      fault_rate = excluded.fault_rate,
      status = excluded.status,
      service_interval_hours = excluded.service_interval_hours,
      hours_since_service = excluded.hours_since_service,
      updated_at = now()
    returning * into v_machine;

    v_result := v_result || jsonb_build_array(elzonki.machinery_json(v_machine));
  end loop;

  return v_result;
end;
$$;

revoke all on function elzonki.upsert_molds(text, jsonb) from public, anon, authenticated;
revoke all on function elzonki.upsert_machinery(text, jsonb) from public, anon, authenticated;

-- نحتفظ بالدالة القديمة كقلب داخلي، ونضيف طبقة توجيه للجدولين الجديدين.
alter function public.app_upsert_factory_rows(text, text, jsonb)
  rename to app_upsert_factory_rows_core;

revoke all on function public.app_upsert_factory_rows_core(text, text, jsonb)
  from public, anon, authenticated;

create or replace function public.app_upsert_factory_rows(
  p_token text,
  p_table text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_table = 'molds' then
    return elzonki.upsert_molds(p_token, p_rows);
  end if;
  if p_table = 'machinery' then
    return elzonki.upsert_machinery(p_token, p_rows);
  end if;
  return public.app_upsert_factory_rows_core(p_token, p_table, p_rows);
end;
$$;

grant execute on function public.app_upsert_factory_rows(text, text, jsonb) to anon, authenticated;

alter function public.app_delete_factory_row(text, text, text)
  rename to app_delete_factory_row_core;

revoke all on function public.app_delete_factory_row_core(text, text, text)
  from public, anon, authenticated;

create or replace function public.app_delete_factory_row(
  p_token text,
  p_table text,
  p_id text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_table = 'molds' then
    perform elzonki.require_permission(p_token, 'data.molds.delete');
    delete from elzonki.molds m where m.id = p_id;
    return;
  end if;

  if p_table = 'machinery' then
    perform elzonki.require_permission(p_token, 'data.machinery.delete');
    delete from elzonki.machinery m where m.id = p_id;
    return;
  end if;

  perform public.app_delete_factory_row_core(p_token, p_table, p_id);
end;
$$;

grant execute on function public.app_delete_factory_row(text, text, text) to anon, authenticated;

create or replace function public.app_factory_bootstrap(p_token text)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid uuid;
  v_can_products boolean := false;
  v_can_raw boolean := false;
  v_can_accessories boolean := false;
  v_can_molds boolean := false;
  v_can_machinery boolean := false;
  v_can_packaging boolean := false;
  v_can_costs boolean := false;
  v_can_inspections boolean := false;
  v_products jsonb := '[]'::jsonb;
  v_raw jsonb := '[]'::jsonb;
  v_accessories jsonb := '[]'::jsonb;
  v_molds jsonb := '[]'::jsonb;
  v_machinery jsonb := '[]'::jsonb;
  v_packaging jsonb := '[]'::jsonb;
  v_costs jsonb := '[]'::jsonb;
  v_inspections jsonb := '[]'::jsonb;
  v_settings jsonb := null;
begin
  v_uid := elzonki.require_user(p_token);
  v_can_products := elzonki.has_permission(v_uid, 'data.products.view');
  v_can_raw := elzonki.has_permission(v_uid, 'data.rawMaterials.view');
  v_can_accessories := elzonki.has_permission(v_uid, 'data.accessories.view');
  v_can_packaging := elzonki.has_permission(v_uid, 'data.packaging.view');
  v_can_costs := elzonki.has_permission(v_uid, 'data.costElements.view');
  v_can_inspections := elzonki.has_permission(v_uid, 'quality.view');

  -- الماكينات والإسطمبات مرجع فني داخل بطاقة المنتج؛ تُقرأ لمن يملك
  -- عرض البطاقة أيضًا، بينما تبقى الكتابة محكومة بصلاحيات data.*.
  v_can_molds := elzonki.has_permission(v_uid, 'data.molds.view')
    or elzonki.has_permission(v_uid, 'passport.view');
  v_can_machinery := elzonki.has_permission(v_uid, 'data.machinery.view')
    or elzonki.has_permission(v_uid, 'passport.view');

  if v_can_products then
    select coalesce(jsonb_agg(elzonki.product_json(p) order by p.code), '[]'::jsonb)
    into v_products from elzonki.products p;
  end if;

  if v_can_raw then
    select coalesce(jsonb_agg(elzonki.raw_material_json(r) order by r.code), '[]'::jsonb)
    into v_raw from elzonki.raw_materials r;
  end if;

  if v_can_accessories then
    select coalesce(jsonb_agg(elzonki.accessory_json(a) order by a.code), '[]'::jsonb)
    into v_accessories from elzonki.accessories a;
  end if;

  if v_can_molds then
    select coalesce(jsonb_agg(elzonki.mold_json(m) order by m.code), '[]'::jsonb)
    into v_molds from elzonki.molds m;
  end if;

  if v_can_machinery then
    select coalesce(jsonb_agg(elzonki.machinery_json(m) order by m.code), '[]'::jsonb)
    into v_machinery from elzonki.machinery m;
  end if;

  if v_can_packaging then
    select coalesce(jsonb_agg(elzonki.packaging_json(p) order by p.code), '[]'::jsonb)
    into v_packaging from elzonki.packaging p;
  end if;

  if v_can_costs then
    select coalesce(jsonb_agg(elzonki.cost_element_json(c) order by c.product_code), '[]'::jsonb)
    into v_costs from elzonki.cost_elements c;

    select elzonki.settings_json(s) into v_settings
    from elzonki.settings s where s.singleton;
  end if;

  if v_can_inspections then
    select coalesce(
      jsonb_agg(elzonki.inspection_json(i) order by i.product_code, i.check_id),
      '[]'::jsonb
    )
    into v_inspections from elzonki.inspections i;
  end if;

  return jsonb_build_object(
    'products', v_products,
    'rawMaterials', v_raw,
    'accessories', v_accessories,
    'molds', v_molds,
    'machinery', v_machinery,
    'packaging', v_packaging,
    'costElements', v_costs,
    'inspections', v_inspections,
    'settings', v_settings,
    'visible', jsonb_build_object(
      'products', v_can_products,
      'rawMaterials', v_can_raw,
      'accessories', v_can_accessories,
      'molds', v_can_molds,
      'machinery', v_can_machinery,
      'packaging', v_can_packaging,
      'costElements', v_can_costs,
      'inspections', v_can_inspections
    )
  );
end;
$$;

grant execute on function public.app_factory_bootstrap(text) to anon, authenticated;

create or replace function public.app_set_inspection(
  p_token text,
  p_product_code text,
  p_check_id text,
  p_status text,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_product_code text;
  v_check_id text;
  v_note text;
  v_id text;
  v_inspection elzonki.inspections;
begin
  perform elzonki.require_permission(p_token, 'quality.inspect');
  v_product_code := nullif(trim(coalesce(p_product_code, '')), '');
  v_check_id := nullif(trim(coalesce(p_check_id, '')), '');
  v_note := coalesce(p_note, '');
  if v_product_code is null or v_check_id is null then
    raise exception 'INVALID_ROW';
  end if;
  if length(v_check_id) > 120 or length(v_note) > 2000 then
    raise exception 'INVALID_ROW';
  end if;
  if p_status not in ('pass', 'fail', 'rework') then
    raise exception 'INVALID_STATUS';
  end if;
  if not exists (
    select 1 from elzonki.products p where p.code = v_product_code
  ) then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  v_id := 'insp-' || v_product_code || '-' || v_check_id;

  insert into elzonki.inspections (
    id, product_code, check_id, status, note, updated_at
  ) values (
    v_id, v_product_code, v_check_id, p_status, v_note, now()
  )
  on conflict (product_code, check_id) do update set
    status = excluded.status,
    note = excluded.note,
    updated_at = now()
  returning * into v_inspection;

  return elzonki.inspection_json(v_inspection);
end;
$$;

create or replace function public.app_clear_inspections(
  p_token text,
  p_product_code text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_product_code text;
  v_deleted integer := 0;
begin
  perform elzonki.require_permission(p_token, 'quality.reset');
  v_product_code := nullif(trim(coalesce(p_product_code, '')), '');
  if v_product_code is null then
    raise exception 'INVALID_ROW';
  end if;

  delete from elzonki.inspections i where i.product_code = v_product_code;
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('deleted', v_deleted);
end;
$$;

grant execute on function public.app_set_inspection(text, text, text, text, text)
  to anon, authenticated;
grant execute on function public.app_clear_inspections(text, text)
  to anon, authenticated;

create or replace function public.app_replace_factory_data(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row jsonb;
begin
  perform elzonki.require_permission(p_token, 'settings.reset_demo');
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_ROWS';
  end if;
  if p_payload ? 'inspections' and jsonb_typeof(p_payload->'inspections') <> 'array' then
    raise exception 'INVALID_ROWS';
  end if;

  truncate table
    elzonki.inspections,
    elzonki.cost_elements,
    elzonki.products,
    elzonki.molds,
    elzonki.machinery,
    elzonki.raw_materials,
    elzonki.accessories,
    elzonki.packaging;

  perform public.app_upsert_factory_rows(p_token, 'products', coalesce(p_payload->'products', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'rawMaterials', coalesce(p_payload->'rawMaterials', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'accessories', coalesce(p_payload->'accessories', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'molds', coalesce(p_payload->'molds', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'machinery', coalesce(p_payload->'machinery', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'packaging', coalesce(p_payload->'packaging', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'costElements', coalesce(p_payload->'costElements', '[]'::jsonb));
  perform public.app_update_factory_settings(
    p_token,
    (p_payload->'settings'->>'marginPct')::numeric,
    (p_payload->'settings'->>'aluminumFactor')::numeric
  );

  for v_row in
    select value from jsonb_array_elements(coalesce(p_payload->'inspections', '[]'::jsonb))
  loop
    perform public.app_set_inspection(
      p_token,
      v_row->>'productCode',
      v_row->>'checkId',
      coalesce(v_row->>'status', 'pass'),
      coalesce(v_row->>'note', '')
    );
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.app_replace_factory_data(text, jsonb) to anon, authenticated;
