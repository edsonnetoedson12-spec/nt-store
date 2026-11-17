'use client';
import Link from 'next/link';
import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { createClient } from '@/lib/supabase/client';
import { brl } from '@/lib/format';
import { orderTotals, type ShippingRule } from '@/lib/pricing';

export default function CartView({ shipping }: { shipping: ShippingRule }) {
  const { items, subtotal, coupon, delivery, setQty, remove, setCoupon, setDelivery, ready } = useCart();
  const [code, setCode] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = orderTotals(items, coupon?.discount ?? 0, shipping, delivery);

  async function applyCoupon() {
    if (!code.trim()) return;
    setBusy(true);
    const { data, error } = await createClient().rpc('validate_coupon', { p_code: code, p_subtotal: subtotal });
    setBusy(false);
    if (error || !data) return setMsg({ ok: false, text: 'Não foi possível validar o cupom agora.' });
    if (data.valid) {
      setCoupon({ code: data.code, discount: Number(data.discount) });
      setMsg({ ok: true, text: `Cupom ${data.code} aplicado!` });
    } else {
      setCoupon(null);
      setMsg({ ok: false, text: data.message });
    }
  }

  if (!ready) return <div className="container page-pad muted">Carregando…</div>;
  if (items.length === 0)
    return (
      <div className="container page-pad empty">
        <h1 className="page-title">Seu carrinho está vazio</h1>
        <p>Que tal conhecer nossas novidades?</p>
        <Link href="/loja" className="btn btn-dark">
          Ver produtos
        </Link>
      </div>
    );

  return (
    <div className="container page-pad">
      <h1 className="page-title">Carrinho</h1>
      <div className="cart-layout">
        <div className="cart-list">
          {items.map((i) => (
            <div className="cart-row" key={i.id}>
              <img src={i.image || '/placeholders/produto.svg'} alt={i.name} />
              <div className="cart-info">
                <Link href={`/produto/${i.slug}`}>{i.name}</Link>
                <span className="muted">{brl(i.price)} cada</span>
                <button className="link danger" onClick={() => remove(i.id)}>
                  Remover
                </button>
              </div>
              <div className="qty">
                <button onClick={() => setQty(i.id, i.quantity - 1)} aria-label="Diminuir" disabled={i.quantity <= 1}>
                  −
                </button>
                <span>{i.quantity}</span>
                <button onClick={() => setQty(i.id, i.quantity + 1)} aria-label="Aumentar" disabled={i.quantity >= i.stock}>
                  +
                </button>
              </div>
              <strong className="cart-line">{brl(i.price * i.quantity)}</strong>
            </div>
          ))}
        </div>

        <aside className="summary">
          <h2>Resumo</h2>
          <div className="coupon">
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Cupom de desconto" aria-label="Cupom" />
            <button className="btn btn-dark sm" onClick={applyCoupon} disabled={busy}>
              Aplicar
            </button>
          </div>
          {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.text}</p>}

          <fieldset className="opts">
            <legend>Entrega</legend>
            <label>
              <input type="radio" name="del" checked={delivery === 'entrega'} onChange={() => setDelivery('entrega')} /> Entrega
              {shipping.free_above > 0 && <small> (grátis acima de {brl(shipping.free_above)})</small>}
            </label>
            {shipping.pickup && (
              <label>
                <input type="radio" name="del" checked={delivery === 'retirada'} onChange={() => setDelivery('retirada')} /> Retirada (grátis)
              </label>
            )}
          </fieldset>

          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{brl(totals.subtotal)}</dd></div>
            {totals.discount > 0 && <div className="ok"><dt>Desconto</dt><dd>− {brl(totals.discount)}</dd></div>}
            <div><dt>Frete</dt><dd>{totals.shipping === 0 ? 'Grátis' : brl(totals.shipping)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{brl(totals.total)}</dd></div>
          </dl>
          <Link href="/checkout" className="btn btn-gold block">
            Finalizar compra
          </Link>
          <Link href="/loja" className="link center">
            Continuar comprando
          </Link>
        </aside>
      </div>
    </div>
  );
}
