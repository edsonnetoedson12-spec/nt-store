-- Teste de fumaça do banco. Rode no SQL Editor do Supabase DEPOIS de 001_schema.sql e seed.sql.
-- Tudo roda dentro de uma transação que é desfeita no final (ROLLBACK): não deixa pedidos de teste.
-- Se algum item falhar, aparece "ASSERT" com a descrição do problema.
begin;

do $$
declare
  p public.products%rowtype; s0 int; sold0 int;
  r jsonb; n int; ok boolean;
  payload jsonb;
begin
  select * into p from public.products where slug = 'capa-silicone-premium';
  s0 := p.stock; sold0 := p.sold_count;
  assert p.id is not null, 'seed: produto capa-silicone-premium não encontrado (rode seed.sql)';

  -- 1) pedido válido com cupom de 10% e frete cobrado (abaixo do frete grátis)
  payload := jsonb_build_object(
    'customer', jsonb_build_object('name','Cliente Teste','phone','(85) 98888-7777','email','t@t.com'),
    'address',  jsonb_build_object('street','Rua A','number','10','city','Fortaleza'),
    'items',    jsonb_build_array(jsonb_build_object('product_id', p.id, 'quantity', 2)),
    'coupon', 'bemvindo10', 'payment_method','pix', 'delivery','entrega');
  r := public.create_order(payload);
  assert (r->>'subtotal')::numeric = round(p.price*2,2), 'subtotal incorreto';
  assert (r->>'discount')::numeric = round(p.price*2*0.10,2), 'desconto do cupom incorreto';
  assert (r->>'shipping')::numeric = 19.90, 'frete deveria ser 19,90';
  assert (r->>'total')::numeric = round(p.price*2*0.90,2) + 19.90, 'total incorreto';

  -- 2) estoque baixou e vendas contadas; cliente criado só com dígitos
  select * into p from public.products where slug = 'capa-silicone-premium';
  assert p.stock = s0 - 2, 'estoque não baixou';
  assert p.sold_count = sold0 + 2, 'sold_count não subiu';
  assert exists (select 1 from public.customers where phone = '85988887777'), 'cliente não cadastrado';
  assert (select used_count from public.coupons where code='BEMVINDO10') >= 1, 'uso do cupom não contado';

  -- 3) preço enviado pelo cliente é ignorado (o servidor usa o preço do banco)
  r := public.create_order(jsonb_build_object(
    'customer', jsonb_build_object('name','Outro','phone','85977776666'),
    'items', jsonb_build_array(jsonb_build_object('product_id', p.id, 'quantity', 1, 'price', 0.01)),
    'payment_method','whatsapp','delivery','retirada'));
  assert (r->>'total')::numeric = case when p.promo_price is not null then p.promo_price else p.price end, 'preço adulterado foi aceito!';
  assert (r->>'shipping')::numeric = 0, 'retirada deveria ter frete 0';

  -- 4) estoque insuficiente é recusado
  ok := false;
  begin
    perform public.create_order(jsonb_build_object(
      'customer', jsonb_build_object('name','X Y','phone','85966665555'),
      'items', jsonb_build_array(jsonb_build_object('product_id', p.id, 'quantity', 9999)),
      'payment_method','pix','delivery','retirada'));
  exception when others then ok := true; end;
  assert ok, 'pedido acima do estoque deveria falhar';

  -- 5) cupom inexistente é recusado
  ok := false;
  begin
    perform public.create_order(jsonb_build_object(
      'customer', jsonb_build_object('name','X Y','phone','85966665555'),
      'items', jsonb_build_array(jsonb_build_object('product_id', p.id, 'quantity', 1)),
      'coupon','NAOEXISTE','payment_method','pix','delivery','retirada'));
  exception when others then ok := true; end;
  assert ok, 'cupom inválido deveria falhar';
  assert (public.validate_coupon('NT20', 100)->>'valid')::boolean = false, 'NT20 exige pedido mínimo de 150';
  assert (public.validate_coupon('NT20', 200)->>'valid')::boolean = true, 'NT20 deveria valer em 200';

  -- 6) cancelar devolve o estoque
  update public.orders set status = 'cancelado'
   where created_at = now()   -- só os pedidos criados neste teste (mesma transação)
     and id in (select order_id from public.order_items where product_id = p.id) and status <> 'cancelado';
  select * into p from public.products where slug = 'capa-silicone-premium';
  assert p.stock = s0, 'cancelamento não devolveu o estoque (esperado ' || s0 || ', atual ' || p.stock || ')';

  -- 7) visitante anônimo não enxerga pedidos, clientes nem cupons, mas vê produtos
  set local role anon;
  select count(*) into n from public.orders;      assert n = 0, 'anon consegue ler pedidos!';
  select count(*) into n from public.customers;   assert n = 0, 'anon consegue ler clientes!';
  select count(*) into n from public.coupons;     assert n = 0, 'anon consegue ler cupons!';
  select count(*) into n from public.products;    assert n > 0, 'anon deveria ver produtos ativos';
  ok := false;
  begin
    insert into public.products(name, slug, price) values ('hack','hack',1);
  exception when others then ok := true; end;
  assert ok, 'anon conseguiu inserir produto!';
  reset role;

  raise notice 'TODOS OS TESTES DO BANCO PASSARAM';
end $$;

rollback;
