-- RPCs مزامنة بيانات المصنع.
-- كل دالة تتحقق من جلسة التطبيق ومن صلاحية data.<table>.<action>.

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
  v_can_packaging boolean := false;
  v_can_costs boolean := false;
  v_products jsonb := '[]'::jsonb;
  v_raw jsonb := '[]'::jsonb;
  v_accessories jsonb := '[]'::jsonb;
  v_packaging jsonb := '[]'::jsonb;
  v_costs jsonb := '[]'::jsonb;
  v_settings jsonb := null;
begin
  v_uid := elzonki.require_user(p_token);
  v_can_products := elzonki.has_permission(v_uid, 'data.products.view');
  v_can_raw := elzonki.has_permission(v_uid, 'data.rawMaterials.view');
  v_can_accessories := elzonki.has_permission(v_uid, 'data.accessories.view');
  v_can_packaging := elzonki.has_permission(v_uid, 'data.packaging.view');
  v_can_costs := elzonki.has_permission(v_uid, 'data.costElements.view');

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

  return jsonb_build_object(
    'products', v_products,
    'rawMaterials', v_raw,
    'accessories', v_accessories,
    'packaging', v_packaging,
    'costElements', v_costs,
    'settings', v_settings,
    'visible', jsonb_build_object(
      'products', v_can_products,
      'rawMaterials', v_can_raw,
      'accessories', v_can_accessories,
      'packaging', v_can_packaging,
      'costElements', v_can_costs
    )
  );
end;
$$;

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
declare
  v_row jsonb;
  v_id text;
  v_code text;
  v_name text;
  v_old_code text;
  v_product_code text;
  v_result jsonb := '[]'::jsonb;
  v_product elzonki.products;
  v_raw elzonki.raw_materials;
  v_accessory elzonki.accessories;
  v_packaging elzonki.packaging;
  v_cost elzonki.cost_elements;
