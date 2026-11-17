'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useCart } from '@/components/CartProvider';
import { brl, onlyDigits, PAYMENT_LABEL } from '@/lib/format';
import { orderTotals, type ShippingRule } from '@/lib/pricing';

type Method = 'pix' | 'cartao' | 'whatsapp';

export default function CheckoutForm({ shipping, payments }: { shipping: ShippingRule; payments: Record<Method, boolean>; hasMp: boolean }) {
  const { items, coupon, delivery, setDelivery, clear, ready } = useCart();
  const router = useRouter();
  const methods = (Object.keys(PAYMENT_LABEL) as Method[]).filter((m) => payments[m]);
  const [method, setMethod] = useState<Method>(methods[0] ?? 'whatsapp');
  const [f, setF] = useState({ name: '', phone: '', email: '', cep: '', street: '', number: '', complement: '', district: '', city: '', state: '', notes: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [k]: e.target.value }));
  const totals = orderTotals(items, coupon?.discount ?? 0, shipping, delivery);

  async function cepLookup() {
    const cep = onlyDigits(f.cep);
    if (cep.length !== 8) return;
    try {
      const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const d = await r.json();
      if (!d.erro) setF((p) => ({ ...p, street: d.logradouro || p.street, district: d.bairro || p.district, city: d.localidade || p.city, state: d.uf || p.state }));
    } catch {}
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    if (onlyDigits(f.phone).length < 10) return setErr('Informe um telefone/WhatsApp válido com DDD.');
    if (delivery === 'entrega' && (!f.street || !f.number || !f.city)) return setErr('Preencha o endereço de entrega.');
    setBusy(true);
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: { name: f.name, phone: f.phone, email: f.email },
          address: delivery === 'entrega' ? { cep: f.cep, street: f.street, number: f.number, complement: f.complement, district: f.district, city: f.city, state: f.state } : {},
          items: items.map((i) => ({ product_id: i.id, quantity: i.quantity })),
          coupon: coupon?.code ?? '',
          payment_method: method,
          delivery,
          notes: f.notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao finalizar o pedido');
      clear();
      if (/^https?:/.test(data.redirect)) window.location.href = data.redirect;
      else router.push(data.redirect);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao finalizar o pedido');
      setBusy(false);
    }
  }

  if (!ready) return <div className="container page-pad muted">Carregando…</div>;
  if (items.length === 0)
    return (
      <div className="container page-pad empty">
        <h1 className="page-title">Seu carrinho está vazio</h1>
        <Link href="/loja" className="btn btn-dark">
          Ver produtos
        </Link>
      </div>
    );

  return (
    <div className="container page-pad">
      <h1 className="page-title">Finalizar compra</h1>
      <form className="cart-layout" onSubmit={submit}>
        <div className="form-col">
          <fieldset className="box">
            <legend>Seus dados</legend>
            <label>Nome completo<input required value={f.name} onChange={set('name')} autoComplete="name" /></label>
            <div className="two">
              <label>WhatsApp / telefone<input required value={f.phone} onChange={set('phone')} inputMode="tel" autoComplete="tel" placeholder="(85) 99999-9999" /></label>
              <label>E-mail<input type="email" value={f.email} onChange={set('email')} autoComplete="email" /></label>
            </div>
          </fieldset>

          <fieldset className="box">
            <legend>Entrega</legend>
            <div className="opts row">
              <label><input type="radio" checked={delivery === 'entrega'} onChange={() => setDelivery('entrega')} /> Entrega</label>
              {shipping.pickup && <label><input type="radio" checked={delivery === 'retirada'} onChange={() => setDelivery('retirada')} /> Retirada</label>}
            </div>
            {delivery === 'entrega' && (
              <>
                <div className="two">
                  <label>CEP<input value={f.cep} onChange={set('cep')} onBlur={cepLookup} inputMode="numeric" autoComplete="postal-code" /></label>
                  <label>Estado (UF)<input value={f.state} onChange={set('state')} maxLength={2} autoComplete="address-level1" /></label>
                </div>
                <label>Rua<input required value={f.street} onChange={set('street')} autoComplete="address-line1" /></label>
                <div className="two">
                  <label>Número<input required value={f.number} onChange={set('number')} /></label>
                  <label>Complemento<input value={f.complement} onChange={set('complement')} /></label>
                </div>
                <div className="two">
                  <label>Bairro<input value={f.district} onChange={set('district')} /></label>
                  <label>Cidade<input required value={f.city} onChange={set('city')} autoComplete="address-level2" /></label>
                </div>
              </>
            )}
            <label>Observações<textarea rows={2} value={f.notes} onChange={set('notes')} /></label>
          </fieldset>

          <fieldset className="box">
            <legend>Pagamento</legend>
            <div className="opts">
              {methods.map((m) => (
                <label key={m}>
                  <input type="radio" name="pay" checked={method === m} onChange={() => setMethod(m)} /> {PAYMENT_LABEL[m]}
                  {m === 'pix' && <small> — aprovação imediata</small>}
                  {m === 'cartao' && <small> — em até 12x</small>}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <aside className="summary">
          <h2>Seu pedido</h2>
          {items.map((i) => (
            <div className="mini" key={i.id}>
              <span>{i.quantity}× {i.name}</span>
              <span>{brl(i.price * i.quantity)}</span>
            </div>
          ))}
          <dl className="totals">
            <div><dt>Subtotal</dt><dd>{brl(totals.subtotal)}</dd></div>
            {totals.discount > 0 && <div className="ok"><dt>Cupom {coupon?.code}</dt><dd>− {brl(totals.discount)}</dd></div>}
            <div><dt>Frete</dt><dd>{totals.shipping === 0 ? 'Grátis' : brl(totals.shipping)}</dd></div>
            <div className="grand"><dt>Total</dt><dd>{brl(totals.total)}</dd></div>
          </dl>
          {err && <p className="err" role="alert">{err}</p>}
          <button className="btn btn-gold block" disabled={busy}>
            {busy ? 'Enviando…' : method === 'whatsapp' ? 'Enviar pedido' : 'Ir para o pagamento'}
          </button>
          <p className="muted small">Preços e estoque são conferidos novamente no servidor ao finalizar.</p>
        </aside>
      </form>
    </div>
  );
}
