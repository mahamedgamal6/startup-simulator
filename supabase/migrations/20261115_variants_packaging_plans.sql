-- Product variants (size/color), packaging component metadata, production plans,
-- and the 0-200% pricing range. Additive and safe to re-run.

-- ---------------------------------------------------------------------------
-- 1) Products: sizes, colors, variant combinations, soft archive flag
-- ---------------------------------------------------------------------------
alter table elzonki.products
  add column if not exists sizes jsonb not null default '[]'::jsonb,
  add column if not exists colors jsonb not null default '[]'::jsonb,
  add column if not exists variants jsonb not null default '[]'::jsonb,
  add column if not exists archived boolean not null default false;

-- ---------------------------------------------------------------------------
-- 2) Packaging components: full descriptive fields + consumption quantity
-- ---------------------------------------------------------------------------
alter table elzonki.packaging
  add column if not exists type text not null default 'مادة تغليف',
  add column if not exists material text not null default '',
  add column if not exists description text not null default '',
  add column if not exists unit text not null default 'قطعة',
  add column if not exists supplier text not null default '',
  add column if not exists min_stock numeric(14,2) not null default 0,
  add column if not exists stage text not null default 'inner',
  add column if not exists qty_per_product numeric(14,4);

alter table elzonki.packaging
  drop constraint if exists packaging_stage_check;
alter table elzonki.packaging
  add constraint packaging_stage_check check (stage in ('inner', 'outer', 'shipping'));

-- ---------------------------------------------------------------------------
-- 3) Settings: pricing mode + margin range 0..200
-- ---------------------------------------------------------------------------
alter table elzonki.settings
  add column if not exists pricing_mode text not null default 'margin';

alter table elzonki.settings
  drop constraint if exists settings_margin_pct_check;
alter table elzonki.settings
  add constraint settings_margin_pct_check check (margin_pct >= 0 and margin_pct <= 200);

create or replace function elzonki.app_update_factory_settings(
  p_token text,
  p_margin_pct numeric,
  p_aluminum_factor numeric
)
returns jsonb
language plpgsql
security definer
set search_path = elzonki, extensions, public
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
  if v_margin < 0 or v_margin > 200 then raise exception 'INVALID_SETTINGS'; end if;
  if v_factor < 0.5 or v_factor > 2 then raise exception 'INVALID_SETTINGS'; end if;

  insert into elzonki.settings (singleton, margin_pct, aluminum_factor, pricing_mode, updated_at)
  values (true, v_margin, v_factor, coalesce(v_settings.pricing_mode, 'margin'), now())
  on conflict (singleton) do update set
    margin_pct = excluded.margin_pct,
    aluminum_factor = excluded.aluminum_factor,
    updated_at = now()
  returning * into v_settings;

  return elzonki.settings_json(v_settings);
end;
$$;

create or replace function elzonki.app_update_pricing_mode(
  p_token text,
  p_mode text
)
returns jsonb
language plpgsql
security definer
set search_path = elzonki, extensions, public
as $$
declare
  v_settings elzonki.settings;
begin
  perform elzonki.require_permission(p_token, 'settings.edit');
  if p_mode not in ('margin', 'markup') then raise exception 'INVALID_SETTINGS'; end if;
  update elzonki.settings
     set pricing_mode = p_mode, updated_at = now()
   where singleton
  returning * into v_settings;
  return elzonki.settings_json(v_settings);
end;
$$;

