'use client';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { refreshStore } from '@/lib/admin';
import { brl, dateBR, formatPhone, PAYMENT_LABEL, STATUS_LABEL, STATUS_ORDER, whatsappNumber } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

export default function OrdersAdmin() {
  const sb = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'' | OrderStatus>('');
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data, error } = await sb.from('orders').select('*, order_items(*), customers(*)').order('created_at', { ascending: false }).limit(500);
    if (error) setMsg(error.message);
    setOrders((data ?? []) as Order[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function setStatus(o: Order, status: OrderStatus) {
    if (status === 'cancelado' && !confirm('Cancelar o pedido? O estoque dos produtos será devolvido.')) return;
    const { error } = await sb.from('orders').update({ status }).eq('id', o.id);
    if (error) return setMsg(error.message);
    setMsg('');
    await load();
    refreshStore(); // estoque pode ter mudado
  }
  async function setTracking(o: Order, code: string) {
    await sb.from('orders').update({ tracking_code: code.trim() || null }).eq('id', o.id);
    await load();
  }

  const shown = orders.filter((o) => !filter || o.status === filter);
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;

  return (
    <>
      <h1 className="adm-title">Pedidos</h1>
      <div className="chips">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => setFilter('')}>Todos ({orders.length})</button>
        {STATUS_ORDER.map((s) => (
          <button key={s} className={filter === s ? 'chip on' : 'chip'} onClick={() => setFilter(s)}>{STATUS_LABEL[s]} ({count(s)})</button>
        ))}
      </div>
      {msg && <p className="err">{msg}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Pagamento</th><th className="r">Total</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((o) => (
              <Fragment key={o.id}>
                <tr>
                  <td><strong>#{o.number}</strong></td>
                  <td>{dateBR(o.created_at)}</td>
                  <td>{o.customers?.name ?? '—'}</td>
                  <td>{PAYMENT_LABEL[o.payment_method]}</td>
                  <td className="r">{brl(o.total)}</td>
                  <td>
                    <select className={`pill-select s-${o.status}`} value={o.status} onChange={(e) => setStatus(o, e.target.value as OrderStatus)} aria-label={`Status do pedido ${o.number}`}>
                      {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="r"><button className="link" onClick={() => setOpen(open === o.id ? null : o.id)}>{open === o.id ? 'Ocultar' : 'Detalhes'}</button></td>
                </tr>
                {open === o.id && (
                  <tr className="detail">
                    <td colSpan={7}>
                      <div className="detail-grid">
                        <div>
                          <h3>Cliente</h3>
                          <p>{o.customers?.name}<br />{o.customers ? formatPhone(o.customers.phone) : ''}<br />{o.customers?.email}</p>
                          {o.customers && <a className="link" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${whatsappNumber(o.customers.phone)}`}>Chamar no WhatsApp ↗</a>}
                          <h3>Entrega</h3>
                          {o.delivery === 'retirada' ? <p>Retirada na loja</p> : (
                            <p>{o.address.street}, {o.address.number} {o.address.complement}<br />{o.address.district} — {o.address.city}/{o.address.state}<br />CEP {o.address.cep}</p>
                          )}
                          {o.notes && <p><em>Obs.: {o.notes}</em></p>}
                          <label>Código de rastreio<input defaultValue={o.tracking_code ?? ''} onBlur={(e) => setTracking(o, e.target.value)} /></label>
                        </div>
                        <div>
                          <h3>Produtos</h3>
                          {o.order_items?.map((i) => (
                            <div className="row-between" key={i.id}><span>{i.quantity}× {i.name}</span><span>{brl(i.price * i.quantity)}</span></div>
                          ))}
                          <hr />
                          <div className="row-between"><span>Subtotal</span><span>{brl(o.subtotal)}</span></div>
                          {o.discount > 0 && <div className="row-between"><span>Cupom {o.coupon_code}</span><span>− {brl(o.discount)}</span></div>}
                          <div className="row-between"><span>Frete</span><span>{brl(o.shipping)}</span></div>
                          <div className="row-between"><strong>Total</strong><strong>{brl(o.total)}</strong></div>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {shown.length === 0 && <tr><td colSpan={7} className="muted">Nenhum pedido.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
