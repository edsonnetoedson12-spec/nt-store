'use client';
import ResponsiveTable from '@/components/ResponsiveTable';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { download, num, refreshStore, uploadImage } from '@/lib/admin';
import VariantsEditor from '@/components/VariantsEditor';
import { margin } from '@/lib/finance';
import { parseProductCsv, PRODUCT_HEADERS, toCsv, type ProductImportRow } from '@/lib/csv';
import { brl, slugify } from '@/lib/format';
import type { Category, Product } from '@/lib/types';

type Form = {
  id?: string; name: string; slug: string; description: string; price: string; promo_price: string; cost: string; stock: string;
  category_id: string; images: string[]; featured: boolean; is_new: boolean; active: boolean;
  sku: string; brand: string; min_stock: string;
};
const EMPTY: Form = { name: '', slug: '', description: '', price: '', promo_price: '', cost: '', stock: '0', category_id: '', images: [], featured: false, is_new: false, active: true, sku: '', brand: '', min_stock: '5' };

export default function ProductsAdmin() {
  const sb = createClient();
  const [list, setList] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [imp, setImp] = useState<{ rows: ProductImportRow[]; errors: string[] } | null>(null);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([sb.from('products').select('*').order('created_at', { ascending: false }), sb.from('categories').select('*').order('sort')]);
    setList((p.data ?? []) as Product[]);
    setCats((c.data ?? []) as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const edit = (p: Product) => setForm({
    id: p.id, name: p.name, slug: p.slug, description: p.description ?? '', price: String(p.price), promo_price: p.promo_price != null ? String(p.promo_price) : '',
    cost: String(p.cost), stock: String(p.stock), category_id: p.category_id ?? '', images: p.images, featured: p.featured, is_new: p.is_new, active: p.active,
    sku: p.sku ?? '', brand: p.brand ?? '', min_stock: String(p.min_stock ?? 5),
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;
    const price = num(form.price), promo = form.promo_price.trim() === '' ? null : num(form.promo_price);
    if (price <= 0) return setMsg({ ok: false, t: 'Informe o preço.' });
    if (promo != null && promo >= price) return setMsg({ ok: false, t: 'O preço promocional deve ser menor que o preço normal.' });
    setBusy(true);
    const row = {
      name: form.name.trim(), slug: slugify(form.slug || form.name), description: form.description.trim() || null,
      price, promo_price: promo, cost: num(form.cost), stock: Math.max(0, Math.floor(num(form.stock))),
      category_id: form.category_id || null, images: form.images, featured: form.featured, is_new: form.is_new, active: form.active,
      sku: form.sku.trim() || null, brand: form.brand.trim() || null, min_stock: Math.max(0, Math.floor(num(form.min_stock))),
    };
    // Com variações o estoque é a soma delas (calculado pelo banco): não sobrescrever.
    if (form.id && list.find((x) => x.id === form.id)?.has_variants) delete (row as { stock?: number }).stock;
    const { error } = form.id ? await sb.from('products').update(row).eq('id', form.id) : await sb.from('products').insert(row);
    setBusy(false);
    if (error) return setMsg({ ok: false, t: error.message.includes('products_sku') ? 'Já existe um produto com esse SKU.' : error.message.includes('duplicate') ? 'Já existe um produto com esse endereço (slug).' : error.message });
    setForm(null);
    setMsg({ ok: true, t: 'Produto salvo. A loja já foi atualizada.' });
    await load();
    refreshStore();
  }

  async function remove(p: Product) {
    const { count } = await sb.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', p.id);
    if (count && count > 0) {
      if (!confirm(`"${p.name}" já tem ${count} venda(s) no histórico. Para preservar os relatórios ele será apenas OCULTADO da loja. Continuar?`)) return;
      await sb.from('products').update({ active: false }).eq('id', p.id);
      setMsg({ ok: true, t: 'Produto ocultado da loja (histórico de vendas preservado).' });
      await load();
      refreshStore();
      return;
    }
    if (!confirm(`Excluir "${p.name}"? Esta ação não pode ser desfeita.`)) return;
    const { error} = await sb.from('products').delete().eq('id', p.id);
    if (error) return setMsg({ ok: false, t: error.message });
    setMsg({ ok: true, t: 'Produto excluído.' });
    await load();
    refreshStore();
  }

  async function quickStock(p: Product, stock: number) {
    await sb.from('products').update({ stock: Math.max(0, stock) }).eq('id', p.id);
    await load();
    refreshStore();
  }

  async function onFiles(files: FileList | null) {
    if (!files || !form) return;
    setBusy(true);
    try {
      const urls: string[] = [];
      for (const f of Array.from(files)) urls.push(await uploadImage(f, 'products'));
      setForm((p) => (p ? { ...p, images: [...p.images, ...urls] } : p));
    } catch (e) {
      setMsg({ ok: false, t: e instanceof Error ? e.message : 'Falha no envio da imagem' });
    }
    setBusy(false);
  }

  function exportCsv() {
    const rows = list.map((p) => [p.sku ?? '', p.name, p.brand ?? '', catName(p.category_id), p.price, p.promo_price ?? '', p.cost, p.stock, p.min_stock ?? 5, p.active ? 'sim' : 'nao']);
    download(`produtos-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(PRODUCT_HEADERS, rows));
  }
  function template() {
    download('modelo-produtos.csv', toCsv(PRODUCT_HEADERS, [['CAP-001', 'Capa Silicone iPhone 13', 'NT', 'Capas', 39.9, '', 12, 20, 5, 'sim']]));
  }
  async function onCsv(f: File | null) {
    if (!f) return;
    setImp(parseProductCsv(await f.text()));
  }
  async function applyImport() {
    if (!imp || imp.rows.length === 0) return;
    setBusy(true);
    const slugs = new Set(list.map((p) => p.slug));
    let created = 0, updated = 0, failed = 0;
    for (const r of imp.rows) {
      const cat = cats.find((c) => c.name.toLowerCase() === r.category.toLowerCase());
      const exist = r.sku ? list.find((p) => (p.sku ?? '').toLowerCase() === r.sku.toLowerCase()) : undefined;
      const base = { name: r.name, price: r.price, promo_price: r.promo_price, cost: r.cost, stock: r.stock, min_stock: r.min_stock, active: r.active, sku: r.sku || null, brand: r.brand || null, ...(cat ? { category_id: cat.id } : {}) };
      if (exist) {
        const { error } = await sb.from('products').update(base).eq('id', exist.id);
        error ? failed++ : updated++;
      } else {
        let slug = slugify(r.name) || 'produto', n = 2;
        while (slugs.has(slug)) slug = `${slugify(r.name)}-${n++}`;
        slugs.add(slug);
        const { error } = await sb.from('products').insert({ ...base, slug, images: [] });
        error ? failed++ : created++;
      }
    }
    setBusy(false);
    setImp(null);
    setMsg({ ok: failed === 0, t: `Importação concluída: ${created} novo(s), ${updated} atualizado(s)${failed ? `, ${failed} com erro` : ''}. Nenhum produto foi excluído.` });
    await load();
    refreshStore();
  }

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? '—';
  const shown = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="adm-head">
        <h1 className="adm-title">Produtos</h1>
        <div className="adm-actions">
          <input placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produto" />
          <button className="btn btn-light sm" onClick={exportCsv}>Exportar CSV</button>
          <label className="btn btn-light sm" style={{ cursor: 'pointer' }}>Importar CSV<input type="file" accept=".csv,text/csv" hidden onChange={(e) => { onCsv(e.target.files?.[0] ?? null); e.target.value = ''; }} /></label>
          <button className="btn btn-dark sm" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>+ Novo produto</button>
        </div>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.t}</p>}
      {imp && (
        <div className="import-box">
          <strong>{imp.rows.length} produto(s) prontos para importar</strong>
          <p className="muted small">Produtos com o mesmo SKU são atualizados; os demais são criados. Nada é excluído. <button type="button" className="link" onClick={template}>Baixar planilha modelo</button></p>
          {imp.errors.length > 0 && <ul className="err">{imp.errors.slice(0, 8).map((e) => <li key={e}>{e}</li>)}{imp.errors.length > 8 && <li>…e mais {imp.errors.length - 8}</li>}</ul>}
          <div className="adm-actions"><button className="btn btn-dark sm" disabled={busy || imp.rows.length === 0} onClick={applyImport}>{busy ? 'Importando…' : 'Confirmar importação'}</button><button className="btn btn-light sm" onClick={() => setImp(null)}>Cancelar</button></div>
        </div>
      )}

      <ResponsiveTable>
        <table>
          <thead><tr><th></th><th>Produto</th><th>Categoria</th><th className="r">Preço</th><th className="r">Custo</th><th className="r">Margem</th><th className="r">Estoque</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td><img className="thumb" src={p.images[0] || '/placeholders/produto.svg'} alt="" /></td>
                <td><div className="cell-stack"><strong>{p.name}</strong><small className="muted">{p.sku ? `${p.sku} · ` : ''}{p.brand ? `${p.brand} · ` : ''}/{p.slug}</small></div></td>
                <td>{catName(p.category_id)}</td>
                <td className="r">{p.promo_price != null ? <div className="cell-stack"><s className="muted">{brl(p.price)}</s><strong>{brl(p.promo_price)}</strong></div> : brl(p.price)}</td>
                <td className="r">{brl(p.cost)}</td>
                <td className="r">{(() => { const m = margin(p.price, p.cost, p.promo_price); return <span className={m.pct < 20 ? 'err' : ''}>{m.pct.toLocaleString('pt-BR')}%</span>; })()}</td>
                <td className="r">
                  {p.has_variants ? <b className={p.stock <= (p.min_stock ?? 5) ? 'err' : ''} title="Soma das variações">{p.stock}</b> : <span className="stock">
                    <button onClick={() => quickStock(p, p.stock - 1)} aria-label="Diminuir estoque">−</button>
                    <b className={p.stock <= (p.min_stock ?? 5) ? 'err' : ''}>{p.stock}</b>
                    <button onClick={() => quickStock(p, p.stock + 1)} aria-label="Aumentar estoque">+</button>
                  </span>}
                </td>
                <td>
                  {!p.active && <span className="pill s-cancelado">Oculto</span>}{' '}
                  {p.featured && <span className="pill s-pago">Destaque</span>}{' '}
                  {p.is_new && <span className="pill s-enviado">Novo</span>}
                </td>
                <td className="r nowrap">
                  <button className="link" onClick={() => { setMsg(null); edit(p); }}>Editar</button>{' '}
                  <button className="link danger" onClick={() => remove(p)}>Excluir</button>
                </td>
              </tr>
            ))}
            {shown.length === 0 && <tr><td colSpan={9} className="muted">Nenhum produto.</td></tr>}
          </tbody>
        </table>
      </ResponsiveTable>

      {form && (
        <div className="modal" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={save}>
            <div className="adm-head">
              <h2>{form.id ? 'Editar produto' : 'Novo produto'}</h2>
              <button type="button" className="link" onClick={() => setForm(null)}>Fechar ✕</button>
            </div>
            <label>Nome<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: form.id ? form.slug : slugify(e.target.value) })} /></label>
            <label>Endereço (slug)<input value={form.slug} onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })} /></label>
            <label>Descrição<textarea rows={4} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="three">
              <label>Preço (R$)<input required inputMode="decimal" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} /></label>
              <label>Preço promocional<input inputMode="decimal" value={form.promo_price} onChange={(e) => setForm({ ...form, promo_price: e.target.value })} placeholder="vazio = sem promoção" /></label>
              <label>Custo (R$)<input inputMode="decimal" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} /></label>
            </div>
            {(() => { const pr = num(form.price), m = margin(pr, num(form.cost), form.promo_price.trim() ? num(form.promo_price) : null); return pr > 0 ? <p className={`margin-hint ${m.pct < 20 ? 'bad' : 'good'}`}>Lucro por unidade: {brl(m.profit)} · margem {m.pct.toLocaleString('pt-BR')}%</p> : null; })()}
            <div className="two">
              <label>SKU (código)<input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="ex.: CAP-001" /></label>
              <label>Marca<input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></label>
            </div>
            <div className="two">
              <label>Estoque<input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
              <label>Estoque mínimo (alerta)<input type="number" min={0} value={form.min_stock} onChange={(e) => setForm({ ...form, min_stock: e.target.value })} /></label>
              <label>Categoria
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Sem categoria</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
            {form.id ? <VariantsEditor productId={form.id} onChange={() => { load(); refreshStore(); }} /> : <p className="muted small">Salve o produto primeiro para cadastrar variações (cor, modelo…).</p>}
            <div className="checks">
              <label><input type="checkbox" checked={form.featured} onChange={(e) => setForm({ ...form, featured: e.target.checked })} /> Destaque</label>
              <label><input type="checkbox" checked={form.is_new} onChange={(e) => setForm({ ...form, is_new: e.target.checked })} /> Lançamento</label>
              <label><input type="checkbox" checked={form.active} onChange={(e) => setForm({ ...form, active: e.target.checked })} /> Visível na loja</label>
            </div>
            <div>
              <span className="lbl">Fotos (a primeira é a principal)</span>
              <div className="imgs">
                {form.images.map((src, i) => (
                  <div key={src + i} className="img-item">
                    <img src={src} alt="" />
                    <div>
                      {i > 0 && <button type="button" title="Tornar principal" onClick={() => setForm({ ...form, images: [src, ...form.images.filter((_, k) => k !== i)] })}>★</button>}
                      <button type="button" title="Remover" onClick={() => setForm({ ...form, images: form.images.filter((_, k) => k !== i) })}>✕</button>
                    </div>
                  </div>
                ))}
                <label className="img-add">+ Enviar fotos<input type="file" accept="image/*" multiple hidden onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} /></label>
              </div>
            </div>
            {msg && !msg.ok && <p className="err">{msg.t}</p>}
            <div className="adm-actions end">
              <button type="button" className="btn btn-light sm" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-dark sm" disabled={busy}>{busy ? 'Aguarde…' : 'Salvar produto'}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
