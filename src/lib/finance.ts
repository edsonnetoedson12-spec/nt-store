import type { Order } from './types';
import { isSold, orderProfit } from './metrics';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export type Expense = { id: string; description: string; category: string; amount: number; spent_on: string };

/** Margem de um produto em % sobre o preço de venda efetivo. */
export function margin(price: number, cost: number, promo?: number | null): { profit: number; pct: number } {
  const eff = promo != null && promo < price ? promo : price;
  const profit = r2(eff - cost);
  return { profit, pct: eff > 0 ? r2((profit / eff) * 100) : 0 };
}

export type Report = {
  revenue: number;          // faturamento recebido (vendas pagas, inclui frete)
  productRevenue: number;   // receita de produtos (sem frete, após descontos)
  cogs: number;             // custo dos produtos vendidos
  discounts: number;        // cupons concedidos
  grossProfit: number;      // lucro bruto = produtos − descontos − custo
  fees: number;             // taxas de pagamento
  expenses: number;         // despesas do período
  netProfit: number;        // lucro líquido = bruto − taxas − despesas
  orders: number;
  avgTicket: number;
  pending: { count: number; total: number };
  cancelled: { count: number; total: number };
  byMethod: Record<string, { orders: number; revenue: number }>;
};

/** Relatório financeiro do período [from, to). Frete é repasse: entra no faturamento, não no lucro. */
export function buildReport(orders: Order[], expenses: Expense[], from: Date, to: Date): Report {
  const inRange = orders.filter((o) => {
    const t = new Date(o.created_at);
    return t >= from && t < to;
  });
  const sold = inRange.filter(isSold);
  const revenue = r2(sold.reduce((s, o) => s + Number(o.total), 0));
  const cogs = r2(sold.reduce((s, o) => s + (o.order_items ?? []).reduce((a, i) => a + Number(i.cost) * i.quantity, 0), 0));
  const discounts = r2(sold.reduce((s, o) => s + Number(o.discount || 0), 0));
  const productRevenue = r2(sold.reduce((s, o) => s + (o.order_items ?? []).reduce((a, i) => a + Number(i.price) * i.quantity, 0), 0) - discounts);
  const grossProfit = r2(sold.reduce((s, o) => s + orderProfit(o), 0));
  const fees = r2(sold.reduce((s, o) => s + Number((o as Order & { payment_fee?: number }).payment_fee || 0), 0));
  const exp = r2(
    expenses
      .filter((e) => {
        const d = new Date(e.spent_on + 'T00:00:00');
        return d >= from && d < to;
      })
      .reduce((s, e) => s + Number(e.amount), 0),
  );
  const sum = (l: Order[]) => r2(l.reduce((s, o) => s + Number(o.total), 0));
  const pend = inRange.filter((o) => o.status === 'aguardando_pagamento');
  const canc = inRange.filter((o) => o.status === 'cancelado');
  const byMethod: Report['byMethod'] = {};
  for (const o of sold) {
    const m = (byMethod[o.payment_method] ??= { orders: 0, revenue: 0 });
    m.orders++;
    m.revenue = r2(m.revenue + Number(o.total));
  }
  return {
    revenue, productRevenue, cogs, discounts, grossProfit, fees, expenses: exp,
    netProfit: r2(grossProfit - fees - exp),
    orders: sold.length,
    avgTicket: sold.length ? r2(revenue / sold.length) : 0,
    pending: { count: pend.length, total: sum(pend) },
    cancelled: { count: canc.length, total: sum(canc) },
    byMethod,
  };
}

/** Taxa de pagamento estimada a partir da configuração (percentual por forma de pagamento). */
export function estimateFee(total: number, method: string, pct: { pix?: number; cartao?: number }): number {
  const p = method === 'pix' ? pct.pix ?? 0 : method === 'cartao' ? pct.cartao ?? 0 : 0;
  return r2((total * p) / 100);
}

/** Transições de status permitidas (evita pular etapas ou reativar pedido entregue). */
export const STATUS_FLOW: Record<string, string[]> = {
  aguardando_pagamento: ['pago', 'cancelado'],
  pago: ['em_separacao', 'enviado', 'cancelado'],
  em_separacao: ['enviado', 'entregue', 'cancelado'],
  enviado: ['entregue', 'cancelado'],
  entregue: [],
  cancelado: ['aguardando_pagamento'],
};
export const canTransition = (from: string, to: string) => from === to || (STATUS_FLOW[from] ?? []).includes(to);
