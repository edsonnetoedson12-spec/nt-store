import { NextResponse } from 'next/server';
import { createPublicClient, createServiceClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/data';

type Body = {
  customer?: { name?: string; phone?: string; email?: string };
  address?: Record<string, string>;
  items?: { product_id?: string; variant_id?: string; quantity?: number }[];
  idempotency_key?: string;
  coupon?: string;
  payment_method?: string;
  delivery?: string;
  notes?: string;
};

// Limite simples por IP (best-effort: cada instância serverless tem sua memória). O banco já impede estoque negativo.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const list = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 8;
}

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || 'x').split(',')[0].trim();
  if (limited(ip)) return NextResponse.json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' }, { status: 429 });
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Requisição inválida' }, { status: 400 });
  }

  // Só repassamos campos conhecidos (o banco valida e recalcula preços e estoque).
  const address: Record<string, string> = {};
  for (const k of ['cep', 'street', 'number', 'complement', 'district', 'city', 'state'])
    address[k] = str(body.address?.[k], 120);
  const payload = {
    customer: { name: str(body.customer?.name, 120), phone: str(body.customer?.phone, 30), email: str(body.customer?.email, 160) },
    address,
    items: (Array.isArray(body.items) ? body.items.slice(0, 50) : []).map((i) => ({ product_id: str(i.product_id, 40), variant_id: str(i.variant_id, 40) || null, quantity: Number(i.quantity) || 0 })),
    coupon: str(body.coupon, 40),
    payment_method: str(body.payment_method, 20),
    delivery: str(body.delivery, 20),
    notes: str(body.notes, 500),
    idempotency_key: str(body.idempotency_key, 40) || null,
  };

  const sb = createPublicClient();
  const { data, error } = await sb.rpc('create_order', { p: payload });
  if (error || !data) {
    const msg = error?.message && !/^(duplicate|insert|new row|invalid input|permission)/i.test(error.message) ? error.message : 'Não foi possível criar o pedido';
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const order = data as { order_id: string; number: number; total: number; duplicate?: boolean };
  const result: { number: number; redirect: string } = { number: order.number, redirect: `/pedido?n=${order.number}&t=${order.total}` };

  // Mercado Pago (Checkout Pro): PIX e cartão. Se não houver token, o pedido fica "aguardando pagamento".
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (token && !order.duplicate && (payload.payment_method === 'pix' || payload.payment_method === 'cartao')) {
    try {
      const excluded =
        payload.payment_method === 'pix'
          ? ['credit_card', 'debit_card', 'ticket', 'atm', 'prepaid_card']
          : ['bank_transfer', 'ticket', 'atm'];
      const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [{ id: String(order.number), title: `Pedido NT #${order.number}`, quantity: 1, currency_id: 'BRL', unit_price: Number(order.total) }],
          payer: { name: payload.customer.name, email: payload.customer.email || undefined },
          external_reference: order.order_id,
          payment_methods: { excluded_payment_types: excluded.map((id) => ({ id })), installments: 12 },
          back_urls: {
            success: `${SITE_URL}/pedido?n=${order.number}&t=${order.total}&mp=ok`,
            pending: `${SITE_URL}/pedido?n=${order.number}&t=${order.total}&mp=pending`,
            failure: `${SITE_URL}/pedido?n=${order.number}&t=${order.total}&mp=fail`,
          },
          auto_return: 'approved',
          notification_url: `${SITE_URL}/api/mercadopago/webhook`,
        }),
      });
      const pref = await res.json();
      if (res.ok && pref.init_point) {
        result.redirect = pref.init_point;
        if (process.env.SUPABASE_SERVICE_ROLE_KEY)
          await createServiceClient().from('orders').update({ mp_preference_id: pref.id }).eq('id', order.order_id);
      } else {
        console.error('Mercado Pago preference error', pref);
      }
    } catch (e) {
      console.error('Mercado Pago error', e);
    }
  }
  return NextResponse.json(result);
}