begin
  if p_table not in ('products','rawMaterials','accessories','packaging','costElements') then
    raise exception 'INVALID_TABLE';
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

  if p_table = 'products' then
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
        gross_weight_kg, cbm, pcs_per_carton, barcode, stage_machines, updated_at
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
  end if;

  if p_table = 'rawMaterials' then
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
      v_code := nullif(trim(coalesce(v_row->>'code', '')), '');
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      if v_id is null or v_code is null or v_name is null then raise exception 'INVALID_ROW'; end if;
      if exists (select 1 from elzonki.raw_materials r where r.code = v_code and r.id <> v_id) then
        raise exception 'CODE_TAKEN';
      end if;
      if exists (select 1 from elzonki.raw_materials r where r.id = v_id) then
        perform elzonki.require_permission(p_token, 'data.rawMaterials.edit');
      else
        perform elzonki.require_permission(p_token, 'data.rawMaterials.create');
      end if;

      insert into elzonki.raw_materials (
        id, code, name, alloy, diameter_cm, thickness_mm, disc_weight_kg,
        waste_pct, price_per_kg, product_codes, updated_at
      ) values (
        v_id, v_code, v_name,
        coalesce(v_row->>'alloy', ''),
        coalesce((v_row->>'diameterCm')::numeric, 0),
        coalesce((v_row->>'thicknessMm')::numeric, 0),
        coalesce((v_row->>'discWeightKg')::numeric, 0),
        coalesce((v_row->>'wastePct')::numeric, 0),
        coalesce((v_row->>'pricePerKg')::numeric, 0),
        case when jsonb_typeof(v_row->'productCodes') = 'array'
          then array(select jsonb_array_elements_text(v_row->'productCodes'))
          else '{}'::text[] end,
        now()
      )
      on conflict (id) do update set
        code = excluded.code, name = excluded.name, alloy = excluded.alloy,
        diameter_cm = excluded.diameter_cm, thickness_mm = excluded.thickness_mm,
        disc_weight_kg = excluded.disc_weight_kg, waste_pct = excluded.waste_pct,
        price_per_kg = excluded.price_per_kg, product_codes = excluded.product_codes,
        updated_at = now()
      returning * into v_raw;
      v_result := v_result || jsonb_build_array(elzonki.raw_material_json(v_raw));
    end loop;
    return v_result;
  end if;

  if p_table = 'accessories' then
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
      v_code := nullif(trim(coalesce(v_row->>'code', '')), '');
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      if v_id is null or v_code is null or v_name is null then raise exception 'INVALID_ROW'; end if;
      if exists (select 1 from elzonki.accessories a where a.code = v_code and a.id <> v_id) then
        raise exception 'CODE_TAKEN';
      end if;
      if exists (select 1 from elzonki.accessories a where a.id = v_id) then
        perform elzonki.require_permission(p_token, 'data.accessories.edit');
      else
        perform elzonki.require_permission(p_token, 'data.accessories.create');
      end if;

      insert into elzonki.accessories (
        id, code, name, material, qty_per_product, unit_cost, origin, product_codes, updated_at
      ) values (
        v_id, v_code, v_name,
        coalesce(v_row->>'material', ''),
        coalesce((v_row->>'qtyPerProduct')::numeric, 0),
        coalesce((v_row->>'unitCost')::numeric, 0),
        coalesce(v_row->>'origin', ''),
        case when jsonb_typeof(v_row->'productCodes') = 'array'
          then array(select jsonb_array_elements_text(v_row->'productCodes'))
          else '{}'::text[] end,
        now()
      )
      on conflict (id) do update set
        code = excluded.code, name = excluded.name, material = excluded.material,
        qty_per_product = excluded.qty_per_product, unit_cost = excluded.unit_cost,
        origin = excluded.origin, product_codes = excluded.product_codes, updated_at = now()
      returning * into v_accessory;
      v_result := v_result || jsonb_build_array(elzonki.accessory_json(v_accessory));
    end loop;
    return v_result;
  end if;

  if p_table = 'packaging' then
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
      v_code := nullif(trim(coalesce(v_row->>'code', '')), '');
      v_name := nullif(trim(coalesce(v_row->>'name', '')), '');
      if v_id is null or v_code is null or v_name is null then raise exception 'INVALID_ROW'; end if;
      if exists (select 1 from elzonki.packaging p where p.code = v_code and p.id <> v_id) then
        raise exception 'CODE_TAKEN';
      end if;
      if exists (select 1 from elzonki.packaging p where p.id = v_id) then
        perform elzonki.require_permission(p_token, 'data.packaging.edit');
      else
        perform elzonki.require_permission(p_token, 'data.packaging.create');
      end if;

      insert into elzonki.packaging (
        id, code, name, length_cm, width_cm, height_cm, empty_weight_kg,
        unit_cost, pcs_inside, product_codes, updated_at
      ) values (
        v_id, v_code, v_name,
        coalesce((v_row->>'lengthCm')::numeric, 0),
        coalesce((v_row->>'widthCm')::numeric, 0),
        coalesce((v_row->>'heightCm')::numeric, 0),
        coalesce((v_row->>'emptyWeightKg')::numeric, 0),
        coalesce((v_row->>'unitCost')::numeric, 0),
        coalesce((v_row->>'pcsInside')::integer, 0),
        case when jsonb_typeof(v_row->'productCodes') = 'array'
          then array(select jsonb_array_elements_text(v_row->'productCodes'))
          else '{}'::text[] end,
        now()
      )
      on conflict (id) do update set
        code = excluded.code, name = excluded.name, length_cm = excluded.length_cm,
        width_cm = excluded.width_cm, height_cm = excluded.height_cm,
        empty_weight_kg = excluded.empty_weight_kg, unit_cost = excluded.unit_cost,
        pcs_inside = excluded.pcs_inside, product_codes = excluded.product_codes,
        updated_at = now()
      returning * into v_packaging;
      v_result := v_result || jsonb_build_array(elzonki.packaging_json(v_packaging));
    end loop;
    return v_result;
  end if;

  if p_table = 'costElements' then
    for v_row in select value from jsonb_array_elements(p_rows) loop
      v_id := nullif(trim(coalesce(v_row->>'id', '')), '');
      v_product_code := nullif(trim(coalesce(v_row->>'productCode', '')), '');
      if v_id is null or v_product_code is null then raise exception 'INVALID_ROW'; end if;
      if not exists (select 1 from elzonki.products p where p.code = v_product_code) then
        raise exception 'PRODUCT_NOT_FOUND';
      end if;
      if exists (select 1 from elzonki.cost_elements c where c.product_code = v_product_code and c.id <> v_id) then
        raise exception 'COST_EXISTS';
      end if;
      if exists (select 1 from elzonki.cost_elements c where c.id = v_id) then
        perform elzonki.require_permission(p_token, 'data.costElements.edit');
      else
        perform elzonki.require_permission(p_token, 'data.costElements.create');
      end if;

      insert into elzonki.cost_elements (
        id, product_code, raw_material, accessories, plastics, carton, labor, overhead, updated_at
      ) values (
        v_id, v_product_code,
        coalesce((v_row->>'rawMaterial')::numeric, 0),
        coalesce((v_row->>'accessories')::numeric, 0),
        coalesce((v_row->>'plastics')::numeric, 0),
        coalesce((v_row->>'carton')::numeric, 0),
        coalesce((v_row->>'labor')::numeric, 0),
        coalesce((v_row->>'overhead')::numeric, 0),
        now()
      )
      on conflict (id) do update set
        product_code = excluded.product_code, raw_material = excluded.raw_material,
        accessories = excluded.accessories, plastics = excluded.plastics,
        carton = excluded.carton, labor = excluded.labor,
        overhead = excluded.overhead, updated_at = now()
      returning * into v_cost;
      v_result := v_result || jsonb_build_array(elzonki.cost_element_json(v_cost));
    end loop;
    return v_result;
  end if;

  raise exception 'INVALID_TABLE';
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
declare
  v_code text;
