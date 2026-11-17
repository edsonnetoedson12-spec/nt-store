import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeMetrics, orderProfit, summarizeCustomer, isSold } from '../src/lib/metrics';
import type { Order } from '../src/lib/types';

// Quarta-feira, 12/11/2026 15:00 (horário local)
const NOW = new Date(2026, 10, 12, 15, 0, 0);
const at = (y: number, m: number, d: number, h = 10) => new Date(y, m - 1, d, h).toISOString();

let n = 0;
function order(status: Order['status'], created_at: string, items: [string, number, number, number][], discount = 0, shipping = 0): Order {
  const sub = items.reduce((s, [, p, , q]) => s + p * q, 0);
  return {
    id: `o${++n}`, number: 1000 + n, customer_id: 'c1', status, payment_method: 'pix', delivery: 'entrega',
    subtotal: sub, discount, shipping, total: sub - discount + shipping, coupon_code: null, address: {}, notes: null,
    tracking_code: null, created_at,
    order_items: items.map(([name, price, cost, quantity], i) => ({ id: `i${n}${i}`, order_id: `o${n}`, product_id: null, name, image: null, price, cost, quantity })),
  };
}

const orders: Order[] = [
  order('pago', at(2026, 11, 12, 9), [['Colar', 100, 40, 1]]),                    // hoje, lucro 60
  order('entregue', at(2026, 11, 10, 9), [['Anel', 50, 20, 2]], 10, 20),          // segunda (semana), total 110, lucro 60-10=50
  order('enviado', at(2026, 11, 3, 9), [['Colar', 100, 40, 2]]),                  // mês, fora da semana, lucro 120
  order('pago', at(2026, 10, 30, 9), [['Brinco', 80, 30, 1]]),                    // mês passado, lucro 50
  order('aguardando_pagamento', at(2026, 11, 12, 11), [['Relógio', 300, 120, 1]]), // não conta
  order('cancelado', at(2026, 11, 12, 12), [['Bolsa', 200, 90, 1]]),               // não conta
];

test('só pedidos pagos/em andamento contam como venda', () => {
  assert.equal(orders.filter(isSold).length, 4);
});

test('faturamento, ticket médio, lucro e quantidade', () => {
  const m = computeMetrics(orders, NOW);
  assert.equal(m.revenue, 100 + 110 + 200 + 80);
  assert.equal(m.orderCount, 4);
  assert.equal(m.totalOrders, 6);
  assert.equal(m.avgTicket, 122.5);
  assert.equal(m.profit, 60 + 50 + 120 + 50);
});

test('vendas do dia, da semana (desde segunda) e do mês', () => {
  const m = computeMetrics(orders, NOW);
  assert.deepEqual(m.today, { revenue: 100, orders: 1 });
  assert.deepEqual(m.week, { revenue: 210, orders: 2 });
  assert.deepEqual(m.month, { revenue: 410, orders: 3 });
});

test('produtos mais vendidos e série diária', () => {
  const m = computeMetrics(orders, NOW, 14);
  assert.equal(m.topProducts[0].name, 'Colar');
  assert.equal(m.topProducts[0].quantity, 3);
  assert.equal(m.topProducts.find((p) => p.name === 'Relógio'), undefined);
  assert.equal(m.series.length, 14);
  assert.equal(m.series.at(-1)?.label, '12/11');
  assert.equal(m.series.at(-1)?.revenue, 100);
  assert.equal(m.series.find((s) => s.label === '10/11')?.revenue, 110);
  assert.equal(m.statusCount.cancelado, 1);
});

test('lucro por pedido desconta o cupom e ignora o frete', () => {
  assert.equal(orderProfit(orders[1]), 50);
});

test('métricas sem pedidos não quebram', () => {
  const m = computeMetrics([], NOW);
  assert.equal(m.avgTicket, 0);
  assert.equal(m.revenue, 0);
  assert.equal(m.topProducts.length, 0);
});

test('cliente recorrente = 2+ pedidos não cancelados', () => {
  const s = summarizeCustomer([orders[0], orders[1]]);
  assert.equal(s.recurring, true);
  assert.equal(s.spent, 210);
  assert.equal(summarizeCustomer([orders[0], orders[5]]).recurring, false);
  assert.equal(summarizeCustomer([]).lastOrder, null);
});
