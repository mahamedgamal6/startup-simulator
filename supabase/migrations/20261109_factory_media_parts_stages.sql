-- صور الكيانات، قطع غيار الماكينات، وتخصيص زمن وعمالة مراحل المنتج.
-- كل الكتابات تمر عبر RPCs محمية بصلاحيات الجداول الحالية.

alter table elzonki.products
  add column if not exists stage_overrides jsonb not null default '{}'::jsonb;

create table if not exists elzonki.spare_parts (
  id text primary key,
  machine_id text not null
    references elzonki.machinery(id) on update cascade on delete cascade,
  code text not null,
  name text not null,
  unit_cost numeric not null default 0,
  stock_qty numeric not null default 0,
  replacement_interval_hours numeric not null default 0,
  notes text not null default '',
  updated_at timestamptz not null default now(),
  constraint spare_parts_machine_code_key unique (machine_id, code)
);

create table if not exists elzonki.images (
  owner_table text not null
    check (owner_table in ('products', 'machinery', 'molds', 'accessories')),
  owner_id text not null,
  data_url text not null,
  updated_at timestamptz not null default now(),
  primary key (owner_table, owner_id)
);

alter table elzonki.spare_parts enable row level security;
alter table elzonki.images enable row level security;

revoke all on table elzonki.spare_parts from anon, authenticated;
revoke all on table elzonki.images from anon, authenticated;

create or replace function elzonki.product_json(p elzonki.products)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'family', p.family,
    'sizeCm', p.size_cm,
    'heightCm', p.height_cm,
    'capacityL', p.capacity_l,
    'netWeightKg', p.net_weight_kg,
    'grossWeightKg', p.gross_weight_kg,
    'cbm', p.cbm,
    'pcsPerCarton', p.pcs_per_carton,
    'barcode', p.barcode,
    'stageMachines', coalesce(p.stage_machines, '{}'::jsonb),
    'stageOverrides', coalesce(p.stage_overrides, '{}'::jsonb)
  );
$$;

create or replace function elzonki.spare_part_json(p elzonki.spare_parts)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'machineId', p.machine_id,
    'code', p.code,
    'name', p.name,
    'unitCost', p.unit_cost,
    'stockQty', p.stock_qty,
    'replacementIntervalHours', p.replacement_interval_hours,
    'notes', p.notes
  );
$$;

create or replace function elzonki.image_json(p elzonki.images)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'ownerTable', p.owner_table,
    'ownerId', p.owner_id,
    'dataUrl', p.data_url,
    'updatedAt', p.updated_at
  );
$$;

