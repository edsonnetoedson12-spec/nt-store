'use client';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { download } from '@/lib/admin';
import { toCsv } from '@/lib/csv';
import { createClient } from '@/lib/supabase/client';
import { brl, dateBR, formatPhone, STATUS_LABEL, whatsappNumber } from '@/lib/format';
import { summarizeCustomer } from '@/lib/metrics';
import type { Customer, Order } from '@/lib/types';

type Row = Customer & { orders: Order[] };

export default function CustomersAdmin() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [only, setOnly] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    createClient().from('customers').select('*, orders(*, order_items(*))').order('created_at', { ascending: false }).then(({ data, error }) => {
      if (error) setErr(error.message);
      setRows((data ?? []) as unknown as Row[]);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Possíveis duplicados: mesmo e-mail ou mesmos 8 últimos dígitos do telefone.
  const dups = useMemo(() => {
    const groups = new Map<string, Row[]>();
    for (const r of rows) {
      for (const k of [r.email ? `e:${r.email.toLowerCase()}` : '', r.phone.length >= 8 ? `p:${r.phone.slice(-8)}` : '']) {
        if (!k) continue;
        groups.set(k, [...(groups.get(k) ?? []), r]);
      }
    }
    const seen = new Set<string>();
    return [...groups.values()].filter((g) => g.length > 1).filter((g) => {
      const id = g.map((x) => x.id).sort().join();
      return seen.has(id) ? false : (seen.add(id), true);
    });
  }, [rows]);

  async function merge(g: Row[]) {
    const [keep, ...rest] = [...g].sort((a, b) => b.orders.length - a.orders.length);
    if (!confirm(`Unir ${rest.length + 1} cadastros em "${keep.name}"? Os pedidos são movidos para ele; nenhum pedido é apagado.`)) return;
    const sb = createClient();
    for (const d of rest) {
      const { error } = await sb.rpc('merge_customers', { p_keep: keep.id, p_drop: d.id });
      if (error) return setErr(error.message.includes('function') ? 'Aplique a migração 003 no Supabase para usar a união de clientes.' : error.message);
    }
    setErr('');
    load();
  }

  function exportCsv() {
    download(`clientes-nt-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(['Nome', 'Telefone', 'E-mail', 'Pedidos', 'Total gasto', 'Último pedido', 'Recorrente'],
      view.map(({ r, s }) => [r.name, r.phone, r.email ?? '', s.orders, s.spent, s.lastOrder ? dateBR(s.lastOrder) : '', s.recurring ? 'sim' : 'nao'])));
  }

  const view = rows
    .map((r) => ({ r, s: summarizeCustomer(r.orders) }))
    .filter(({ r, s }) => (!only || s.recurring) && (r.name.toLowerCase().includes(q.toLowerCase()) || r.phone.includes(q.replace(/\D/g, '') || '§')));

  return (
    <>
      <div className="adm-head">
        <h1 className="adm-title">Clientes</h1>
        <div className="adm-actions">
          <input placeholder="Buscar por nome ou telefone" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar cliente" />
          <button className="btn btn-light sm" onClick={exportCsv}>Exportar CSV</button>
          <label className="check"><input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} /> Só recorrentes</label>
        </div>
      </div>
      {err && <p className="err">{err}</p>}
      {dups.length > 0 && (
        <div className="import-box">
          <strong>Possíveis cadastros duplicados ({dups.length})</strong>
          {dups.map((g) => (
            <div className="row-between" key={g.map((x) => x.id).join()}>
              <span>{g.map((x) => `${x.name} (${formatPhone(x.phone)})`).join(' = ')}</span>
              <button className="link" onClick={() => merge(g)}>Unir</button>
            </div>
          ))}
        </div>
      )}
      <p className="muted">Clientes são cadastrados automaticamente a cada compra.</p>
      <ResponsiveTable>
        <table>
          <thead><tr><th>Nome</th><th>Telefone</th><th className="r">Pedidos</th><th className="r">Total gasto</th><th>Último pedido</th><th></th></tr></thead>
          <tbody>
            {view.map(({ r, s }) => (
              <Fragment key={r.id}>
                <tr>
                  <td><div className="cell-stack"><span><strong>{r.name}</strong> {s.recurring && <span className="pill s-pago">Recorrente</span>}</span><small className="muted">{r.email}</small></div></td>
                  <td><a className="link" target="_blank" rel="noopener noreferrer" href={`https://wa.me/${whatsappNumber(r.phone)}`}>{formatPhone(r.phone)}</a></td>
                  <td className="r">{s.orders}</td>
                  <td className="r">{brl(s.spent)}</td>
                  <td>{s.lastOrder ? dateBR(s.lastOrder) : '—'}</td>
                  <td className="r"><button className="link" onClick={() => setOpen(open === r.id ? null : r.id)}>Histórico</button></td>
                </tr>
                {open === r.id && (
                  <tr className="detail"><td colSpan={6}>
                    {r.orders.length === 0 && <p className="muted">Sem pedidos.</p>}
                    {[...r.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((o) => (
                      <div key={o.id} className="row-between">
                        <span>#{o.number} · {dateBR(o.created_at)} · {o.order_items?.map((i) => `${i.quantity}× ${i.name}`).join(', ')}</span>
                        <span>{brl(o.total)} · {STATUS_LABEL[o.status]}</span>
                      </div>
                    ))}
                  </td></tr>
                )}
              </Fragment>
            ))}
            {view.length === 0 && <tr><td colSpan={6} className="muted">Nenhum cliente.</td></tr>}
          </tbody>
        </table>
      </ResponsiveTable>
    </>
  );
}
