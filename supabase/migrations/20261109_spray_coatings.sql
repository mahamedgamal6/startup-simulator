-- Spray/coating materials linked to products. Cost elements are computed
-- automatically in the app; spray data is editable factory master data.
create table if not exists elzonki.spray_coatings (
  id text primary key,
  code text not null default '',
  name text not null default '',
  type text not null default '',
  color text not null default '',
  cost_per_product numeric(14,4) not null default 0,
  supplier text not null default '',
  notes text not null default '',
  product_codes jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table elzonki.spray_coatings enable row level security;
revoke all on table elzonki.spray_coatings from anon, authenticated;

create or replace function elzonki.spray_coating_to_json(p elzonki.spray_coatings)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p.id,
    'code', p.code,
    'name', p.name,
    'type', p.type,
    'color', p.color,
    'costPerProduct', p.cost_per_product,
    'supplier', p.supplier,
    'notes', p.notes,
    'productCodes', coalesce(p.product_codes, '[]'::jsonb)
  );
$$;

create or replace function elzonki.app_upsert_spray_coatings(
  p_token text,
  p_rows jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = elzonki, extensions, public
as $$
declare
  v_user elzonki.app_users;
  v_row jsonb;
  v_saved jsonb := '[]'::jsonb;
begin
  v_user := elzonki.require_permission(p_token, 'data.edit.sprayCoatings');
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'ROWS_MUST_BE_ARRAY';
  end if;
  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    insert into elzonki.spray_coatings as s (
      id, code, name, type, color, cost_per_product, supplier, notes, product_codes, updated_at
    ) values (
      nullif(btrim(v_row->>'id'), ''),
      coalesce(v_row->>'code', ''),
      coalesce(v_row->>'name', ''),
      coalesce(v_row->>'type', ''),
      coalesce(v_row->>'color', ''),
      coalesce(nullif(v_row->>'costPerProduct', '')::numeric, 0),
      coalesce(v_row->>'supplier', ''),
      coalesce(v_row->>'notes', ''),
      case when jsonb_typeof(v_row->'productCodes') = 'array' then v_row->'productCodes' else '[]'::jsonb end,
      now()
    )
    on conflict (id) do update set
      code = excluded.code,
      name = excluded.name,
      type = excluded.type,
      color = excluded.color,
      cost_per_product = excluded.cost_per_product,
      supplier = excluded.supplier,
      notes = excluded.notes,
      product_codes = excluded.product_codes,
      updated_at = now()
    returning elzonki.spray_coating_to_json(s.*) into v_row;
    v_saved := v_saved || jsonb_build_array(v_row);
  end loop;
  perform elzonki.app_log(v_user.id, 'upsert', 'sprayCoatings', null, jsonb_build_object('count', jsonb_array_length(v_saved)));
  return v_saved;
end;
$$;

create or replace function elzonki.app_delete_spray_coating(
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
  v_user := elzonki.require_permission(p_token, 'data.delete.sprayCoatings');
  delete from elzonki.spray_coatings where id = p_id;
  perform elzonki.app_log(v_user.id, 'delete', 'sprayCoatings', p_id, '{}'::jsonb);
end;
$$;

revoke all on function elzonki.app_upsert_spray_coatings(text, jsonb) from public, anon, authenticated;
revoke all on function elzonki.app_delete_spray_coating(text, text) from public, anon, authenticated;
grant execute on function elzonki.app_upsert_spray_coatings(text, jsonb) to anon, authenticated;
grant execute on function elzonki.app_delete_spray_coating(text, text) to anon, authenticated;
