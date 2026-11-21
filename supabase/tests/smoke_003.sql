-- Teste do banco após a migração 003. Roda numa transação e desfaz tudo (ROLLBACK).
begin;
do $$
declare
  p public.products%rowtype; v1 uuid; v2 uuid; r jsonb; r2 jsonb; k uuid := gen_random_uuid();
  s0 int; n int; ok boolean; cid1 uuid; cid2 uuid; oid uuid;
begin
  select * into p from public.products where active and stock >= 10 and not has_variants order by created_at limit 1;
  s0 := p.stock;

  -- anti-duplicidade: mesma chave devolve o mesmo pedido e baixa estoque uma vez
  r := public.create_order(jsonb_build_object('customer', jsonb_build_object('name','Ana Teste','phone','85911112222','email','Ana@Teste.com'),
       'items', jsonb_build_array(jsonb_build_object('product_id', p.id,'quantity',2)),'payment_method','whatsapp','delivery','retirada','idempotency_key',k));
  r2 := public.create_order(jsonb_build_object('customer', jsonb_build_object('name','Ana Teste','phone','85911112222','email','Ana@Teste.com'),
       'items', jsonb_build_array(jsonb_build_object('product_id', p.id,'quantity',2)),'payment_method','whatsapp','delivery','retirada','idempotency_key',k));
  assert r->>'order_id' = r2->>'order_id', 'duplo envio criou dois pedidos';
  assert (r2->>'duplicate')::boolean, 'segunda chamada deveria indicar duplicate';
  assert (select stock from public.products where id = p.id) = s0 - 2, 'estoque baixou mais de uma vez';
  oid := (r->>'order_id')::uuid;

  -- histórico de status e movimentação de estoque
  assert (select count(*) from public.order_status_history where order_id = oid) = 1, 'histórico inicial ausente';
  assert exists (select 1 from public.stock_movements where product_id = p.id and delta = -2 and order_id = oid), 'movimentação de venda não registrada';

  -- paid_at preenchido ao pagar
  update public.orders set status = 'pago' where id = oid;
  assert (select paid_at from public.orders where id = oid) is not null, 'paid_at não preenchido';
  assert (select count(*) from public.order_status_history where order_id = oid) = 2, 'histórico não registrou pagamento';

  -- cliente único por e-mail (telefone diferente, mesmo e-mail)
  r2 := public.create_order(jsonb_build_object('customer', jsonb_build_object('name','Ana T.','phone','85933334444','email','ana@teste.com'),
       'items', jsonb_build_array(jsonb_build_object('product_id', p.id,'quantity',1)),'payment_method','whatsapp','delivery','retirada'));
  assert (select count(*) from public.customers where lower(email) = 'ana@teste.com') = 1, 'cliente duplicado por e-mail';

  -- cancelar devolve estoque
  update public.orders set status = 'cancelado' where id = oid;
  update public.orders set status = 'cancelado' where id = (r2->>'order_id')::uuid;
  assert (select stock from public.products where id = p.id) = s0, 'cancelamento não devolveu estoque';
  assert (select sold_count from public.products where id = p.id) = p.sold_count, 'sold_count não voltou';

  -- variações: estoque do produto = soma; exige escolher variação; baixa e devolve na variação
  insert into public.product_variants(product_id, name, stock) values (p.id,'Preto',3) returning id into v1;
  insert into public.product_variants(product_id, name, stock) values (p.id,'Bege',4) returning id into v2;
  assert (select stock from public.products where id = p.id) = 7 and (select has_variants from public.products where id = p.id), 'soma das variações incorreta';
  ok := false;
  begin perform public.create_order(jsonb_build_object('customer', jsonb_build_object('name','Bo Bo','phone','85955556666'),
       'items', jsonb_build_array(jsonb_build_object('product_id', p.id,'quantity',1)),'payment_method','pix','delivery','retirada'));
  exception when others then ok := true; end;
  assert ok, 'compra sem variação deveria falhar';
  ok := false;
  begin perform public.create_order(jsonb_build_object('customer', jsonb_build_object('name','Bo Bo','phone','85955556666'),
       'items', jsonb_build_array(jsonb_build_object('product_id', p.id,'variant_id',v1,'quantity',4)),'payment_method','pix','delivery','retirada'));
  exception when others then ok := true; end;
  assert ok, 'estoque da variação deveria limitar';
  r := public.create_order(jsonb_build_object('customer', jsonb_build_object('name','Bo Bo','phone','85955556666'),
       'items', jsonb_build_array(jsonb_build_object('product_id', p.id,'variant_id',v1,'quantity',2)),'payment_method','pix','delivery','retirada'));
  assert (select stock from public.product_variants where id = v1) = 1 and (select stock from public.products where id = p.id) = 5, 'baixa de variação incorreta';
  assert (select variant_name from public.order_items where order_id = (r->>'order_id')::uuid) = 'Preto', 'variação não gravada no item';
  update public.orders set status = 'cancelado' where id = (r->>'order_id')::uuid;
  assert (select stock from public.product_variants where id = v1) = 3, 'cancelamento não devolveu estoque da variação';

  -- mesclar clientes
  insert into public.customers(name, phone) values ('Dup A','85900000001') returning id into cid1;
  insert into public.customers(name, phone) values ('Dup B','85900000002') returning id into cid2;
  update public.orders set customer_id = cid2 where id = oid;
  perform set_config('request.jwt.claim.sub', (select gen_random_uuid())::text, true);
  ok := false; begin perform public.merge_customers(cid1, cid2); exception when others then ok := true; end;
  assert ok, 'não-admin conseguiu mesclar clientes';

  -- permissões do visitante anônimo
  set local role anon;
  select count(*) into n from public.expenses;            assert n = 0, 'anon lê despesas';
  select count(*) into n from public.stock_movements;     assert n = 0, 'anon lê movimentações';
  select count(*) into n from public.order_status_history; assert n = 0, 'anon lê histórico';
  select count(*) into n from public.settings where key <> 'store'; assert n = 0, 'anon lê configurações administrativas';
  select count(*) into n from public.product_variants;    assert n > 0, 'anon deveria ver variações ativas';
  ok := false; begin insert into public.expenses(description, amount) values ('x', 1); exception when others then ok := true; end;
  assert ok, 'anon inseriu despesa';
  reset role;
  raise notice 'TODOS OS TESTES 003 PASSARAM';
end $$;
rollback;
