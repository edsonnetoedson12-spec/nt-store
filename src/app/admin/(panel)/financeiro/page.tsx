'use client';
import ResponsiveTable from '@/components/ResponsiveTable';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { download, num } from '@/lib/admin';
import { toCsv } from '@/lib/csv';
import { buildReport, estimateFee, type Expense } from '@/lib/finance';
import { brl, PAYMENT_LABEL } from '@/lib/format';
import type { Order } from '@/lib/types';

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const CATS = ['Marketing', 'Embalagem', 'Frete', 'Aluguel', 'Ferramentas', 'Impostos', 'Outros'];

export default function Finance() {
  const sb = createClient();
  const now = new Date();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [pct, setPct] = useState<{ pix?: number; cartao?: number }>({});
  const [from, setFrom] = useState(iso(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(iso(now));
  const [msg, setMsg] = useState('');
  const [f, setF] = useState({ description: '', category: 'Outros', amount: '', spent_on: iso(now) });

  const load = useCallback(async () => {
    const [o, e, s] = await Promise.all([
      sb.from('orders').select('*, order_items(*)').order('created_at', { ascending: false }).limit(5000),
      sb.from('expenses').select('*').order('spent_on', { ascending: false }).limit(2000),
      sb.from('settings').select('value').eq('key', 'admin').maybeSingle(),
    ]);
    if (o.error) setMsg(o.error.message);
    if (e.error) setMsg('Despesas indisponíveis: aplique a migração 003 no Supabase.');
    setOrders((o.data ?? []) as Order[]);
    setExpenses((e.data ?? []) as Expense[]);
    setPct(((s.data?.value as { fees?: { pix?: number; cartao?: number } } | null)?.fees) ?? {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [load]);

  const fromD = useMemo(() => new Date(from + 'T00:00:00'), [from]);
  const toD = useMemo(() => { const d = new Date(to + 'T00:00:00'); d.setDate(d.getDate() + 1); return d; }, [to]);
  // Pedidos sem taxa real registrada usam a taxa estimada das configurações.
  const withFees = useMemo(() => orders.map((o) => (o.payment_fee ? o : { ...o, payment_fee: estimateFee(Number(o.total), o.payment_method, pct) })), [orders, pct]);
  const r = useMemo(() => buildReport(withFees, expenses, fromD, toD), [withFees, expenses, fromD, toD]);
  const periodExpenses = expenses.filter((e) => e.spent_on >= from && e.spent_on <= to);

  function preset(k: 'hoje' | '7' | '30' | 'mes' | 'mesant') {
    const n = new Date();
    if (k === 'hoje') { setFrom(iso(n)); setTo(iso(n)); }
    if (k === '7' || k === '30') { const d = new Date(n); d.setDate(d.getDate() - (Number(k) - 1)); setFrom(iso(d)); setTo(iso(n)); }
    if (k === 'mes') { setFrom(iso(new Date(n.getFullYear(), n.getMonth(), 1))); setTo(iso(n)); }
    if (k === 'mesant') { setFrom(iso(new Date(n.getFullYear(), n.getMonth() - 1, 1))); setTo(iso(new Date(n.getFullYear(), n.getMonth(), 0))); }
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    const amount = num(f.amount);
    if (amount <= 0 || !f.description.trim()) return setMsg('Informe descrição e valor.');
    const { error } = await sb.from('expenses').insert({ description: f.description.trim(), category: f.category, amount, spent_on: f.spent_on });
    if (error) return setMsg(error.message);
    setMsg('');
    setF({ ...f, description: '', amount: '' });
    load();
  }
  async function delExpense(x: Expense) {
    if (!confirm(`Excluir a despesa "${x.description}"?`)) return;
    await sb.from('expenses').delete().eq('id', x.id);
    load();
  }

  function exportReport() {
    download(`relatorio-financeiro-${from}_a_${to}.csv`, toCsv(['Indicador', 'Valor'], [
      ['Período', `${from} a ${to}`], ['Faturamento recebido', r.revenue], ['Receita de produtos', r.productRevenue], ['Custo dos produtos', r.cogs],
      ['Descontos/cupons', r.discounts], ['Lucro bruto', r.grossProfit], ['Taxas de pagamento', r.fees], ['Despesas', r.expenses], ['Lucro líquido', r.netProfit],
      ['Pedidos pagos', r.orders], ['Ticket médio', r.avgTicket], ['Aguardando pagamento (qtd)', r.pending.count], ['Aguardando pagamento (R$)', r.pending.total],
      ['Cancelados (qtd)', r.cancelled.count], ['Cancelados (R$)', r.cancelled.total],
    ]));
  }
  function exportExpenses() {
    download(`despesas-${from}_a_${to}.csv`, toCsv(['Data', 'Descrição', 'Categoria', 'Valor'], periodExpenses.map((x) => [x.spent_on, x.description, x.category, x.amount])));
  }

  const Stat = ({ l, v, s }: { l: string; v: string; s?: string }) => <div className="stat"><span>{l}</span><strong>{v}</strong>{s && <small>{s}</small>}</div>;

  return (
    <>
      <div className="adm-head">
        <h1 className="adm-title">Financeiro</h1>
        <div className="adm-actions"><button className="btn btn-light sm" onClick={exportReport}>Exportar relatório</button></div>
      </div>
      <div className="chips">
        {([['hoje', 'Hoje'], ['7', '7 dias'], ['30', '30 dias'], ['mes', 'Este mês'], ['mesant', 'Mês passado']] as const).map(([k, l]) => <button key={k} className="chip" onClick={() => preset(k)}>{l}</button>)}
        <label className="check">De <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="check">até <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      {msg && <p className="err">{msg}</p>}
      <div className="stats">
        <Stat l="Faturamento recebido" v={brl(r.revenue)} s={`${r.orders} pedido(s) pago(s)`} />
        <Stat l="Custo dos produtos" v={brl(r.cogs)} />
        <Stat l="Descontos e cupons" v={brl(r.discounts)} />
        <Stat l="Lucro bruto" v={brl(r.grossProfit)} s="produtos − custo − cupons" />
        <Stat l="Taxas de pagamento" v={brl(r.fees)} s="real (Mercado Pago) ou estimada" />
        <Stat l="Despesas" v={brl(r.expenses)} />
        <Stat l="Lucro líquido" v={brl(r.netProfit)} s="bruto − taxas − despesas" />
        <Stat l="Ticket médio" v={brl(r.avgTicket)} />
        <Stat l="A receber" v={brl(r.pending.total)} s={`${r.pending.count} aguardando pagamento`} />
        <Stat l="Cancelados" v={brl(r.cancelled.total)} s={`${r.cancelled.count} pedido(s)`} />
      </div>
      <p className="muted small">O frete é repasse: entra no faturamento, mas não no lucro.</p>

      <div className="panels">
        <section className="panel">
          <h2>Por forma de pagamento</h2>
          {Object.keys(r.byMethod).length === 0 && <p className="muted">Sem vendas no período.</p>}
          {Object.entries(r.byMethod).map(([m, v]) => <div className="row-between" key={m}><span>{PAYMENT_LABEL[m as keyof typeof PAYMENT_LABEL] ?? m} ({v.orders})</span><strong>{brl(v.revenue)}</strong></div>)}
        </section>
        <section className="panel wide">
          <div className="row-between"><h2>Despesas do período</h2><button className="link" onClick={exportExpenses}>Exportar CSV</button></div>
          <form className="expense-form" onSubmit={addExpense}>
            <input placeholder="Descrição (ex.: anúncio Instagram)" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} aria-label="Descrição" />
            <select value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} aria-label="Categoria">{CATS.map((c) => <option key={c}>{c}</option>)}</select>
            <input inputMode="decimal" placeholder="Valor R$" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} aria-label="Valor" />
            <input type="date" value={f.spent_on} onChange={(e) => setF({ ...f, spent_on: e.target.value })} aria-label="Data" />
            <button className="btn btn-dark sm">Adicionar</button>
          </form>
          <ResponsiveTable>
            <table>
              <thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th className="r">Valor</th><th></th></tr></thead>
              <tbody>
                {periodExpenses.map((x) => <tr key={x.id}><td>{x.spent_on.split('-').reverse().join('/')}</td><td>{x.description}</td><td>{x.category}</td><td className="r">{brl(x.amount)}</td><td className="r"><button className="link danger" onClick={() => delExpense(x)}>Excluir</button></td></tr>)}
                {periodExpenses.length === 0 && <tr><td colSpan={5} className="muted">Nenhuma despesa no período.</td></tr>}
              </tbody>
            </table>
          </ResponsiveTable>
        </section>
      </div>
    </>
  );
}
