-- مزامنة بيانات المصنع بين الأجهزة
-- الجداول: المنتجات، الخامات، الإكسسوارات، التعبئة، عناصر التكلفة، الإعدادات.

create table if not exists elzonki.products (
  id text primary key,
  code text not null unique,
  name text not null,
  family text not null default 'باور',
  size_cm numeric not null default 0,
  height_cm numeric not null default 0,
  capacity_l numeric not null default 0,
  net_weight_kg numeric not null default 0,
  gross_weight_kg numeric not null default 0,
  cbm numeric not null default 0,
  pcs_per_carton integer not null default 0,
  barcode text not null default '',
  stage_machines jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.raw_materials (
  id text primary key,
  code text not null unique,
  name text not null,
  alloy text not null default '',
  diameter_cm numeric not null default 0,
  thickness_mm numeric not null default 0,
  disc_weight_kg numeric not null default 0,
  waste_pct numeric not null default 0,
  price_per_kg numeric not null default 0,
  product_codes text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.accessories (
  id text primary key,
  code text not null unique,
  name text not null,
  material text not null default '',
  qty_per_product numeric not null default 0,
  unit_cost numeric not null default 0,
  origin text not null default '',
  product_codes text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.packaging (
  id text primary key,
  code text not null unique,
  name text not null,
  length_cm numeric not null default 0,
  width_cm numeric not null default 0,
  height_cm numeric not null default 0,
  empty_weight_kg numeric not null default 0,
  unit_cost numeric not null default 0,
  pcs_inside integer not null default 0,
  product_codes text[] not null default '{}'::text[],
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.cost_elements (
  id text primary key,
  product_code text not null unique references elzonki.products(code) on update cascade on delete cascade,
  raw_material numeric not null default 0,
  accessories numeric not null default 0,
  plastics numeric not null default 0,
  carton numeric not null default 0,
  labor numeric not null default 0,
  overhead numeric not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists elzonki.settings (
  singleton boolean primary key default true check (singleton),
  margin_pct numeric not null default 22,
  aluminum_factor numeric not null default 1,
  updated_at timestamptz not null default now()
);

insert into elzonki.settings (singleton, margin_pct, aluminum_factor)
values (true, 22, 1)
on conflict (singleton) do nothing;

create index if not exists products_code_idx on elzonki.products (code);
create index if not exists raw_materials_code_idx on elzonki.raw_materials (code);
create index if not exists accessories_code_idx on elzonki.accessories (code);
create index if not exists packaging_code_idx on elzonki.packaging (code);
create index if not exists cost_elements_product_idx on elzonki.cost_elements (product_code);

alter table elzonki.products enable row level security;
alter table elzonki.raw_materials enable row level security;
alter table elzonki.accessories enable row level security;
alter table elzonki.packaging enable row level security;
alter table elzonki.cost_elements enable row level security;
alter table elzonki.settings enable row level security;

-- الوصول مسموح فقط عبر RPCs التي تتحقق من الجلسة والصلاحية.
revoke all on table elzonki.products from anon, authenticated;
revoke all on table elzonki.raw_materials from anon, authenticated;
revoke all on table elzonki.accessories from anon, authenticated;
revoke all on table elzonki.packaging from anon, authenticated;
revoke all on table elzonki.cost_elements from anon, authenticated;
revoke all on table elzonki.settings from anon, authenticated;

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
    'stageMachines', coalesce(p.stage_machines, '{}'::jsonb)
  );
$$;

create or replace function elzonki.raw_material_json(p elzonki.raw_materials)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'alloy', p.alloy,
    'diameterCm', p.diameter_cm,
    'thicknessMm', p.thickness_mm,
    'discWeightKg', p.disc_weight_kg,
    'wastePct', p.waste_pct,
    'pricePerKg', p.price_per_kg,
    'productCodes', to_jsonb(p.product_codes)
  );
$$;

create or replace function elzonki.accessory_json(p elzonki.accessories)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'material', p.material,
    'qtyPerProduct', p.qty_per_product,
    'unitCost', p.unit_cost,
    'origin', p.origin,
    'productCodes', to_jsonb(p.product_codes)
  );
$$;

create or replace function elzonki.packaging_json(p elzonki.packaging)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'lengthCm', p.length_cm,
    'widthCm', p.width_cm,
    'heightCm', p.height_cm,
    'emptyWeightKg', p.empty_weight_kg,
    'unitCost', p.unit_cost,
    'pcsInside', p.pcs_inside,
    'productCodes', to_jsonb(p.product_codes)
  );
$$;

create or replace function elzonki.cost_element_json(p elzonki.cost_elements)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'id', p.id,
    'productCode', p.product_code,
    'rawMaterial', p.raw_material,
    'accessories', p.accessories,
    'plastics', p.plastics,
    'carton', p.carton,
    'labor', p.labor,
    'overhead', p.overhead
  );
$$;

create or replace function elzonki.settings_json(p elzonki.settings)
returns jsonb
language sql stable
set search_path to ''
as $$
  select jsonb_build_object(
    'marginPct', p.margin_pct,
    'aluminumFactor', p.aluminum_factor
  );
$$;

grant execute on function elzonki.product_json(elzonki.products) to anon, authenticated;
grant execute on function elzonki.raw_material_json(elzonki.raw_materials) to anon, authenticated;
grant execute on function elzonki.accessory_json(elzonki.accessories) to anon, authenticated;
grant execute on function elzonki.packaging_json(elzonki.packaging) to anon, authenticated;
grant execute on function elzonki.cost_element_json(elzonki.cost_elements) to anon, authenticated;
grant execute on function elzonki.settings_json(elzonki.settings) to anon, authenticated;
