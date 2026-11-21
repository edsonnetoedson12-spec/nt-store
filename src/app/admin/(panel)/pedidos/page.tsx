'use client';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { download, refreshStore } from '@/lib/admin';
import { canTransition } from '@/lib/finance';
import { toCsv } from '@/lib/csv';
import { brl, dateBR, formatPhone, PAYMENT_LABEL, STATUS_LABEL, STATUS_ORDER, whatsappNumber } from '@/lib/format';
import type { Order, OrderStatus } from '@/lib/types';

export default function OrdersAdmin() {
  const sb = createClient();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState<'' | OrderStatus>('');
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');
  const [hist, setHist] = useState<Record<string, { to_status: string; created_at: string }[]>>({});

  const load = useCallback(async () => {
    const { data, error } = await sb.from('orders').select('*, order_items(*), customers(*)').order('created_at', { ascending: false }).limit(500);
    if (error) setMsg(error.message);
    setOrders((data ?? []) as Order[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function setStatus(o: Order, status: OrderStatus) {
    if (!canTransition(o.status, status)) return setMsg(`Não é possível mudar de "${STATUS_LABEL[o.status]}" para "${STATUS_LABEL[status]}".`);
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

  async function toggle(o: Order) {
    setOpen(open === o.id ? null : o.id);
    if (!hist[o.id]) {
      const { data } = await sb.from('order_status_history').select('to_status,created_at').eq('order_id', o.id).order('created_at');
      setHist((h) => ({ ...h, [o.id]: (data ?? []) as { to_status: string; created_at: string }[] }));
    }
  }

  function exportCsv() {
    const head = ['Pedido', 'Data', 'Cliente', 'Telefone', 'E-mail', 'Pagamento', 'Status', 'Subtotal', 'Desconto', 'Frete', 'Total', 'Taxa de pagamento', 'Custo', 'Lucro bruto', 'Itens'];
    const rows = shown.map((o) => {
      const cost = (o.order_items ?? []).reduce((a, i) => a + Number(i.cost) * i.quantity, 0);
      return [o.number, dateBR(o.created_at), o.customers?.name ?? '', o.customers?.phone ?? '', o.customers?.email ?? '', PAYMENT_LABEL[o.payment_method], STATUS_LABEL[o.status], o.subtotal, o.discount, o.shipping, o.total, o.payment_fee ?? 0, cost, Math.round((o.subtotal - o.discount - cost) * 100) / 100, (o.order_items ?? []).map((i) => `${i.quantity}x ${i.name}${i.variant_name ? ` (${i.variant_name})` : ''}`).join(' | ')];
    });
    download(`pedidos-nt-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(head, rows));
  }

  const term = q.trim().toLowerCase().replace(/^#/, '');
  const shown = orders.filter((o) => (!filter || o.status === filter) && (!term || String(o.number) === term || (o.customers?.name ?? '').toLowerCase().includes(term) || (o.customers?.phone ?? '').includes(term.replace(/\D/g, '') || '§')));
  const count = (s: OrderStatus) => orders.filter((o) => o.status === s).length;

  return (
    <>
      <div className="adm-head">
        <h1 className="adm-title">Pedidos</h1>
        <input placeholder="Buscar por nº, nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar pedido" />
        <button className="btn btn-light sm" onClick={exportCsv} disabled={shown.length === 0}>Baixar planilha (CSV)</button>
      </div>
      <div className="chips">
        <button className={!filter ? 'chip on' : 'chip'} onClick={() => setFilter('')}>Todos ({orders.length})</button>
        {STATUS_ORDER.map((s) => (
          <button key={s} className={filter === s ? 'chip on' : 'chip'} onClick={() => setFilter(s)}>{STATUS_LABEL[s]} ({count(s)})</button>
        ))}
      </div>
      {msg && <p className="err">{msg}</p>}
      <ResponsiveTable>
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
                      {STATUS_ORDER.filter((s) => canTransition(o.status, s)).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </td>
                  <td className="r"><button className="link" onClick={() => toggle(o)}>{open === o.id ? 'Ocultar' : 'Detalhes'}</button></td>
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
                            <div className="row-between" key={i.id}><span>{i.quantity}× {i.name}{i.variant_name ? ` — ${i.variant_name}` : ''}{i.sku ? <small className="muted"> ({i.sku})</small> : null}</span><span>{brl(i.price * i.quantity)}</span></div>
                          ))}
                          <hr />
                          <div className="row-between"><span>Subtotal</span><span>{brl(o.subtotal)}</span></div>
                          {o.discount > 0 && <div className="row-between"><span>Cupom {o.coupon_code}</span><span>− {brl(o.discount)}</span></div>}
                          <div className="row-between"><span>Frete</span><span>{brl(o.shipping)}</span></div>
                          <div className="row-between"><strong>Total</strong><strong>{brl(o.total)}</strong></div>
                          {!!o.payment_fee && <div className="row-between muted"><span>Taxa de pagamento</span><span>− {brl(o.payment_fee)}</span></div>}
                          <h3>Histórico</h3>
                          {(hist[o.id] ?? []).map((h, k) => <div className="row-between" key={k}><span>{STATUS_LABEL[h.to_status as OrderStatus] ?? h.to_status}</span><small className="muted">{dateBR(h.created_at)}</small></div>)}
                          {hist[o.id]?.length === 0 && <small className="muted">Sem registros (aplique a migração 003).</small>}
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
      </ResponsiveTable>
    </>
  );
}
