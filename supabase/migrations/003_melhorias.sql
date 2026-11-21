-- =====================================================================
-- NT — Migração 003 (ADITIVA: não apaga nem altera dados existentes)
-- Cole no SQL Editor do Supabase e clique em Run. Pode rodar mais de uma vez.
-- Compatível com o site que está no ar hoje.
--
-- O que faz:
--   0) Backup: copia todas as tabelas para bkp_20261120_* (somente leitura via painel do Supabase)
--   1) Produtos: SKU, marca, estoque mínimo e variações (tabela product_variants)
--   2) Estoque: histórico de movimentações (stock_movements)
--   3) Pedidos: chave anti-duplicidade, taxa de pagamento, data do pagamento e histórico de status
--   4) Clientes: sem duplicidade por e-mail; função para mesclar cadastros repetidos
--   5) Financeiro: tabela de despesas e configurações financeiras (somente administrador)
--   6) create_order reescrita (variações, anti-duplicidade, cliente único, cancelamento de pedidos antigos)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0) BACKUP (cópia das tabelas atuais; protegidas por RLS sem políticas)
-- ---------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['categories','products','coupons','customers','orders','order_items','settings','testimonials'] loop
    if to_regclass('public.bkp_20261120_' || t) is null then
      execute format('create table public.bkp_20261120_%s as table public.%I', t, t);
      execute format('alter table public.bkp_20261120_%s enable row level security', t);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 1) Produtos: SKU, marca, estoque mínimo, variações
-- ---------------------------------------------------------------------
alter table public.products add column if not exists sku text;
alter table public.products add column if not exists brand text;
alter table public.products add column if not exists min_stock int not null default 5 check (min_stock >= 0);
alter table public.products add column if not exists has_variants boolean not null default false;
create unique index if not exists products_sku_uidx on public.products (lower(sku)) where sku is not null and sku <> '';

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),   -- ex.: "Preto / iPhone 13"
  sku text,
  stock int not null default 0 check (stock >= 0),
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  unique (product_id, name)
);
create unique index if not exists variants_sku_uidx on public.product_variants (lower(sku)) where sku is not null and sku <> '';
create index if not exists variants_product_idx on public.product_variants(product_id);
alter table public.product_variants enable row level security;
drop policy if exists variants_read on public.product_variants;
create policy variants_read on public.product_variants for select using (active or public.is_admin());
drop policy if exists variants_admin_write on public.product_variants;
create policy variants_admin_write on public.product_variants for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- o estoque do produto passa a ser a soma das variações ativas
create or replace function public.sync_product_from_variants()
returns trigger language plpgsql security definer set search_path = public as $$
declare pid uuid := coalesce(new.product_id, old.product_id); n int;
begin
  select count(*) into n from public.product_variants where product_id = pid and active;
  update public.products
     set has_variants = (n > 0),
         stock = case when n > 0 then (select coalesce(sum(stock),0) from public.product_variants where product_id = pid and active) else stock end
   where id = pid;
  return null;
end $$;
drop trigger if exists variants_sync on public.product_variants;
create trigger variants_sync after insert or update or delete on public.product_variants
  for each row execute function public.sync_product_from_variants();

-- ---------------------------------------------------------------------
-- 2) Histórico de movimentação de estoque
-- ---------------------------------------------------------------------
create table if not exists public.stock_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text,
  delta int not null,
  stock_after int not null,
  reason text not null,
  order_id uuid references public.orders(id) on delete set null,
  user_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists stock_mov_product_idx on public.stock_movements(product_id, created_at desc);
alter table public.stock_movements enable row level security;
drop policy if exists stock_mov_admin_read on public.stock_movements;
create policy stock_mov_admin_read on public.stock_movements for select to authenticated using (public.is_admin());

