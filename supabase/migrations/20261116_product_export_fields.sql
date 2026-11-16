-- حقول التصدير اختيارية وقابلة للتعديل من بطاقة المنتج.
alter table elzonki.products
  add column if not exists hs_code text not null default '',
  add column if not exists origin_country text not null default '',
  add column if not exists export_destination text not null default '';

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
    'hsCode', p.hs_code,
    'originCountry', p.origin_country,
    'exportDestination', p.export_destination,
    'stageMachines', coalesce(p.stage_machines, '{}'::jsonb),
    'stageOverrides', coalesce(p.stage_overrides, '{}'::jsonb)
  );
$$;

-- نحتفظ بالنواة القديمة للجداول الأخرى، ونعيد تعريف مسار المنتجات فقط.
alter function public.app_upsert_factory_rows_core(text, text, jsonb)
  rename to app_upsert_factory_rows_core_legacy;

create or replace function public.app_upsert_factory_rows_core(
  p_token text,
  p_table text,
  p_rows jsonb
)
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
  v_old_code text;
  v_result jsonb := '[]'::jsonb;
  v_product elzonki.products;
begin
  if p_table <> 'products' then
    return public.app_upsert_factory_rows_core_legacy(p_token, p_table, p_rows);
  end if;
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'INVALID_ROWS';
  end if;
  if jsonb_array_length(p_rows) > 500 then
    raise exception 'TOO_MANY_ROWS';
  end if;
  if jsonb_array_length(p_rows) = 0 then
    return v_result;
  end if;

  for v_row in select value from jsonb_array_elements(p_rows) loop
    v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
    v_code := nullif(trim(coalesce(v_row->>'code', '')), '');
    v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
    if v_id is null or v_code is null or v_name is null then
      raise exception 'INVALID_ROW';
    end if;
    if exists (select 1 from elzonki.products p where p.code = v_code and p.id <> v_id) then
      raise exception 'CODE_TAKEN';
    end if;

    if exists (select 1 from elzonki.products p where p.id = v_id) then
      perform elzonki.require_permission(p_token, 'data.products.edit');
    else
      perform elzonki.require_permission(p_token, 'data.products.create');
    end if;

    select p.code into v_old_code from elzonki.products p where p.id = v_id;

    insert into elzonki.products (
      id, code, name, family, size_cm, height_cm, capacity_l, net_weight_kg,
      gross_weight_kg, cbm, pcs_per_carton, barcode,
      hs_code, origin_country, export_destination,
      stage_machines, updated_at
    ) values (
      v_id,
      v_code,
      v_name,
      coalesce(nullif(trim(v_row->>'family'), ''), 'باور'),
      coalesce((v_row->>'sizeCm')::numeric, 0),
      coalesce((v_row->>'heightCm')::numeric, 0),
      coalesce((v_row->>'capacityL')::numeric, 0),
      coalesce((v_row->>'netWeightKg')::numeric, 0),
      coalesce((v_row->>'grossWeightKg')::numeric, 0),
      coalesce((v_row->>'cbm')::numeric, 0),
      coalesce((v_row->>'pcsPerCarton')::integer, 0),
      coalesce(v_row->>'barcode', ''),
      coalesce(v_row->>'hsCode', ''),
      coalesce(v_row->>'originCountry', ''),
      coalesce(v_row->>'exportDestination', ''),
      case when jsonb_typeof(v_row->'stageMachines') = 'object'
        then v_row->'stageMachines' else '{}'::jsonb end,
      now()
    )
    on conflict (id) do update set
      code = excluded.code,
      name = excluded.name,
      family = excluded.family,
      size_cm = excluded.size_cm,
      height_cm = excluded.height_cm,
      capacity_l = excluded.capacity_l,
      net_weight_kg = excluded.net_weight_kg,
      gross_weight_kg = excluded.gross_weight_kg,
      cbm = excluded.cbm,
      pcs_per_carton = excluded.pcs_per_carton,
      barcode = excluded.barcode,
      hs_code = excluded.hs_code,
      origin_country = excluded.origin_country,
      export_destination = excluded.export_destination,
      stage_machines = excluded.stage_machines,
      updated_at = now()
    returning * into v_product;

    if v_old_code is not null and v_old_code <> v_code then
      update elzonki.raw_materials
      set product_codes = array_replace(product_codes, v_old_code, v_code), updated_at = now()
      where v_old_code = any(product_codes);
      update elzonki.packaging
      set product_codes = array_replace(product_codes, v_old_code, v_code), updated_at = now()
      where v_old_code = any(product_codes);
      update elzonki.accessories
      set product_codes = array_replace(product_codes, v_old_code, v_code), updated_at = now()
      where v_old_code = any(product_codes);
    end if;

    v_result := v_result || jsonb_build_array(elzonki.product_json(v_product));
  end loop;

  return v_result;
end;
$$;

revoke all on function public.app_upsert_factory_rows_core(text, text, jsonb) from public;
revoke all on function public.app_upsert_factory_rows_core_legacy(text, text, jsonb) from public;
