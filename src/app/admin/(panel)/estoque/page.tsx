'use client';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { download, refreshStore } from '@/lib/admin';
import { toCsv } from '@/lib/csv';
import { dateBR } from '@/lib/format';
import type { Product, Variant } from '@/lib/types';

type Mov = { id: string; product_name: string | null; delta: number; stock_after: number; reason: string; created_at: string };

export default function StockAdmin() {
  const sb = createClient();
  const [products, setProducts] = useState<Product[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [onlyLow, setOnlyLow] = useState(true);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const [p, v, m] = await Promise.all([
      sb.from('products').select('*').order('stock'),
      sb.from('product_variants').select('*').order('name'),
      sb.from('stock_movements').select('id,product_name,delta,stock_after,reason,created_at').order('created_at', { ascending: false }).limit(40),
    ]);
    setProducts((p.data ?? []) as Product[]);
    setVariants((v.data ?? []) as Variant[]);
    setMovs((m.data ?? []) as Mov[]);
    if (p.error) setMsg(p.error.message);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function adjust(table: 'products' | 'product_variants', id: string, stock: number) {
    const { error } = await sb.from(table).update({ stock: Math.max(0, Math.floor(stock)) }).eq('id', id);
    setMsg(error ? error.message : '');
    await load();
    refreshStore();
  }

  const low = (p: Product) => p.stock <= (p.min_stock ?? 5);
  const shown = products.filter((p) => !onlyLow || low(p));
  const Qty = ({ value, onSet }: { value: number; onSet: (n: number) => void }) => (
    <span className="stock">
      <button onClick={() => onSet(value - 1)} aria-label="Diminuir">−</button>
      <input type="number" min={0} defaultValue={value} key={value} style={{ width: 64, textAlign: 'center' }} onBlur={(e) => Number(e.target.value) !== value && onSet(Number(e.target.value))} aria-label="Estoque" />
      <button onClick={() => onSet(value + 1)} aria-label="Aumentar">+</button>
    </span>
  );

  return (
    <>
      <div className="adm-head">
        <h1 className="adm-title">Estoque</h1>
        <div className="adm-actions">
          <label className="check"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} /> Só estoque baixo</label>
          <button className="btn btn-light sm" onClick={() => download('estoque.csv', toCsv(['SKU', 'Produto', 'Variação', 'Estoque', 'Mínimo'], products.flatMap((p) => p.has_variants ? variants.filter((v) => v.product_id === p.id).map((v) => [v.sku ?? p.sku ?? '', p.name, v.name, v.stock, p.min_stock ?? 5]) : [[p.sku ?? '', p.name, '', p.stock, p.min_stock ?? 5]])))}>Exportar CSV</button>
        </div>
      </div>
      {msg && <p className="err">{msg}</p>}
      <ResponsiveTable>
        <table>
          <thead><tr><th>Produto</th><th>SKU</th><th className="r">Mínimo</th><th className="r">Estoque</th><th>Situação</th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <Fragment key={p.id}>
                <tr>
                  <td><strong>{p.name}</strong></td>
                  <td>{p.sku ?? '—'}</td>
                  <td className="r">{p.min_stock ?? 5}</td>
                  <td className="r">{p.has_variants ? <b>{p.stock}</b> : <Qty value={p.stock} onSet={(n) => adjust('products', p.id, n)} />}</td>
                  <td>{p.stock === 0 ? <span className="pill s-cancelado">Esgotado</span> : low(p) ? <span className="pill s-aguardando_pagamento">Baixo</span> : <span className="pill s-pago">Ok</span>}</td>
                </tr>
                {p.has_variants && variants.filter((v) => v.product_id === p.id).map((v) => (
                  <tr key={v.id}>
                    <td style={{ paddingLeft: 28 }} className="muted">↳ {v.name}</td><td>{v.sku ?? '—'}</td><td></td>
                    <td className="r"><Qty value={v.stock} onSet={(n) => adjust('product_variants', v.id, n)} /></td><td></td>
                  </tr>
                ))}
              </Fragment>
            ))}
            {shown.length === 0 && <tr><td colSpan={5} className="muted">Nenhum produto com estoque baixo.</td></tr>}
          </tbody>
        </table>
      </ResponsiveTable>
      <h2 style={{ marginTop: 24 }}>Últimas movimentações</h2>
      <ResponsiveTable>
        <table>
          <thead><tr><th>Data</th><th>Produto</th><th className="r">Variação</th><th className="r">Saldo</th><th>Motivo</th></tr></thead>
          <tbody>
            {movs.map((m) => (
              <tr key={m.id}><td>{dateBR(m.created_at)}</td><td>{m.product_name}</td><td className="r">{m.delta > 0 ? `+${m.delta}` : m.delta}</td><td className="r">{m.stock_after}</td><td>{m.reason}</td></tr>
            ))}
            {movs.length === 0 && <tr><td colSpan={5} className="muted">Sem movimentações registradas ainda.</td></tr>}
          </tbody>
        </table>
      </ResponsiveTable>
    </>
  );
}
