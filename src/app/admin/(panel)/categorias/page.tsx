'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { refreshStore } from '@/lib/admin';
import { slugify } from '@/lib/format';
import type { Category } from '@/lib/types';

export default function CategoriesAdmin() {
  const sb = createClient();
  const [list, setList] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('categories').select('*').order('sort').order('name');
    setList((data ?? []) as Category[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const { error } = await sb.from('categories').insert({ name: name.trim(), slug: slugify(name), sort: list.length + 1 });
    if (error) return setMsg({ ok: false, t: error.message.includes('duplicate') ? 'Essa categoria já existe.' : error.message });
    setName(''); setMsg({ ok: true, t: 'Categoria criada.' }); await load(); refreshStore();
  }
  async function rename(c: Category) {
    const n = prompt('Novo nome da categoria', c.name);
    if (!n || !n.trim() || n === c.name) return;
    const { error } = await sb.from('categories').update({ name: n.trim(), slug: slugify(n) }).eq('id', c.id);
    if (error) return setMsg({ ok: false, t: error.message });
    await load(); refreshStore();
  }
  async function move(c: Category, dir: -1 | 1) {
    const i = list.findIndex((x) => x.id === c.id), o = list[i + dir];
    if (!o) return;
    await Promise.all([sb.from('categories').update({ sort: o.sort }).eq('id', c.id), sb.from('categories').update({ sort: c.sort }).eq('id', o.id)]);
    await load(); refreshStore();
  }
  async function remove(c: Category) {
    if (!confirm(`Excluir a categoria "${c.name}"? Os produtos ficam sem categoria.`)) return;
    const { error } = await sb.from('categories').delete().eq('id', c.id);
    if (error) return setMsg({ ok: false, t: error.message });
    await load(); refreshStore();
  }

  return (
    <>
      <h1 className="adm-title">Categorias</h1>
      <form className="inline-form" onSubmit={add}>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da nova categoria" aria-label="Nome da categoria" />
        <button className="btn btn-dark sm">Adicionar</button>
      </form>
      {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.t}</p>}
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nome</th><th>Endereço</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td><strong>{c.name}</strong></td><td className="muted">{c.slug}</td>
                <td className="r nowrap">
                  <button className="link" onClick={() => move(c, -1)} aria-label="Subir">↑</button>{' '}
                  <button className="link" onClick={() => move(c, 1)} aria-label="Descer">↓</button>{' '}
                  <button className="link" onClick={() => rename(c)}>Renomear</button>{' '}
                  <button className="link danger" onClick={() => remove(c)}>Excluir</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={3} className="muted">Nenhuma categoria.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
