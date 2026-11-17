'use client';
import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { num } from '@/lib/admin';
import { brl } from '@/lib/format';
import type { Coupon } from '@/lib/types';

const EMPTY = { code: '', type: 'percent' as 'percent' | 'fixed', value: '', min_order: '0', max_uses: '', expires_at: '' };

export default function CouponsAdmin() {
  const sb = createClient();
  const [list, setList] = useState<Coupon[]>([]);
  const [f, setF] = useState(EMPTY);
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);

  const load = useCallback(async () => {
    const { data } = await sb.from('coupons').select('*').order('created_at', { ascending: false });
    setList((data ?? []) as Coupon[]);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = num(f.value);
    if (value <= 0 || (f.type === 'percent' && value > 100)) return setMsg({ ok: false, t: 'Valor do desconto inválido.' });
    const { error } = await sb.from('coupons').insert({
      code: f.code.trim().toUpperCase().replace(/\s+/g, ''), type: f.type, value, min_order: num(f.min_order),
      max_uses: f.max_uses ? Math.floor(num(f.max_uses)) : null, expires_at: f.expires_at ? new Date(f.expires_at + 'T23:59:59').toISOString() : null,
    });
    if (error) return setMsg({ ok: false, t: error.message.includes('duplicate') ? 'Já existe um cupom com esse código.' : error.message });
    setF(EMPTY); setMsg({ ok: true, t: 'Cupom criado.' }); load();
  }
  async function toggle(c: Coupon) { await sb.from('coupons').update({ active: !c.active }).eq('code', c.code); load(); }
  async function remove(c: Coupon) { if (confirm(`Excluir o cupom ${c.code}?`)) { await sb.from('coupons').delete().eq('code', c.code); load(); } }

  return (
    <>
      <h1 className="adm-title">Cupons de desconto</h1>
      <form className="box" onSubmit={add}>
        <div className="three">
          <label>Código<input required value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase() })} placeholder="EX: NT10" /></label>
          <label>Tipo
            <select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value as 'percent' | 'fixed' })}>
              <option value="percent">Porcentagem (%)</option><option value="fixed">Valor fixo (R$)</option>
            </select>
          </label>
          <label>Valor<input required inputMode="decimal" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></label>
        </div>
        <div className="three">
          <label>Pedido mínimo (R$)<input inputMode="decimal" value={f.min_order} onChange={(e) => setF({ ...f, min_order: e.target.value })} /></label>
          <label>Limite de usos<input type="number" min={1} value={f.max_uses} onChange={(e) => setF({ ...f, max_uses: e.target.value })} placeholder="ilimitado" /></label>
          <label>Validade<input type="date" value={f.expires_at} onChange={(e) => setF({ ...f, expires_at: e.target.value })} /></label>
        </div>
        {msg && <p className={msg.ok ? 'ok' : 'err'}>{msg.t}</p>}
        <button className="btn btn-dark sm">Criar cupom</button>
      </form>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Código</th><th>Desconto</th><th className="r">Mínimo</th><th className="r">Usos</th><th>Validade</th><th>Ativo</th><th></th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.code}>
                <td><strong>{c.code}</strong></td>
                <td>{c.type === 'percent' ? `${c.value}%` : brl(c.value)}</td>
                <td className="r">{brl(c.min_order)}</td>
                <td className="r">{c.used_count}{c.max_uses ? ` / ${c.max_uses}` : ''}</td>
                <td>{c.expires_at ? new Date(c.expires_at).toLocaleDateString('pt-BR') : 'Sem prazo'}</td>
                <td><input type="checkbox" checked={c.active} onChange={() => toggle(c)} aria-label={`Ativar ${c.code}`} /></td>
                <td className="r"><button className="link danger" onClick={() => remove(c)}>Excluir</button></td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="muted">Nenhum cupom.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