-- ---------------------------------------------------------------------------
-- 4) Production plans
-- ---------------------------------------------------------------------------
create table if not exists elzonki.production_plans (
  id text primary key,
  code text not null default '',
  name text not null default '',
  status text not null default 'draft',
  owner text not null default '',
  factory text not null default '',
  line text not null default '',
  shift text not null default '',
  start_date date,
  target_days numeric(10,2) not null default 0,
  notes text not null default '',
  shift_hours numeric(6,2) not null default 8,
  shifts_per_day numeric(6,2) not null default 1,
  machines_available numeric(8,2) not null default 1,
  planned_downtime_pct numeric(6,2) not null default 0,
  setup_hours numeric(8,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  snapshot jsonb,
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table elzonki.production_plans enable row level security;
revoke all on table elzonki.production_plans from anon, authenticated;

create or replace function elzonki.production_plan_to_json(p elzonki.production_plans)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'status', p.status,
    'owner', p.owner,
    'factory', p.factory,
    'line', p.line,
    'shift', p.shift,
    'startDate', coalesce(p.start_date::text, ''),
    'targetDays', p.target_days,
    'notes', p.notes,
    'shiftHours', p.shift_hours,
    'shiftsPerDay', p.shifts_per_day,
    'machinesAvailable', p.machines_available,
    'plannedDowntimePct', p.planned_downtime_pct,
    'setupHours', p.setup_hours,
    'items', coalesce(p.items, '[]'::jsonb),
    'snapshot', p.snapshot,
    'approvedAt', p.approved_at,
    'approvedBy', p.approved_by,
    'createdAt', p.created_at
  );
$$;

create or replace function elzonki.app_update_product_variants(
  p_token text,
  p_product_id text,
  p_sizes jsonb,
  p_colors jsonb,
  p_variants jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = elzonki, extensions, public
as $$
declare
  v_user elzonki.app_users;
begin
  v_user := elzonki.require_permission(p_token, 'data.products.edit');
  update elzonki.products
     set sizes = case when jsonb_typeof(p_sizes) = 'array' then p_sizes else '[]'::jsonb end,
         colors = case when jsonb_typeof(p_colors) = 'array' then p_colors else '[]'::jsonb end,
         variants = case when jsonb_typeof(p_variants) = 'array' then p_variants else '[]'::jsonb end,
         updated_at = now()
   where id = p_product_id;
  if not found then raise exception 'PRODUCT_NOT_FOUND'; end if;
  perform elzonki.app_log(v_user.id, 'upsert', 'productVariants', p_product_id, jsonb_build_object('variants', jsonb_array_length(coalesce(p_variants, '[]'::jsonb))));
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function elzonki.app_upsert_production_plan(
  p_token text,
  p_plan jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = elzonki, extensions, public
as $$
declare
  v_user elzonki.app_users;
  v_saved elzonki.production_plans;
begin
  if p_plan is null or jsonb_typeof(p_plan) <> 'object' then
    raise exception 'INVALID_ROW';
  end if;
  v_user := elzonki.require_permission(p_token, 'planning.create');
  if coalesce(p_plan->>'id', '') = '' then raise exception 'INVALID_ROW'; end if;

  insert into elzonki.production_plans (
    id, code, name, status, owner, factory, line, shift, start_date, target_days, notes,
    shift_hours, shifts_per_day, machines_available, planned_downtime_pct, setup_hours,
    items, snapshot, approved_at, approved_by, updated_at
  ) values (
    p_plan->>'id',
    coalesce(p_plan->>'code', ''),
    coalesce(p_plan->>'name', ''),
    coalesce(p_plan->>'status', 'draft'),
    coalesce(p_plan->>'owner', ''),
    coalesce(p_plan->>'factory', ''),
    coalesce(p_plan->>'line', ''),
    coalesce(p_plan->>'shift', ''),
    nullif(p_plan->>'startDate', '')::date,
    coalesce(nullif(p_plan->>'targetDays', '')::numeric, 0),
    coalesce(p_plan->>'notes', ''),
    coalesce(nullif(p_plan->>'shiftHours', '')::numeric, 8),
    coalesce(nullif(p_plan->>'shiftsPerDay', '')::numeric, 1),
    coalesce(nullif(p_plan->>'machinesAvailable', '')::numeric, 1),
    coalesce(nullif(p_plan->>'plannedDowntimePct', '')::numeric, 0),
    coalesce(nullif(p_plan->>'setupHours', '')::numeric, 0),
    case when jsonb_typeof(p_plan->'items') = 'array' then p_plan->'items' else '[]'::jsonb end,
    case when jsonb_typeof(p_plan->'snapshot') = 'object' then p_plan->'snapshot' else null end,
    nullif(p_plan->>'approvedAt', '')::timestamptz,
    nullif(p_plan->>'approvedBy', ''),
    now()
  )
  on conflict (id) do update set
    code = excluded.code,
    name = excluded.name,
    status = excluded.status,
    owner = excluded.owner,
    factory = excluded.factory,
    line = excluded.line,
    shift = excluded.shift,
    start_date = excluded.start_date,
    target_days = excluded.target_days,
    notes = excluded.notes,
    shift_hours = excluded.shift_hours,
    shifts_per_day = excluded.shifts_per_day,
    machines_available = excluded.machines_available,
    planned_downtime_pct = excluded.planned_downtime_pct,
    setup_hours = excluded.setup_hours,
    items = excluded.items,
    snapshot = excluded.snapshot,
    approved_at = excluded.approved_at,
    approved_by = excluded.approved_by,
    updated_at = now()
  returning * into v_saved;

  perform elzonki.app_log(v_user.id, 'upsert', 'productionPlans', v_saved.id, jsonb_build_object('status', v_saved.status));
  return elzonki.production_plan_to_json(v_saved);
end;
$$;

create or replace function elzonki.app_delete_production_plan(
  p_token text,
  p_id text
)
returns void
language plpgsql
security definer
set search_path = elzonki, extensions, public
as $$
declare
  v_user elzonki.app_users;
begin
  v_user := elzonki.require_permission(p_token, 'planning.delete');
  delete from elzonki.production_plans where id = p_id;
  perform elzonki.app_log(v_user.id, 'delete', 'productionPlans', p_id, '{}'::jsonb);
end;
$$;

revoke all on function elzonki.app_update_product_variants(text, text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function elzonki.app_upsert_production_plan(text, jsonb) from public, anon, authenticated;
revoke all on function elzonki.app_delete_production_plan(text, text) from public, anon, authenticated;
revoke all on function elzonki.app_update_pricing_mode(text, text) from public, anon, authenticated;

grant execute on function elzonki.app_update_product_variants(text, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function elzonki.app_upsert_production_plan(text, jsonb) to anon, authenticated;
grant execute on function elzonki.app_delete_production_plan(text, text) to anon, authenticated;
grant execute on function elzonki.app_update_pricing_mode(text, text) to anon, authenticated;

-- NOTE: the generic app_upsert_factory_rows / app_factory_bootstrap mapping must
-- also serialize the new packaging columns and product variant columns for
-- cross-device sync of those fields. Until then the client keeps them locally.
