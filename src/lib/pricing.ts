// Regras de preço. Espelham EXATAMENTE a função create_order do banco (que é a fonte da verdade);
// aqui servem para mostrar a prévia do carrinho ao cliente.

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export type Priced = { price: number; promo_price: number | null };

export function hasPromo(p: Priced): boolean {
  return p.promo_price != null && p.promo_price > 0 && p.promo_price < p.price;
}

export function unitPrice(p: Priced): number {
  return hasPromo(p) ? (p.promo_price as number) : p.price;
}

export function discountPercent(p: Priced): number {
  return hasPromo(p) ? Math.round((1 - (p.promo_price as number) / p.price) * 100) : 0;
}

export type CouponRule = { type: 'percent' | 'fixed'; value: number; min_order: number };

export function couponDiscount(c: CouponRule | null, subtotal: number): number {
  if (!c || subtotal < c.min_order) return 0;
  const d = c.type === 'percent' ? (subtotal * Math.min(c.value, 100)) / 100 : Math.min(c.value, subtotal);
  return round2(d);
}

export type ShippingRule = { flat: number; free_above: number; pickup: boolean };

export function shippingCost(rule: ShippingRule, subtotalAfterDiscount: number, delivery: 'entrega' | 'retirada'): number {
  if (delivery === 'retirada') return 0;
  if (rule.free_above > 0 && subtotalAfterDiscount >= rule.free_above) return 0;
  return round2(rule.flat);
}

export type Line = { price: number; quantity: number };

export function orderTotals(
  lines: Line[],
  discount: number,
  rule: ShippingRule,
  delivery: 'entrega' | 'retirada',
) {
  const subtotal = round2(lines.reduce((s, l) => s + l.price * l.quantity, 0));
  const disc = round2(Math.min(discount, subtotal));
  const shipping = lines.length ? shippingCost(rule, subtotal - disc, delivery) : 0;
  return { subtotal, discount: disc, shipping, total: round2(subtotal - disc + shipping) };
}

export function clampQty(q: number, stock: number): number {
  const n = Math.floor(Number(q) || 1);
  return Math.max(1, Math.min(n, Math.max(stock, 1), 99));
}
