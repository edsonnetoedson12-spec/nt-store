'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Variant } from '@/lib/types';

/** Variações (cor, modelo do celular, tamanho…) com SKU e estoque próprios. O estoque do produto vira a soma. */
export default function VariantsEditor({ productId, onChange }: { productId: string; onChange: () => void }) {
  const sb = createClient();
  const [rows, setRows] = useState<Variant[]>([]);
  const [msg, setMsg] = useState('');
  const load = useCallback(async () => {
    const { data, error } = await sb.from('product_variants').select('*').eq('product_id', productId).order('sort').order('name');
    if (error) return setMsg('Variações indisponíveis: aplique a migração 003 no Supabase.');
    setRows((data ?? []) as Variant[]);
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function save(v: Variant) {
    setMsg('');
    const { error } = await sb.from('product_variants').update({ name: v.name.trim(), sku: v.sku?.trim() || null, stock: Math.max(0, Math.floor(Number(v.stock) || 0)), active: v.active }).eq('id', v.id);
    setMsg(error ? (error.message.includes('duplicate') ? 'Nome ou SKU repetido.' : error.message) : 'Variação salva.');
    await load();
    onChange();
  }
  async function add() {
    setMsg('');
    const name = prompt('Nome da variação (ex.: Preto / iPhone 13)');
    if (!name?.trim()) return;
    const { error } = await sb.from('product_variants').insert({ product_id: productId, name: name.trim(), stock: 0, sort: rows.length });
    setMsg(error ? (error.message.includes('duplicate') ? 'Já existe uma variação com esse nome.' : error.message) : '');
    await load();
    onChange();
  }
  async function remove(v: Variant) {
    if (!confirm(`Remover a variação "${v.name}"? Pedidos antigos continuam no histórico.`)) return;
    await sb.from('product_variants').delete().eq('id', v.id);
    await load();
    onChange();
  }
  const upd = (id: string, patch: Partial<Variant>) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <fieldset className="box variants-box">
      <legend>Variações (opcional)</legend>
      <p className="muted small">Com variações, o cliente escolhe a opção e o estoque é controlado por variação.</p>
      {rows.map((v) => (
        <div className="variant-row" key={v.id}>
          <input value={v.name} onChange={(e) => upd(v.id, { name: e.target.value })} aria-label="Nome da variação" />
          <input value={v.sku ?? ''} onChange={(e) => upd(v.id, { sku: e.target.value })} placeholder="SKU" aria-label="SKU" />
          <input type="number" min={0} value={v.stock} onChange={(e) => upd(v.id, { stock: Number(e.target.value) })} aria-label="Estoque" />
          <label className="chk"><input type="checkbox" checked={v.active} onChange={(e) => upd(v.id, { active: e.target.checked })} /> ativa</label>
          <button type="button" className="link" onClick={() => save(v)}>Salvar</button>
          <button type="button" className="link danger" onClick={() => remove(v)}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-light sm" onClick={add}>+ Adicionar variação</button>
      {msg && <p className="muted small" role="status">{msg}</p>}
    </fieldset>
  );
}