create or replace function public.app_update_product_stages(
  p_token text,
  p_product_id text,
  p_stage_machines jsonb,
  p_stage_overrides jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_product elzonki.products;
begin
  perform elzonki.require_permission(p_token, 'data.products.edit');
  if nullif(trim(coalesce(p_product_id, '')), '') is null then
    raise exception 'INVALID_ROW';
  end if;
  if p_stage_machines is not null and jsonb_typeof(p_stage_machines) <> 'object' then
    raise exception 'INVALID_ROW';
  end if;
  if p_stage_overrides is not null and jsonb_typeof(p_stage_overrides) <> 'object' then
    raise exception 'INVALID_ROW';
  end if;

  update elzonki.products p
  set stage_machines = coalesce(p_stage_machines, '{}'::jsonb),
      stage_overrides = coalesce(p_stage_overrides, '{}'::jsonb),
      updated_at = now()
  where p.id = p_product_id
  returning * into v_product;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  return elzonki.product_json(v_product);
end;
$$;

create or replace function public.app_upsert_spare_part(p_token text, p_row jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_id text;
  v_machine_id text;
  v_code text;
  v_name text;
  v_part elzonki.spare_parts;
begin
  if p_row is null or jsonb_typeof(p_row) <> 'object' then
    raise exception 'INVALID_ROW';
  end if;
  v_id := nullif(trim(coalesce(p_row->>'id', '')), '');
  v_machine_id := nullif(trim(coalesce(p_row->>'machineId', '')), '');
  v_code := nullif(trim(coalesce(p_row->>'code', '')), '');
  v_name := nullif(trim(coalesce(p_row->>'name', '')), '');
  if v_id is null or v_machine_id is null or v_code is null or v_name is null then
    raise exception 'INVALID_ROW';
  end if;
  if not exists (select 1 from elzonki.machinery m where m.id = v_machine_id) then
    raise exception 'MACHINE_NOT_FOUND';
  end if;
  if exists (
    select 1 from elzonki.spare_parts s
    where s.machine_id = v_machine_id and s.code = v_code and s.id <> v_id
  ) then
    raise exception 'CODE_TAKEN';
  end if;

  if exists (select 1 from elzonki.spare_parts s where s.id = v_id) then
    perform elzonki.require_permission(p_token, 'data.machinery.edit');
  else
    perform elzonki.require_permission(p_token, 'data.machinery.create');
  end if;

  insert into elzonki.spare_parts (
    id, machine_id, code, name, unit_cost, stock_qty,
    replacement_interval_hours, notes, updated_at
  ) values (
    v_id,
    v_machine_id,
    v_code,
    v_name,
    coalesce((p_row->>'unitCost')::numeric, 0),
    coalesce((p_row->>'stockQty')::numeric, 0),
    coalesce((p_row->>'replacementIntervalHours')::numeric, 0),
    coalesce(p_row->>'notes', ''),
    now()
  )
  on conflict (id) do update set
    machine_id = excluded.machine_id,
    code = excluded.code,
    name = excluded.name,
    unit_cost = excluded.unit_cost,
    stock_qty = excluded.stock_qty,
    replacement_interval_hours = excluded.replacement_interval_hours,
    notes = excluded.notes,
    updated_at = now()
  returning * into v_part;

  return elzonki.spare_part_json(v_part);
end;
$$;

create or replace function public.app_delete_spare_part(p_token text, p_id text)
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform elzonki.require_permission(p_token, 'data.machinery.edit');
  delete from elzonki.spare_parts s where s.id = p_id;
end;
$$;

create or replace function public.app_set_factory_image(
  p_token text,
  p_owner_table text,
  p_owner_id text,
  p_data_url text
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_table text;
  v_owner_id text;
  v_image elzonki.images;
begin
  v_table := lower(trim(coalesce(p_owner_table, '')));
  v_owner_id := nullif(trim(coalesce(p_owner_id, '')), '');
  if v_table not in ('products', 'machinery', 'molds', 'accessories') then
    raise exception 'INVALID_TABLE';
  end if;
  if v_owner_id is null then
    raise exception 'INVALID_ROW';
  end if;
  if p_data_url is null
    or left(p_data_url, 11) <> 'data:image/'
    or length(p_data_url) > 450000 then
    raise exception 'INVALID_IMAGE';
  end if;

  perform elzonki.require_permission(p_token, 'data.' || v_table || '.edit');

  if v_table = 'products' then
    if not exists (select 1 from elzonki.products x where x.id = v_owner_id) then
      raise exception 'OWNER_NOT_FOUND';
    end if;
  elsif v_table = 'machinery' then
    if not exists (select 1 from elzonki.machinery x where x.id = v_owner_id) then
      raise exception 'OWNER_NOT_FOUND';
    end if;
  elsif v_table = 'molds' then
    if not exists (select 1 from elzonki.molds x where x.id = v_owner_id) then
      raise exception 'OWNER_NOT_FOUND';
    end if;
  elsif v_table = 'accessories' then
    if not exists (select 1 from elzonki.accessories x where x.id = v_owner_id) then
      raise exception 'OWNER_NOT_FOUND';
    end if;
  end if;

  insert into elzonki.images (owner_table, owner_id, data_url, updated_at)
  values (v_table, v_owner_id, p_data_url, now())
  on conflict (owner_table, owner_id) do update set
    data_url = excluded.data_url,
    updated_at = now()
  returning * into v_image;

  return elzonki.image_json(v_image);
end;
$$;

create or replace function public.app_delete_factory_image(
  p_token text,
  p_owner_table text,
  p_owner_id text
)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_table text;
begin
  v_table := lower(trim(coalesce(p_owner_table, '')));
  if v_table not in ('products', 'machinery', 'molds', 'accessories') then
    raise exception 'INVALID_TABLE';
  end if;
  perform elzonki.require_permission(p_token, 'data.' || v_table || '.edit');
  delete from elzonki.images i
  where i.owner_table = v_table and i.owner_id = p_owner_id;
end;
$$;

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
  v_can_spare_parts boolean := false;
  v_can_packaging boolean := false;
  v_can_costs boolean := false;
  v_can_inspections boolean := false;
  v_products jsonb := '[]'::jsonb;
  v_raw jsonb := '[]'::jsonb;
  v_accessories jsonb := '[]'::jsonb;
  v_molds jsonb := '[]'::jsonb;
  v_machinery jsonb := '[]'::jsonb;
  v_spare_parts jsonb := '[]'::jsonb;
  v_images jsonb := '[]'::jsonb;
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
  v_can_spare_parts := elzonki.has_permission(v_uid, 'data.machinery.view');

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

  if v_can_spare_parts then
    select coalesce(jsonb_agg(elzonki.spare_part_json(s) order by s.machine_id, s.code), '[]'::jsonb)
    into v_spare_parts from elzonki.spare_parts s;
  end if;

  select coalesce(jsonb_agg(elzonki.image_json(i) order by i.owner_table, i.owner_id), '[]'::jsonb)
  into v_images
  from elzonki.images i
  where (i.owner_table = 'products' and v_can_products)
     or (i.owner_table = 'accessories' and v_can_accessories)
     or (i.owner_table = 'molds' and v_can_molds)
     or (i.owner_table = 'machinery' and v_can_machinery);

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
    'spareParts', v_spare_parts,
    'images', v_images,
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
      'spareParts', v_can_spare_parts,
      'packaging', v_can_packaging,
      'costElements', v_can_costs,
      'inspections', v_can_inspections
    )
  );
end;
$$;

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
  delete from elzonki.images i
  where i.owner_table = p_table and i.owner_id = p_id;

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
    elzonki.images,
    elzonki.spare_parts,
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

grant execute on function public.app_update_product_stages(text, text, jsonb, jsonb)
  to anon, authenticated;
grant execute on function public.app_upsert_spare_part(text, jsonb)
  to anon, authenticated;
grant execute on function public.app_delete_spare_part(text, text)
  to anon, authenticated;
grant execute on function public.app_set_factory_image(text, text, text, text)
  to anon, authenticated;
grant execute on function public.app_delete_factory_image(text, text, text)
  to anon, authenticated;
grant execute on function public.app_factory_bootstrap(text) to anon, authenticated;
grant execute on function public.app_delete_factory_row(text, text, text) to anon, authenticated;
grant execute on function public.app_replace_factory_data(text, jsonb) to anon, authenticated;
