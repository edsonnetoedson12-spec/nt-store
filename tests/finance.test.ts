import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toCsv, parseCsv, parseMoney, parseProductCsv, csvCell } from '../src/lib/csv';
import { margin, buildReport, estimateFee, canTransition } from '../src/lib/finance';
import type { Order } from '../src/lib/types';

const order = (o: Partial<Order> & { items: [number, number, number][] }): Order =>
  ({
    id: Math.random().toString(), number: 1, customer_id: null, status: 'pago', payment_method: 'pix', delivery: 'entrega',
    subtotal: 0, discount: 0, shipping: 0, total: 0, coupon_code: null, address: {}, notes: null, tracking_code: null,
    created_at: '2026-11-10T12:00:00', ...o,
    order_items: o.items.map(([price, cost, quantity], i) => ({ id: String(i), order_id: 'x', product_id: null, name: 'p' + i, image: null, price, cost, quantity })),
  }) as Order;

test('csv: ida e volta com ; aspas e acentos', () => {
  const csv = toCsv(['a', 'b'], [['x;y', 'diz "oi"'], [1.5, 'ç']]);
  assert.ok(csv.startsWith('﻿'));
  assert.deepEqual(parseCsv(csv), [['a', 'b'], ['x;y', 'diz "oi"'], ['1,5', 'ç']]);
});
test('csv: protege contra fórmulas', () => {
  assert.equal(csvCell('=SOMA(A1)'), "'=SOMA(A1)");
  assert.equal(csvCell('-5'), '-5');
});
test('parseMoney formatos BR e US', () => {
  assert.equal(parseMoney('R$ 1.234,56'), 1234.56);
  assert.equal(parseMoney('29.9'), 29.9);
  assert.equal(parseMoney('12,5'), 12.5);
  assert.equal(parseMoney('abc'), null);
});
test('importação de produtos valida linhas', () => {
  const t = 'sku;nome;marca;categoria;preco;preco_promocional;custo;estoque\nA1;Capa X;Foo;Capas;39,90;29,90;10;5\nA1;Dup;;;10;;;1\n;;;;10\nB2;Cabo;;;abc\nC3;Pelicula;;;20;25;5;1';
  const r = parseProductCsv(t);
  assert.equal(r.rows.length, 1);
  assert.equal(r.rows[0].promo_price, 29.9);
  assert.equal(r.errors.length, 4);
});
test('margem usa preço promocional', () => {
  assert.deepEqual(margin(100, 40), { profit: 60, pct: 60 });
  assert.deepEqual(margin(100, 40, 80), { profit: 40, pct: 50 });
  assert.equal(margin(0, 0).pct, 0);
});
test('relatório: lucro bruto e líquido corretos', () => {
  const orders = [
    order({ total: 110, discount: 10, shipping: 10, items: [[50, 20, 2]], payment_fee: 4 } as never),
    order({ status: 'aguardando_pagamento', total: 50, items: [[50, 20, 1]] }),
    order({ status: 'cancelado', total: 70, items: [[70, 30, 1]] }),
    order({ created_at: '2026-10-01T10:00:00', total: 99, items: [[99, 1, 1]] }),
  ];
  const exp = [{ id: '1', description: 'Anúncios', category: 'Marketing', amount: 15, spent_on: '2026-11-05' },
               { id: '2', description: 'Fora', category: 'x', amount: 99, spent_on: '2026-10-05' }];
  const r = buildReport(orders, exp, new Date('2026-11-01T00:00:00'), new Date('2026-12-01T00:00:00'));
  assert.equal(r.revenue, 110);
  assert.equal(r.cogs, 40);
  assert.equal(r.discounts, 10);
  assert.equal(r.grossProfit, 50);       // (50-20)*2 - 10
  assert.equal(r.netProfit, 31);         // 50 - 4 - 15
  assert.equal(r.pending.count, 1);
  assert.equal(r.cancelled.total, 70);
  assert.equal(r.avgTicket, 110);
});
test('taxa estimada e transições', () => {
  assert.equal(estimateFee(100, 'cartao', { cartao: 4.99 }), 4.99);
  assert.equal(estimateFee(100, 'whatsapp', { pix: 1 }), 0);
  assert.ok(canTransition('pago', 'enviado'));
  assert.ok(!canTransition('entregue', 'pago'));
  assert.ok(!canTransition('aguardando_pagamento', 'entregue'));
});