begin
  if p_table = 'products' then
    perform elzonki.require_permission(p_token, 'data.products.delete');
    delete from elzonki.products p where p.id = p_id returning p.code into v_code;
    if v_code is not null then
      update elzonki.raw_materials
      set product_codes = array_remove(product_codes, v_code), updated_at = now()
      where v_code = any(product_codes);
      update elzonki.packaging
      set product_codes = array_remove(product_codes, v_code), updated_at = now()
      where v_code = any(product_codes);
      update elzonki.accessories
      set product_codes = array_remove(product_codes, v_code), updated_at = now()
      where v_code = any(product_codes);
    end if;
    return;
  end if;

  if p_table = 'rawMaterials' then
    perform elzonki.require_permission(p_token, 'data.rawMaterials.delete');
    delete from elzonki.raw_materials r where r.id = p_id;
    return;
  end if;

  if p_table = 'accessories' then
    perform elzonki.require_permission(p_token, 'data.accessories.delete');
    delete from elzonki.accessories a where a.id = p_id;
    return;
  end if;

  if p_table = 'packaging' then
    perform elzonki.require_permission(p_token, 'data.packaging.delete');
    delete from elzonki.packaging p where p.id = p_id;
    return;
  end if;

  if p_table = 'costElements' then
    perform elzonki.require_permission(p_token, 'data.costElements.delete');
    delete from elzonki.cost_elements c where c.id = p_id;
    return;
  end if;

  raise exception 'INVALID_TABLE';
end;
$$;

create or replace function public.app_update_factory_settings(
  p_token text,
  p_margin_pct numeric,
  p_aluminum_factor numeric
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_settings elzonki.settings;
  v_margin numeric;
  v_factor numeric;
begin
  perform elzonki.require_permission(p_token, 'settings.edit');
  select * into v_settings from elzonki.settings s where s.singleton;
  v_margin := coalesce(p_margin_pct, v_settings.margin_pct, 22);
  v_factor := coalesce(p_aluminum_factor, v_settings.aluminum_factor, 1);
  if v_margin < 0 or v_margin > 90 then raise exception 'INVALID_SETTINGS'; end if;
  if v_factor < 0.5 or v_factor > 2 then raise exception 'INVALID_SETTINGS'; end if;

  insert into elzonki.settings (singleton, margin_pct, aluminum_factor, updated_at)
  values (true, v_margin, v_factor, now())
  on conflict (singleton) do update set
    margin_pct = excluded.margin_pct,
    aluminum_factor = excluded.aluminum_factor,
    updated_at = now()
  returning * into v_settings;

  return elzonki.settings_json(v_settings);
end;
$$;

create or replace function public.app_replace_factory_data(p_token text, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform elzonki.require_permission(p_token, 'settings.reset_demo');
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'INVALID_ROWS';
  end if;

  truncate table elzonki.cost_elements, elzonki.products, elzonki.raw_materials, elzonki.accessories, elzonki.packaging;

  perform public.app_upsert_factory_rows(p_token, 'products', coalesce(p_payload->'products', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'rawMaterials', coalesce(p_payload->'rawMaterials', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'accessories', coalesce(p_payload->'accessories', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'packaging', coalesce(p_payload->'packaging', '[]'::jsonb));
  perform public.app_upsert_factory_rows(p_token, 'costElements', coalesce(p_payload->'costElements', '[]'::jsonb));
  perform public.app_update_factory_settings(
    p_token,
    (p_payload->'settings'->>'marginPct')::numeric,
    (p_payload->'settings'->>'aluminumFactor')::numeric
  );

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.app_factory_bootstrap(text) to anon, authenticated;
grant execute on function public.app_upsert_factory_rows(text, text, jsonb) to anon, authenticated;
grant execute on function public.app_delete_factory_row(text, text, text) to anon, authenticated;
grant execute on function public.app_update_factory_settings(text, numeric, numeric) to anon, authenticated;
grant execute on function public.app_replace_factory_data(text, jsonb) to anon, authenticated;
