'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { num, refreshStore, uploadImage } from '@/lib/admin';
import { brl, slugify } from '@/lib/format';
import type { Category, Product } from '@/lib/types';

type Form = {
  id?: string; name: string; slug: string; description: string; price: string; promo_price: string; cost: string; stock: string;
  category_id: string; images: string[]; featured: boolean; is_new: boolean; active: boolean;
};
const EMPTY: Form = { name: '', slug: '', description: '', price: '', promo_price: '', cost: '', stock: '0', category_id: '', images: [], featured: false, is_new: false, active: true };

export default function ProductsAdmin() {
  const sb = createClient();
  const [list, setList] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [form, setForm] = useState<Form | null>(null);
  const [q, setQ] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [p, c] = await Promise.all([sb.from('products').select('*').order('created_at', { ascending: false }), sb.from('categories').select('*').order('sort')]);
    setList((p.data ?? []) as Product[]);
    setCats((c.data ?? []) as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const edit = (p: Product) => setForm({
    id: p.id, name: p.name, slug: p.slug, description: p.description ?? '', price: String(p.price), promo_price: p.promo_price != null ? String(p.promo_price) : '',
    cost: String(p.cost), stock: String(p.stock), category_id: p.category_id ?? '', images: p.images, featured: p.featured, is_new: p.is_new, active: p.active,
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
    };
    const { error } = form.id ? await sb.from('products').update(row).eq('id', form.id) : await sb.from('products').insert(row);
    setBusy(false);
    if (error) return setMsg({ ok: false, t: error.message.includes('duplicate') ? 'Já existe um produto com esse endereço (slug).' : error.message });
    setForm(null);
    setMsg({ ok: true, t: 'Produto salvo. A loja já foi atualizada.' });
    await load();
    refreshStore();
  }

  async function remove(p: Product) {
    if (!confirm(`Excluir "${p.name}"? Pedidos antigos continuam no histórico.`)) return;
    const { error } = await sb.from('products').delete().eq('id', p.id);
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

  const catName = (id: string | null) => cats.find((c) => c.id === id)?.name ?? '—';
  const shown = list.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div className="adm-head">
        <h1 className="adm-title">Produtos</h1>
        <div className="adm-actions">
          <input placeholder="Buscar produto" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Buscar produto" />
          <button className="btn btn-dark sm" onClick={() => { setMsg(null); setForm({ ...EMPTY }); }}>+ Novo produto</button>
        </div>
      </div>
      {msg && <p className={msg.ok ? 'ok' : 'err'} role="status">{msg.t}</p>}

      <div className="table-wrap">
        <table>
          <thead><tr><th></th><th>Produto</th><th>Categoria</th><th className="r">Preço</th><th className="r">Custo</th><th className="r">Estoque</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {shown.map((p) => (
              <tr key={p.id}>
                <td><img className="thumb" src={p.images[0] || '/placeholders/produto.svg'} alt="" /></td>
                <td><strong>{p.name}</strong><br /><small className="muted">/{p.slug}</small></td>
                <td>{catName(p.category_id)}</td>
                <td className="r">{p.promo_price != null ? <><s className="muted">{brl(p.price)}</s><br /><strong>{brl(p.promo_price)}</strong></> : brl(p.price)}</td>
                <td className="r">{brl(p.cost)}</td>
                <td className="r">
                  <span className="stock">
                    <button onClick={() => quickStock(p, p.stock - 1)} aria-label="Diminuir estoque">−</button>
                    <b className={p.stock <= 5 ? 'err' : ''}>{p.stock}</b>
                    <button onClick={() => quickStock(p, p.stock + 1)} aria-label="Aumentar estoque">+</button>
                  </span>
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
            {shown.length === 0 && <tr><td colSpan={8} className="muted">Nenhum produto.</td></tr>}
          </tbody>
        </table>
      </div>

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
            <div className="two">
              <label>Estoque<input type="number" min={0} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></label>
              <label>Categoria
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Sem categoria</option>
                  {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
            </div>
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
