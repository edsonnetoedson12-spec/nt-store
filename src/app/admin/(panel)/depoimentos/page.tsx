'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { refreshStore } from '@/lib/admin';
import type { Testimonial } from '@/lib/types';

const EMPTY = { name: '', text: '', rating: 5 };

export default function TestimonialsAdmin() {
  const sb = createClient();
  const [list, setList] = useState<Testimonial[]>([]);
  const [f, setF] = useState(EMPTY);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    const { data } = await sb.from('testimonials').select('*').order('created_at', { ascending: false });
    setList((data ?? []) as Testimonial[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from('testimonials').insert(f);
    if (error) return setErr(error.message);
    setErr(''); setF(EMPTY); await load(); refreshStore();
  }
  async function toggle(t: Testimonial) { await sb.from('testimonials').update({ active: !t.active }).eq('id', t.id); await load(); refreshStore(); }
  async function remove(t: Testimonial) { if (confirm('Excluir depoimento?')) { await sb.from('testimonials').delete().eq('id', t.id); await load(); refreshStore(); } }

  return (
    <>
      <h1 className="adm-title">Depoimentos</h1>
      <form className="box" onSubmit={add}>
        <div className="two">
          <label>Nome da cliente<input required value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
          <label>Nota
            <select value={f.rating} onChange={(e) => setF({ ...f, rating: Number(e.target.value) })}>
              {[5, 4, 3].map((n) => <option key={n} value={n}>{n} estrelas</option>)}
            </select>
          </label>
        </div>
        <label>Depoimento<textarea required rows={3} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} /></label>
        {err && <p className="err">{err}</p>}
        <button className="btn btn-dark sm">Adicionar depoimento</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Cliente</th><th>Texto</th><th>Nota</th><th>Visível</th><th></th></tr></thead>
          <tbody>
            {list.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td><td>{t.text}</td><td>{t.rating}★</td>
                <td><input type="checkbox" checked={t.active} onChange={() => toggle(t)} aria-label="Visível" /></td>
                <td className="r"><button className="link danger" onClick={() => remove(t)}>Excluir</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="muted">Nenhum depoimento.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
