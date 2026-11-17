\set ON_ERROR_STOP on

-- ===== 1. Pedido pelo servidor (service_role) =====
begin;
set local role service_role;
do $$
declare
  r jsonb; v_stock int; v_pid uuid; v_pid2 uuid; v_cnt int; failed boolean;
begin
  select id into v_pid  from products where slug = 'colar-elo-minimal';          -- 89.90, estoque 15
  select id into v_pid2 from products where slug = 'brinco-argola-essencial';    -- 59.90 promo 49.90, estoque 20

  -- pedido: 2 colares + 1 brinco (promo) + cupom 10%
  r := create_order(
    '{"name":"Maria Silva","phone":"(84) 99999-1234","email":"maria@x.com"}'::jsonb,
    '{"city":"Mossoró"}'::jsonb,
    jsonb_build_array(jsonb_build_object('id', v_pid, 'quantity', 2), jsonb_build_object('id', v_pid2, 'quantity', 1)),
    'bemvindo10', 'pix');
  -- subtotal = 179.80 + 49.90 = 229.70 ; desconto 22.97 ; frete 15 (abaixo de 200 após desconto? 206.73 >= 200 => grátis)
  assert (r->>'subtotal')::numeric = 229.70, 'subtotal ' || (r->>'subtotal');
  assert (r->>'discount')::numeric = 22.97, 'desconto ' || (r->>'discount');
  assert (r->>'shipping')::numeric = 0, 'frete grátis acima de 200: ' || (r->>'shipping');
  assert (r->>'total')::numeric = 206.73, 'total ' || (r->>'total');

  select stock into v_stock from products where id = v_pid;
  assert v_stock = 13, 'estoque colar baixou 2: ' || v_stock;
  select stock into v_stock from products where id = v_pid2;
  assert v_stock = 19, 'estoque brinco baixou 1';

  -- cliente criado automaticamente e custo registrado no item
  select count(*) into v_cnt from customers where phone = '84999991234';
  assert v_cnt = 1, 'cliente criado';
  select count(*) into v_cnt from order_items where unit_cost > 0;
  assert v_cnt = 2, 'custo gravado nos itens';
  select uses into v_cnt from coupons where code = 'BEMVINDO10';
  assert v_cnt = 1, 'uso do cupom contado';

  -- mesmo telefone = mesmo cliente (recorrente)
  r := create_order('{"name":"Maria S.","phone":"84999991234"}'::jsonb, '{}'::jsonb,
        jsonb_build_array(jsonb_build_object('id', v_pid, 'quantity', 1)), null, 'whatsapp');
  assert (r->>'shipping')::numeric = 15, 'frete fixo abaixo de 200';
  assert (r->>'total')::numeric = 104.90, 'total sem cupom ' || (r->>'total');
  select count(*) into v_cnt from customers;
  assert v_cnt = 1, 'não duplica cliente';

  -- estoque insuficiente
  failed := false;
  begin
    perform create_order('{"name":"Ana","phone":"84988887777"}'::jsonb, '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('id', v_pid, 'quantity', 999)), null, 'pix');
  exception when others then failed := true; assert sqlerrm like 'Estoque insuficiente%', sqlerrm; end;
  assert failed, 'deveria recusar estoque insuficiente';

  -- cupom inválido
  failed := false;
  begin
    perform create_order('{"name":"Ana","phone":"84988887777"}'::jsonb, '{}'::jsonb,
      jsonb_build_array(jsonb_build_object('id', v_pid, 'quantity', 1)), 'NAOEXISTE', 'pix');
  exception when others then failed := true; end;
  assert failed, 'deveria recusar cupom inválido';

  -- carrinho vazio e dados inválidos
  failed := false;
  begin perform create_order('{"name":"Ana","phone":"84988887777"}'::jsonb, '{}'::jsonb, '[]'::jsonb, null, 'pix');
  exception when others then failed := true; end;
  assert failed, 'carrinho vazio';
  failed := false;
  begin perform create_order('{"name":"A","phone":"123"}'::jsonb, '{}'::jsonb,
        jsonb_build_array(jsonb_build_object('id', v_pid, 'quantity', 1)), null, 'pix');
  exception when others then failed := true; end;
  assert failed, 'dados inválidos';

  -- cliente não consegue forçar preço: payload com "price" é ignorado
  r := create_order('{"name":"Ana","phone":"84988887777"}'::jsonb, '{}'::jsonb,
        jsonb_build_array(jsonb_build_object('id', v_pid, 'quantity', 1, 'price', 0.01)), null, 'pix');
  assert (r->>'subtotal')::numeric = 89.90, 'preço vem do banco';

  -- validação de cupom
  assert (check_coupon('BEMVINDO10', 100)->>'valid')::boolean, 'cupom válido';
  assert not (check_coupon('XYZ', 100)->>'valid')::boolean, 'cupom inexistente';
end $$;
commit;

-- ===== 2. Visitante anônimo =====
begin;
set local role anon;
do $$
declare n int; failed boolean;
begin
  select count(*) into n from products;           assert n = 4, 'anon vê produtos ativos';
  select count(*) into n from categories;         assert n = 4, 'anon vê categorias';
  select count(*) into n from store_settings;     assert n = 1, 'anon vê configurações';
  select count(*) into n from product_costs;      assert n = 0, 'anon NÃO vê custos';
  select count(*) into n from orders;             assert n = 0, 'anon NÃO vê pedidos';
  select count(*) into n from order_items;        assert n = 0, 'anon NÃO vê itens';
  select count(*) into n from customers;          assert n = 0, 'anon NÃO vê clientes';
  select count(*) into n from coupons;            assert n = 0, 'anon NÃO vê cupons';

  failed := false;
  begin insert into products (name, slug, price) values ('Hack', 'hack', 1); exception when others then failed := true; end;
  assert failed, 'anon NÃO insere produto';

  update products set price = 1; get diagnostics n = row_count;
  assert n = 0, 'anon NÃO altera preço';

  failed := false;
  begin perform create_order('{"name":"Ana","phone":"84988887777"}'::jsonb, '{}'::jsonb, '[]'::jsonb, null, 'pix');
  exception when insufficient_privilege then failed := true; end;
  assert failed, 'anon NÃO chama create_order';

  failed := false;
  begin perform check_coupon('BEMVINDO10', 100); exception when insufficient_privilege then failed := true; end;
  assert failed, 'anon NÃO chama check_coupon direto';

  select count(*) into n from best_sellers(8);
  assert n = 0, 'sem vendas pagas ainda => sem mais vendidos';
end $$;
commit;

-- ===== 3. Usuário logado que NÃO é admin =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';
do $$
declare n int;
begin
  select count(*) into n from orders;      assert n = 0, 'intruso NÃO vê pedidos';
  select count(*) into n from customers;   assert n = 0, 'intruso NÃO vê clientes';
  select count(*) into n from product_costs; assert n = 0, 'intruso NÃO vê custos';
  update store_settings set data = '{}'::jsonb; get diagnostics n = row_count;
  assert n = 0, 'intruso NÃO altera configurações';
end $$;
commit;

-- ===== 4. Dono (admin) =====
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';
do $$
declare n int; v_order uuid; v_pid uuid; v_stock int;
begin
  select count(*) into n from orders;        assert n = 3, 'admin vê pedidos: ' || n;
  select count(*) into n from customers;     assert n = 2, 'admin vê clientes: ' || n;
  select count(*) into n from product_costs; assert n = 4, 'admin vê custos';

  -- altera preço/promoção pelo painel
  update products set price = 99.90, promo_price = 79.90 where slug = 'colar-elo-minimal';
  get diagnostics n = row_count; assert n = 1, 'admin altera produto';

  -- marca pedido como pago => entra nos mais vendidos
  select o.id into v_order from orders o order by o.number limit 1;
  update orders set status = 'pago' where id = v_order;
  select count(*) into n from best_sellers(8);
  assert n = 2, 'mais vendidos após pagamento: ' || n;

  -- cancelar devolve estoque (pedido com 2 colares + 1 brinco)
  select id into v_pid from products where slug = 'colar-elo-minimal';
  select stock into v_stock from products where id = v_pid;   -- 15 -2 -1 -1 = 11
  assert v_stock = 11, 'estoque antes do cancelamento: ' || v_stock;
  update orders set status = 'cancelado' where id = v_order;
  select stock into v_stock from products where id = v_pid;
  assert v_stock = 13, 'cancelamento devolve estoque: ' || v_stock;
  -- cancelar de novo não devolve em dobro
  update orders set status = 'cancelado' where id = v_order;
  select stock into v_stock from products where id = v_pid;
  assert v_stock = 13, 'sem devolução dupla';

  -- produto inativo some para o público, mas o admin ainda vê
  update products set active = false where slug = 'relogio-classico-nt';
end $$;
commit;

begin;
set local role anon;
do $$ declare n int; begin
  select count(*) into n from products; assert n = 3, 'produto inativo some da loja: ' || n;
  select (data->'shipping'->>'flat')::numeric into n from store_settings; assert n = 15;
end $$;
commit;

select 'TODOS OS TESTES DE BANCO PASSARAM' as resultado;
