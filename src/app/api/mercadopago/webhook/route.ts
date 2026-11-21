import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// O Mercado Pago avisa aqui quando um pagamento muda. Nunca confiamos no corpo recebido:
// consultamos o pagamento direto na API do Mercado Pago com o nosso token.
export async function POST(req: Request) {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token || !process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ ok: false }, { status: 503 });

  const url = new URL(req.url);
  let id = url.searchParams.get('data.id') || url.searchParams.get('id');
  let type = url.searchParams.get('type') || url.searchParams.get('topic');
  try {
    const b = await req.json();
    id = id || String(b?.data?.id ?? '');
    type = type || b?.type;
  } catch {}
  if (type !== 'payment' || !id) return NextResponse.json({ ok: true });

  const res = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return NextResponse.json({ ok: false }, { status: 502 });
  const pay = await res.json();
  const orderId: string | undefined = pay.external_reference;
  if (!orderId) return NextResponse.json({ ok: true });

  const sb = createServiceClient();
  const { data: order } = await sb.from('orders').select('id,total,status').eq('id', orderId).maybeSingle();
  if (!order) return NextResponse.json({ ok: true });
  if (pay.status === 'approved') {
    // Integridade: só marca como pago se o valor aprovado cobre o total do pedido.
    const paid = Number(pay.transaction_amount ?? 0);
    if (paid + 0.009 < Number(order.total)) {
      console.error('Pagamento com valor diferente do pedido', { orderId, paid, total: order.total });
      await sb.from('orders').update({ mp_payment_id: String(id), notes: 'ATENÇÃO: pagamento aprovado com valor diferente do total. Conferir no Mercado Pago.' }).eq('id', orderId);
      return NextResponse.json({ ok: true });
    }
    const fee = Array.isArray(pay.fee_details) ? pay.fee_details.reduce((s: number, f: { amount?: number }) => s + Number(f.amount || 0), 0) : 0;
    await sb.from('orders').update({ status: 'pago', mp_payment_id: String(id), payment_fee: Math.round(fee * 100) / 100 }).eq('id', orderId).eq('status', 'aguardando_pagamento');
  } else if (pay.status === 'cancelled' || pay.status === 'rejected') {
    await sb.from('orders').update({ mp_payment_id: String(id) }).eq('id', orderId);
  }
  return NextResponse.json({ ok: true });
}

export async function GET() {
  return NextResponse.json({ ok: true });
}
