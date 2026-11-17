import test from 'node:test';
import assert from 'node:assert/strict';
import { summarize } from '../lib/metrics.js';

// "agora" = 12/11/2026 15:00 em Fortaleza (UTC-3) => 18:00Z
const now = new Date('2026-11-12T18:00:00Z');

const item = (name, price, cost, quantity) => ({ name, unit_price: price, unit_cost: cost, quantity });
const orders = [
  { status: 'pago', total: 115, discount: 0, created_at: '2026-11-12T13:00:00Z', order_items: [item('Colar', 100, 40, 1)] },
  { status: 'entregue', total: 200, discount: 20, created_at: '2026-11-08T15:00:00Z', order_items: [item('Relógio', 220, 90, 1)] },
  { status: 'enviado', total: 60, discount: 0, created_at: '2026-10-30T15:00:00Z', order_items: [item('Colar', 50, 20, 1), item('Brinco', 10, 4, 1)] },
  { status: 'aguardando_pagamento', total: 999, discount: 0, created_at: '2026-11-12T14:00:00Z', order_items: [item('Colar', 999, 1, 1)] },
  { status: 'cancelado', total: 500, discount: 0, created_at: '2026-11-12T14:00:00Z', order_items: [item('Colar', 500, 1, 1)] },
  // 02:00Z de 13/11 ainda é 23:00 de 12/11 em Fortaleza => conta como "hoje"
  { status: 'pago', total: 50, discount: 0, created_at: '2026-11-13T02:00:00Z', order_items: [item('Brinco', 50, 20, 1)] },
];

test('faturamento só conta pedidos pagos e ignora aguardando/cancelado', () => {
  const s = summarize(orders, { now });
  assert.equal(s.revenueTotal, 115 + 200 + 60 + 50);
  assert.equal(s.paidCount, 4);
  assert.equal(s.ordersCount, 6);
  assert.equal(s.ticket, 106.25);
});

test('vendas do dia respeitam o fuso de Fortaleza', () => {
  const s = summarize(orders, { now });
  assert.deepEqual(s.today, { revenue: 165, orders: 2 });
});

test('semana (7 dias) e mês corrente', () => {
  const s = summarize(orders, { now });
  assert.deepEqual(s.week, { revenue: 365, orders: 3 }); // 12/11, 12/11 (23h) e 08/11
  assert.deepEqual(s.month, { revenue: 365, orders: 3 }); // o de 30/10 fica de fora
});

test('lucro estimado = (preço - custo) - descontos', () => {
  const s = summarize(orders, { now });
  // 60 + (130-20) + (30+6) + 30 = 236
  assert.equal(s.profit, 236);
});

test('mais vendidos e série diária', () => {
  const s = summarize(orders, { now });
  assert.equal(s.topProducts[0].name, 'Colar');
  assert.equal(s.topProducts[0].qty, 2);
  assert.equal(s.series.length, 14);
  assert.equal(s.series.at(-1).date, '2026-11-12');
  assert.equal(s.series.at(-1).revenue, 165);
  assert.equal(s.byStatus.cancelado, 1);
  assert.equal(s.byStatus.aguardando_pagamento, 1);
});

test('sem pedidos não quebra', () => {
  const s = summarize([], { now });
  assert.equal(s.ticket, 0);
  assert.equal(s.revenueTotal, 0);
  assert.equal(s.topProducts.length, 0);
});
