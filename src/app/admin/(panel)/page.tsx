'use client';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { computeMetrics } from '@/lib/metrics';
import { brl, dateBR, STATUS_LABEL, STATUS_ORDER } from '@/lib/format';
import type { Order, Product } from '@/lib/types';

function BarChart({ data }: { data: { label: string; revenue: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.revenue));
  const W = 700, H = 220, pad = 28, bw = (W - pad * 2) / data.length;
  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} className="chart" role="img" aria-label="Faturamento por dia">
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <line x1={pad} x2={W - pad} y1={H - t * (H - 20)} y2={H - t * (H - 20)} stroke="var(--line)" />
          <text x={0} y={H - t * (H - 20) + 4} fontSize="10" fill="var(--muted)">{t ? Math.round(max * t) : 0}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const h = (d.revenue / max) * (H - 20);
        return (
          <g key={d.label}>
            <rect x={pad + i * bw + 4} y={H - h} width={bw - 8} height={h} rx="3" fill="var(--gold)">
              <title>{`${d.label}: ${brl(d.revenue)}`}</title>
            </rect>
            <text x={pad + i * bw + bw / 2} y={H + 16} fontSize="10" textAnchor="middle" fill="var(--muted)">{d.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function Dashboard() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [low, setLow] = useState<Product[]>([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    const sb = createClient();
    Promise.all([
      sb.from('orders').select('*, order_items(*), customers(*)').order('created_at', { ascending: false }).limit(2000),
      sb.from('products').select('*').lte('stock', 5).eq('active', true).order('stock').limit(10),
    ]).then(([o, p]) => {
      if (o.error) return setErr(o.error.message);
      setOrders((o.data ?? []) as Order[]);
      setLow((p.data ?? []) as Product[]);
    });
  }, []);

  const m = useMemo(() => (orders ? computeMetrics(orders) : null), [orders]);
  if (err) return <p className="err">{err}</p>;
  if (!m || !orders) return <p className="muted">Carregando indicadores…</p>;
  const maxTop = Math.max(1, ...m.topProducts.map((p) => p.quantity));

  return (
    <>
      <h1 className="adm-title">Visão geral</h1>
      <div className="stats">
        <Stat label="Faturamento total" value={brl(m.revenue)} />
        <Stat label="Vendas do dia" value={brl(m.today.revenue)} sub={`${m.today.orders} pedido(s)`} />
        <Stat label="Vendas da semana" value={brl(m.week.revenue)} sub={`${m.week.orders} pedido(s)`} />
        <Stat label="Vendas do mês" value={brl(m.month.revenue)} sub={`${m.month.orders} pedido(s)`} />
        <Stat label="Lucro estimado" value={brl(m.profit)} sub="preço − custo − cupons" />
        <Stat label="Pedidos pagos" value={String(m.orderCount)} sub={`${m.totalOrders} no total`} />
        <Stat label="Ticket médio" value={brl(m.avgTicket)} />
        <Stat label="Aguardando pagamento" value={String(m.statusCount.aguardando_pagamento ?? 0)} />
      </div>

      <div className="panels">
        <section className="panel wide">
          <h2>Faturamento — últimos 14 dias</h2>
          <BarChart data={m.series} />
        </section>
        <section className="panel">
          <h2>Mais vendidos</h2>
          {m.topProducts.length === 0 && <p className="muted">Ainda sem vendas.</p>}
          {m.topProducts.map((p) => (
            <div className="hbar" key={p.name}>
              <div className="hbar-top"><span>{p.name}</span><strong>{p.quantity} un.</strong></div>
              <div className="hbar-track"><div style={{ width: `${(p.quantity / maxTop) * 100}%` }} /></div>
            </div>
          ))}
        </section>
        <section className="panel">
          <h2>Pedidos por status</h2>
          {STATUS_ORDER.map((s) => (
            <div className="row-between" key={s}><span>{STATUS_LABEL[s]}</span><strong>{m.statusCount[s] ?? 0}</strong></div>
          ))}
        </section>
        <section className="panel">
          <h2>Estoque baixo</h2>
          {low.length === 0 && <p className="muted">Tudo em dia.</p>}
          {low.map((p) => (
            <div className="row-between" key={p.id}>
              <Link href="/admin/produtos" className="link">{p.name}</Link>
              <strong className={p.stock === 0 ? 'err' : ''}>{p.stock} un.</strong>
            </div>
          ))}
        </section>
        <section className="panel wide">
          <h2>Pedidos recentes</h2>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Status</th><th className="r">Total</th></tr></thead>
              <tbody>
                {orders.slice(0, 8).map((o) => (
                  <tr key={o.id}>
                    <td><Link className="link" href="/admin/pedidos">#{o.number}</Link></td>
                    <td>{dateBR(o.created_at)}</td>
                    <td>{o.customers?.name ?? '—'}</td>
                    <td><span className={`pill s-${o.status}`}>{STATUS_LABEL[o.status]}</span></td>
                    <td className="r">{brl(o.total)}</td>
                  </tr>
                ))}
                {orders.length === 0 && <tr><td colSpan={5} className="muted">Nenhum pedido ainda.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
      {sub && <small>{sub}</small>}
    </div>
  );
}
