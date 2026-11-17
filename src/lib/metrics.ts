import type { Order } from './types';

/** Pedidos que contam como venda (pagos ou em andamento). Ficam de fora: aguardando pagamento e cancelados. */
const SOLD = new Set(['pago', 'em_separacao', 'enviado', 'entregue']);
export const isSold = (o: Pick<Order, 'status'>): boolean => SOLD.has(o.status);

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const startOfWeek = (d: Date) => {
  const s = startOfDay(d);
  const diff = (s.getDay() + 6) % 7; // semana começa na segunda
  s.setDate(s.getDate() - diff);
  return s;
};
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

/** Lucro estimado do pedido = Σ (preço - custo) × qtd − desconto do cupom. O frete é tratado como repasse. */
export function orderProfit(o: Order): number {
  const gross = (o.order_items ?? []).reduce((s, i) => s + (Number(i.price) - Number(i.cost)) * i.quantity, 0);
  return r2(gross - Number(o.discount || 0));
}

export type Metrics = ReturnType<typeof computeMetrics>;

export function computeMetrics(orders: Order[], now: Date = new Date(), days = 14) {
  const sold = orders.filter(isSold);
  const sum = (list: Order[]) => r2(list.reduce((s, o) => s + Number(o.total), 0));
  const since = (from: Date) => sold.filter((o) => new Date(o.created_at) >= from);

  const day = since(startOfDay(now));
  const week = since(startOfWeek(now));
  const month = since(startOfMonth(now));

  const revenue = sum(sold);
  const profit = r2(sold.reduce((s, o) => s + orderProfit(o), 0));

  // série diária
  const series: { date: string; label: string; revenue: number; orders: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
    const list = sold.filter((o) => {
      const t = new Date(o.created_at);
      return t >= d && t < next;
    });
    series.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      revenue: sum(list),
      orders: list.length,
    });
  }

  // mais vendidos
  const byProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
  for (const o of sold)
    for (const i of o.order_items ?? []) {
      const cur = byProduct.get(i.name) ?? { name: i.name, quantity: 0, revenue: 0 };
      cur.quantity += i.quantity;
      cur.revenue = r2(cur.revenue + Number(i.price) * i.quantity);
      byProduct.set(i.name, cur);
    }
  const topProducts = [...byProduct.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue).slice(0, 5);

  const statusCount: Record<string, number> = {};
  for (const o of orders) statusCount[o.status] = (statusCount[o.status] ?? 0) + 1;

  return {
    revenue,
    profit,
    orderCount: sold.length,
    totalOrders: orders.length,
    avgTicket: sold.length ? r2(revenue / sold.length) : 0,
    today: { revenue: sum(day), orders: day.length },
    week: { revenue: sum(week), orders: week.length },
    month: { revenue: sum(month), orders: month.length },
    series,
    topProducts,
    statusCount,
  };
}

export type CustomerSummary = { orders: number; spent: number; lastOrder: string | null; recurring: boolean };

export function summarizeCustomer(orders: Pick<Order, 'status' | 'total' | 'created_at'>[]): CustomerSummary {
  const valid = orders.filter((o) => o.status !== 'cancelado');
  const sold = valid.filter((o) => SOLD.has(o.status));
  const last = valid.map((o) => o.created_at).sort().pop() ?? null;
  return {
    orders: valid.length,
    spent: r2(sold.reduce((s, o) => s + Number(o.total), 0)),
    lastOrder: last,
    recurring: valid.length >= 2,
  };
}