create or replace function public.log_stock_product()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.stock is distinct from old.stock and not new.has_variants and not old.has_variants then
    insert into public.stock_movements(product_id, product_name, delta, stock_after, reason, order_id, user_id)
    values (new.id, new.name, new.stock - old.stock, new.stock,
            coalesce(nullif(current_setting('app.stock_reason', true), ''), 'ajuste manual'),
            nullif(current_setting('app.stock_order', true), '')::uuid, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists products_log_stock on public.products;
create trigger products_log_stock after update of stock on public.products
  for each row execute function public.log_stock_product();

create or replace function public.log_stock_variant()
returns trigger language plpgsql security definer set search_path = public as $$
declare pname text;
begin
  select name into pname from public.products where id = new.product_id;
  if tg_op = 'INSERT' and new.stock > 0 then
    insert into public.stock_movements(product_id, variant_id, product_name, delta, stock_after, reason, user_id)
    values (new.product_id, new.id, pname || ' — ' || new.name, new.stock, new.stock, 'cadastro da variação', auth.uid());
  elsif tg_op = 'UPDATE' and new.stock is distinct from old.stock then
    insert into public.stock_movements(product_id, variant_id, product_name, delta, stock_after, reason, order_id, user_id)
    values (new.product_id, new.id, pname || ' — ' || new.name, new.stock - old.stock, new.stock,
            coalesce(nullif(current_setting('app.stock_reason', true), ''), 'ajuste manual'),
            nullif(current_setting('app.stock_order', true), '')::uuid, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists variants_log_stock on public.product_variants;
create trigger variants_log_stock after insert or update of stock on public.product_variants
  for each row execute function public.log_stock_variant();

-- ---------------------------------------------------------------------
-- 3) Pedidos: anti-duplicidade, taxa, data de pagamento, histórico de status
-- ---------------------------------------------------------------------
alter table public.orders add column if not exists idempotency_key uuid;
create unique index if not exists orders_idem_uidx on public.orders(idempotency_key) where idempotency_key is not null;
alter table public.orders add column if not exists payment_fee numeric(10,2) not null default 0;
alter table public.orders add column if not exists paid_at timestamptz;

alter table public.order_items add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
alter table public.order_items add column if not exists variant_name text;
alter table public.order_items add column if not exists sku text;

create table if not exists public.order_status_history (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid,
  created_at timestamptz not null default now()
);
create index if not exists osh_order_idx on public.order_status_history(order_id, created_at);
alter table public.order_status_history enable row level security;
drop policy if exists osh_admin_read on public.order_status_history;
create policy osh_admin_read on public.order_status_history for select to authenticated using (public.is_admin());

create or replace function public.orders_before_write()
returns trigger language plpgsql as $$
begin
  if new.status in ('pago','em_separacao','enviado','entregue') and new.paid_at is null then
    new.paid_at := now();
  end if;
  return new;
end $$;
drop trigger if exists orders_paid_at on public.orders;
create trigger orders_paid_at before insert or update of status on public.orders
  for each row execute function public.orders_before_write();

create or replace function public.log_order_status()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.order_status_history(order_id, from_status, to_status, changed_by) values (new.id, null, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.order_status_history(order_id, from_status, to_status, changed_by) values (new.id, old.status, new.status, auth.uid());
  end if;
  return null;
end $$;
drop trigger if exists orders_log_status on public.orders;
create trigger orders_log_status after insert or update of status on public.orders
  for each row execute function public.log_order_status();

-- preenche o que já existe (sem apagar nada)
update public.orders set paid_at = created_at
 where paid_at is null and status in ('pago','em_separacao','enviado','entregue');
insert into public.order_status_history(order_id, from_status, to_status, created_at)
select o.id, null, o.status, o.created_at from public.orders o
 where not exists (select 1 from public.order_status_history h where h.order_id = o.id);

-- ---------------------------------------------------------------------
-- 4) Clientes: sem duplicidade por e-mail + mesclagem
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from public.customers where email is not null and email <> '' group by lower(email) having count(*) > 1) then
    execute 'create unique index if not exists customers_email_uidx on public.customers (lower(email)) where email is not null and email <> ''''';
  else
    raise notice 'Existem clientes com o mesmo e-mail. Mescle-os em Painel > Clientes e rode esta migração de novo para ativar a trava.';
  end if;
end $$;

create or replace function public.merge_customers(p_keep uuid, p_drop uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d public.customers%rowtype;
begin
  if not public.is_admin() then raise exception 'Sem permissão'; end if;
  if p_keep = p_drop then raise exception 'Escolha clientes diferentes'; end if;
  select * into d from public.customers where id = p_drop;
  if not found then raise exception 'Cliente não encontrado'; end if;
  update public.orders set customer_id = p_keep where customer_id = p_drop;
  delete from public.customers where id = p_drop;      -- só o cadastro repetido; os pedidos foram movidos
  update public.customers set email = coalesce(email, d.email) where id = p_keep;
end $$;
revoke all on function public.merge_customers(uuid, uuid) from public;
grant execute on function public.merge_customers(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------
-- 5) Financeiro: despesas e configurações administrativas
-- ---------------------------------------------------------------------
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  description text not null check (char_length(description) between 1 and 200),
  category text not null default 'Outros',
  amount numeric(10,2) not null check (amount > 0),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index if not exists expenses_date_idx on public.expenses(spent_on desc);
alter table public.expenses enable row level security;
drop policy if exists expenses_admin_all on public.expenses;
create policy expenses_admin_all on public.expenses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Só a linha 'store' do settings continua pública (a loja precisa dela).
-- Outras chaves (ex.: 'admin': taxas e prazos internos) ficam restritas ao administrador.
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (key = 'store' or public.is_admin());

-- ---------------------------------------------------------------------
-- 6) Cancelamento devolve estoque (agora também com variações e histórico)
-- ---------------------------------------------------------------------
create or replace function public.restore_stock_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
declare r record; sign int;
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then sign := 1;
  elsif old.status = 'cancelado' and new.status <> 'cancelado' then sign := -1;
  else return new; end if;
  perform set_config('app.stock_reason', case when sign = 1 then 'cancelamento do pedido #' else 'reativação do pedido #' end || new.number, true);
  perform set_config('app.stock_order', new.id::text, true);
  for r in select * from public.order_items where order_id = new.id and product_id is not null loop
    if r.variant_id is not null then
      update public.product_variants set stock = greatest(stock + sign * r.quantity, 0) where id = r.variant_id;
    else
      update public.products set stock = greatest(stock + sign * r.quantity, 0) where id = r.product_id;
    end if;
    update public.products set sold_count = greatest(sold_count - sign * r.quantity, 0) where id = r.product_id;
  end loop;
  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_order', '', true);
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 7) create_order (compatível com o payload antigo; item aceita variant_id)
--    payload: { customer, address, items:[{product_id, variant_id?, quantity}], coupon,
--               payment_method, delivery, notes, idempotency_key? }
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(p #>> '{customer,name}', ''));
  v_phone text := regexp_replace(coalesce(p #>> '{customer,phone}', ''), '\D', '', 'g');
  v_email text := nullif(lower(trim(coalesce(p #>> '{customer,email}', ''))), '');
  v_method text := coalesce(p ->> 'payment_method', 'pix');
  v_delivery text := coalesce(p ->> 'delivery', 'entrega');
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_key uuid := case when (p ->> 'idempotency_key') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     then (p ->> 'idempotency_key')::uuid else null end;
  v_cfg jsonb; v_adm jsonb;
  v_customer uuid; v_order uuid; v_number bigint; v_old public.orders%rowtype;
  v_item jsonb; v_prod public.products%rowtype; v_var public.product_variants%rowtype; v_qty int; v_unit numeric(10,2);
  v_sub numeric(10,2) := 0; v_disc numeric(10,2) := 0; v_ship numeric(10,2) := 0; v_total numeric(10,2);
  v_coupon_code text := upper(trim(coalesce(p ->> 'coupon', '')));
  v_c public.coupons%rowtype;
  v_flat numeric; v_free numeric; v_pickup boolean; v_stale numeric;
begin
  if char_length(v_name) < 2 then raise exception 'Informe seu nome'; end if;
  if char_length(v_phone) < 10 or char_length(v_phone) > 13 then raise exception 'Telefone inválido'; end if;
  if v_method not in ('pix','cartao','whatsapp') then raise exception 'Forma de pagamento inválida'; end if;
  if v_delivery not in ('entrega','retirada') then raise exception 'Tipo de entrega inválido'; end if;
  if jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 or jsonb_array_length(v_items) > 50 then
    raise exception 'Carrinho vazio';
  end if;
  if v_delivery = 'entrega' and char_length(trim(coalesce(p #>> '{address,street}', ''))) < 2 then
    raise exception 'Informe o endereço de entrega';
  end if;

  -- anti-duplicidade: o mesmo envio (duplo clique, recarga) devolve o pedido já criado
  if v_key is not null then
    perform pg_advisory_xact_lock(hashtext(v_key::text));
    select * into v_old from public.orders where idempotency_key = v_key;
    if found then
      return jsonb_build_object('order_id', v_old.id, 'number', v_old.number, 'total', v_old.total,
        'subtotal', v_old.subtotal, 'discount', v_old.discount, 'shipping', v_old.shipping, 'duplicate', true);
    end if;
  end if;

  -- pedidos PIX/cartão não pagos há muito tempo liberam o estoque (só se configurado em settings 'admin')
  select value into v_adm from public.settings where key = 'admin';
  v_stale := coalesce((v_adm ->> 'stale_hours')::numeric, 0);
  if v_stale > 0 then
    update public.orders set status = 'cancelado'
     where status = 'aguardando_pagamento' and payment_method in ('pix','cartao')
       and created_at < now() - make_interval(hours => v_stale::int);
  end if;

  -- cliente único por e-mail ou telefone
  if v_email is not null then
    select id into v_customer from public.customers where lower(email) = v_email limit 1;
  end if;
  if v_customer is null then
    insert into public.customers(name, phone, email) values (v_name, v_phone, v_email)
    on conflict (phone) do update set name = excluded.name, email = coalesce(excluded.email, public.customers.email)
    returning id into v_customer;
  else
    update public.customers set name = v_name,
           phone = case when exists (select 1 from public.customers c2 where c2.phone = v_phone and c2.id <> v_customer) then phone else v_phone end
     where id = v_customer;
  end if;

  insert into public.orders(customer_id, payment_method, delivery, address, notes, idempotency_key)
  values (v_customer, v_method, v_delivery, coalesce(p -> 'address', '{}'::jsonb),
          nullif(left(coalesce(p ->> 'notes',''), 500), ''), v_key)
  returning id, number into v_order, v_number;

  perform set_config('app.stock_reason', 'venda — pedido #' || v_number, true);
  perform set_config('app.stock_order', v_order::text, true);

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then raise exception 'Quantidade inválida'; end if;
    select * into v_prod from public.products where id = (v_item ->> 'product_id')::uuid and active for update;
    if not found then raise exception 'Produto indisponível'; end if;
    v_unit := case when v_prod.promo_price is not null and v_prod.promo_price < v_prod.price then v_prod.promo_price else v_prod.price end;

    if v_prod.has_variants then
      select * into v_var from public.product_variants
       where id = nullif(v_item ->> 'variant_id', '')::uuid and product_id = v_prod.id and active for update;
      if not found then raise exception 'Escolha uma opção do produto % (variação)', v_prod.name; end if;
      if v_var.stock < v_qty then raise exception 'Estoque insuficiente para % (%)', v_prod.name, v_var.name; end if;
      insert into public.order_items(order_id, product_id, variant_id, variant_name, sku, name, image, price, cost, quantity)
      values (v_order, v_prod.id, v_var.id, v_var.name, coalesce(nullif(v_var.sku,''), v_prod.sku), v_prod.name, v_prod.images[1], v_unit, v_prod.cost, v_qty);
      update public.product_variants set stock = stock - v_qty where id = v_var.id;
    else
      if v_prod.stock < v_qty then raise exception 'Estoque insuficiente para %', v_prod.name; end if;
      insert into public.order_items(order_id, product_id, sku, name, image, price, cost, quantity)
      values (v_order, v_prod.id, v_prod.sku, v_prod.name, v_prod.images[1], v_unit, v_prod.cost, v_qty);
      update public.products set stock = stock - v_qty where id = v_prod.id;
    end if;
    update public.products set sold_count = sold_count + v_qty where id = v_prod.id;
    v_sub := v_sub + v_unit * v_qty;
  end loop;

  perform set_config('app.stock_reason', '', true);
  perform set_config('app.stock_order', '', true);

  if v_coupon_code <> '' then
    select * into v_c from public.coupons
     where code = v_coupon_code and active
       and (expires_at is null or expires_at > now())
       and (max_uses is null or used_count < max_uses) for update;
    if not found then raise exception 'Cupom inválido ou expirado'; end if;
    if v_sub < v_c.min_order then raise exception 'Pedido abaixo do mínimo do cupom'; end if;
    v_disc := case when v_c.type = 'percent' then round(v_sub * least(v_c.value,100) / 100, 2) else least(v_c.value, v_sub) end;
    update public.coupons set used_count = used_count + 1 where code = v_c.code;
  end if;

  select value into v_cfg from public.settings where key = 'store';
  v_flat := coalesce((v_cfg #>> '{shipping,flat}')::numeric, 0);
  v_free := coalesce((v_cfg #>> '{shipping,free_above}')::numeric, 0);
  v_pickup := coalesce((v_cfg #>> '{shipping,pickup}')::boolean, true);
  if v_delivery = 'retirada' then
    if not v_pickup then raise exception 'Retirada indisponível'; end if;
    v_ship := 0;
  elsif v_free > 0 and (v_sub - v_disc) >= v_free then v_ship := 0;
  else v_ship := v_flat; end if;

  v_total := v_sub - v_disc + v_ship;
  update public.orders set subtotal = v_sub, discount = v_disc, shipping = v_ship, total = v_total,
         coupon_code = nullif(v_coupon_code,'') where id = v_order;

  return jsonb_build_object('order_id', v_order, 'number', v_number, 'total', v_total,
                            'subtotal', v_sub, 'discount', v_disc, 'shipping', v_ship);
end $$;
revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;
