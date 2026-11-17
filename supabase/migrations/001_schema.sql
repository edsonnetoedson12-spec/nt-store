-- =====================================================================
-- NT Acessórios — esquema completo (Supabase / PostgreSQL)
-- Execute este arquivo inteiro no SQL Editor do Supabase.
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Administradores (somente quem estiver aqui acessa o painel)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists admins_self_read on public.admins;
create policy admins_self_read on public.admins
  for select to authenticated using (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- Categorias e produtos
-- ---------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  slug text not null unique,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique,
  description text,
  price numeric(10,2) not null check (price >= 0),
  promo_price numeric(10,2) check (promo_price is null or (promo_price >= 0 and promo_price < price)),
  cost numeric(10,2) not null default 0 check (cost >= 0),
  stock int not null default 0 check (stock >= 0),
  category_id uuid references public.categories(id) on delete set null,
  images text[] not null default '{}',
  featured boolean not null default false,
  is_new boolean not null default false,
  active boolean not null default true,
  sold_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists products_category_idx on public.products(category_id);
create index if not exists products_active_idx on public.products(active, created_at desc);

-- ---------------------------------------------------------------------
-- Cupons, clientes, pedidos
-- ---------------------------------------------------------------------
create table if not exists public.coupons (
  code text primary key check (code = upper(code)),
  type text not null check (type in ('percent','fixed')),
  value numeric(10,2) not null check (value > 0),
  min_order numeric(10,2) not null default 0,
  max_uses int,
  used_count int not null default 0,
  expires_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text not null unique,          -- somente dígitos
  email text,
  created_at timestamptz not null default now()
);

create sequence if not exists public.order_number_seq start 1001;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  number bigint not null unique default nextval('public.order_number_seq'),
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'aguardando_pagamento'
    check (status in ('aguardando_pagamento','pago','em_separacao','enviado','entregue','cancelado')),
  payment_method text not null default 'pix' check (payment_method in ('pix','cartao','whatsapp')),
  delivery text not null default 'entrega' check (delivery in ('entrega','retirada')),
  subtotal numeric(10,2) not null default 0,
  discount numeric(10,2) not null default 0,
  shipping numeric(10,2) not null default 0,
  total numeric(10,2) not null default 0,
  coupon_code text,
  address jsonb not null default '{}'::jsonb,
  notes text,
  tracking_code text,
  mp_preference_id text,
  mp_payment_id text,
  created_at timestamptz not null default now()
);
create index if not exists orders_created_idx on public.orders(created_at desc);
create index if not exists orders_customer_idx on public.orders(customer_id);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  image text,
  price numeric(10,2) not null,   -- preço unitário cobrado (já com promoção)
  cost numeric(10,2) not null default 0,
  quantity int not null check (quantity > 0)
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ---------------------------------------------------------------------
-- Configurações da loja (1 linha por chave) e depoimentos
-- ---------------------------------------------------------------------
create table if not exists public.settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.testimonials (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  text text not null,
  rating int not null default 5 check (rating between 1 and 5),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.categories   enable row level security;
alter table public.products     enable row level security;
alter table public.coupons      enable row level security;
alter table public.customers    enable row level security;
alter table public.orders       enable row level security;
alter table public.order_items  enable row level security;
alter table public.settings     enable row level security;
alter table public.testimonials enable row level security;

-- Leitura pública apenas do que a vitrine precisa
drop policy if exists categories_read on public.categories;
create policy categories_read on public.categories for select using (true);
drop policy if exists products_read on public.products;
create policy products_read on public.products for select using (active or public.is_admin());
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists testimonials_read on public.testimonials;
create policy testimonials_read on public.testimonials for select using (active or public.is_admin());

-- Escrita e dados sensíveis: somente administrador
do $$
declare t text;
begin
  foreach t in array array['categories','products','settings','testimonials'] loop
    execute format('drop policy if exists %I_admin_write on public.%I', t, t);
    execute format('create policy %I_admin_write on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
  foreach t in array array['coupons','customers','orders','order_items'] loop
    execute format('drop policy if exists %I_admin_all on public.%I', t, t);
    execute format('create policy %I_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;
-- (clientes anônimos NÃO leem nem escrevem em coupons/customers/orders/order_items:
--  tudo passa pelas funções abaixo, que validam preço e estoque no servidor.)

-- ---------------------------------------------------------------------
-- Cupom: validação para o carrinho
-- ---------------------------------------------------------------------
create or replace function public.validate_coupon(p_code text, p_subtotal numeric)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare c public.coupons%rowtype; d numeric(10,2);
begin
  select * into c from public.coupons
   where code = upper(trim(coalesce(p_code,''))) and active
     and (expires_at is null or expires_at > now())
     and (max_uses is null or used_count < max_uses);
  if not found then
    return jsonb_build_object('valid', false, 'discount', 0, 'message', 'Cupom inválido ou expirado');
  end if;
  if p_subtotal < c.min_order then
    return jsonb_build_object('valid', false, 'discount', 0,
      'message', 'Pedido mínimo de R$ ' || to_char(c.min_order, 'FM999G990D00') || ' para este cupom');
  end if;
  if c.type = 'percent' then d := round(p_subtotal * least(c.value,100) / 100, 2);
  else d := least(c.value, p_subtotal); end if;
  return jsonb_build_object('valid', true, 'discount', d, 'code', c.code, 'message', 'Cupom aplicado');
end $$;
revoke all on function public.validate_coupon(text, numeric) from public;
grant execute on function public.validate_coupon(text, numeric) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Criar pedido (único caminho para o cliente comprar)
-- payload: { customer:{name,phone,email}, address:{...}, items:[{product_id,quantity}],
--            coupon, payment_method, delivery, notes }
-- ---------------------------------------------------------------------
create or replace function public.create_order(p jsonb)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_name text := trim(coalesce(p #>> '{customer,name}', ''));
  v_phone text := regexp_replace(coalesce(p #>> '{customer,phone}', ''), '\D', '', 'g');
  v_email text := nullif(trim(coalesce(p #>> '{customer,email}', '')), '');
  v_method text := coalesce(p ->> 'payment_method', 'pix');
  v_delivery text := coalesce(p ->> 'delivery', 'entrega');
  v_items jsonb := coalesce(p -> 'items', '[]'::jsonb);
  v_cfg jsonb;
  v_customer uuid; v_order uuid; v_number bigint;
  v_item jsonb; v_prod public.products%rowtype; v_qty int; v_unit numeric(10,2);
  v_sub numeric(10,2) := 0; v_disc numeric(10,2) := 0; v_ship numeric(10,2) := 0; v_total numeric(10,2);
  v_coupon_code text := upper(trim(coalesce(p ->> 'coupon', '')));
  v_c public.coupons%rowtype;
  v_flat numeric; v_free numeric; v_pickup boolean;
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

  insert into public.customers(name, phone, email) values (v_name, v_phone, v_email)
  on conflict (phone) do update set name = excluded.name, email = coalesce(excluded.email, public.customers.email)
  returning id into v_customer;

  insert into public.orders(customer_id, payment_method, delivery, address, notes, coupon_code)
  values (v_customer, v_method, v_delivery, coalesce(p -> 'address', '{}'::jsonb),
          nullif(left(coalesce(p ->> 'notes',''), 500), ''), null)
  returning id, number into v_order, v_number;

  for v_item in select * from jsonb_array_elements(v_items) loop
    v_qty := coalesce((v_item ->> 'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then raise exception 'Quantidade inválida'; end if;
    select * into v_prod from public.products
     where id = (v_item ->> 'product_id')::uuid and active for update;
    if not found then raise exception 'Produto indisponível'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Estoque insuficiente para %', v_prod.name;
    end if;
    v_unit := case when v_prod.promo_price is not null and v_prod.promo_price < v_prod.price
                   then v_prod.promo_price else v_prod.price end;
    insert into public.order_items(order_id, product_id, name, image, price, cost, quantity)
    values (v_order, v_prod.id, v_prod.name, v_prod.images[1], v_unit, v_prod.cost, v_qty);
    update public.products set stock = stock - v_qty, sold_count = sold_count + v_qty where id = v_prod.id;
    v_sub := v_sub + v_unit * v_qty;
  end loop;

  if v_coupon_code <> '' then
    select * into v_c from public.coupons
     where code = v_coupon_code and active
       and (expires_at is null or expires_at > now())
       and (max_uses is null or used_count < max_uses) for update;
    if not found then raise exception 'Cupom inválido ou expirado'; end if;
    if v_sub < v_c.min_order then raise exception 'Pedido abaixo do mínimo do cupom'; end if;
    v_disc := case when v_c.type = 'percent' then round(v_sub * least(v_c.value,100) / 100, 2)
                   else least(v_c.value, v_sub) end;
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
  update public.orders
     set subtotal = v_sub, discount = v_disc, shipping = v_ship, total = v_total,
         coupon_code = nullif(v_coupon_code,'')
   where id = v_order;

  return jsonb_build_object('order_id', v_order, 'number', v_number, 'total', v_total,
                            'subtotal', v_sub, 'discount', v_disc, 'shipping', v_ship);
end $$;
revoke all on function public.create_order(jsonb) from public;
grant execute on function public.create_order(jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Cancelamento devolve o estoque
-- ---------------------------------------------------------------------
create or replace function public.restore_stock_on_cancel()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'cancelado' and old.status <> 'cancelado' then
    update public.products p
       set stock = p.stock + oi.quantity, sold_count = greatest(p.sold_count - oi.quantity, 0)
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  elsif old.status = 'cancelado' and new.status <> 'cancelado' then
    -- reativar um pedido cancelado volta a baixar o estoque
    update public.products p
       set stock = greatest(p.stock - oi.quantity, 0), sold_count = p.sold_count + oi.quantity
      from public.order_items oi
     where oi.order_id = new.id and oi.product_id = p.id;
  end if;
  return new;
end $$;
drop trigger if exists orders_restore_stock on public.orders;
create trigger orders_restore_stock after update of status on public.orders
  for each row execute function public.restore_stock_on_cancel();

-- ---------------------------------------------------------------------
-- Storage (fotos de produtos, logo e banners)
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('store', 'store', true, 5242880, array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'])
on conflict (id) do update set public = true, file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml'];

drop policy if exists store_public_read on storage.objects;
create policy store_public_read on storage.objects for select using (bucket_id = 'store');
drop policy if exists store_admin_insert on storage.objects;
create policy store_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'store' and public.is_admin());
drop policy if exists store_admin_update on storage.objects;
create policy store_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'store' and public.is_admin());
drop policy if exists store_admin_delete on storage.objects;
create policy store_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'store' and public.is_admin());
