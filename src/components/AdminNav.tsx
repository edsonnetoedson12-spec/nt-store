'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/admin', label: 'Visão geral' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/estoque', label: 'Estoque' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/financeiro', label: 'Financeiro' },
  { href: '/admin/cupons', label: 'Cupons' },
  { href: '/admin/depoimentos', label: 'Depoimentos' },
  { href: '/admin/configuracoes', label: 'Configurações' },
];

const TABS = [
  { href: '/admin', label: 'Início', icon: '▦' },
  { href: '/admin/produtos', label: 'Produtos', icon: '◫' },
  { href: '/admin/pedidos', label: 'Pedidos', icon: '✉' },
  { href: '/admin/clientes', label: 'Clientes', icon: '☺' },
];

export default function AdminNav({ email }: { email: string }) {
  const path = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  async function logout() {
    await createClient().auth.signOut();
    router.replace('/admin/login');
    router.refresh();
  }
  return (
    <aside className={`admin-side${open ? ' open' : ''}`}>
      <div className="admin-brand">
        <span className="logo-mark light">NT</span>
        <button className="admin-toggle" onClick={() => setOpen((o) => !o)} aria-label="Menu">☰</button>
      </div>
      <nav>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={path === l.href || (l.href !== '/admin' && path.startsWith(l.href)) ? 'on' : ''}>
            {l.label}
          </Link>
        ))}
        <Link href="/" target="_blank">Ver loja ↗</Link>
      </nav>
      <div className="admin-user">
        <small>{email}</small>
        <button onClick={logout}>Sair</button>
      </div>
      <nav className="admin-tabs" aria-label="Atalhos">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={path === t.href || (t.href !== '/admin' && path.startsWith(t.href)) ? 'on' : ''} onClick={() => setOpen(false)}>
            <span aria-hidden="true">{t.icon}</span>
            {t.label}
          </Link>
        ))}
        <button type="button" className={open ? 'on' : ''} onClick={() => setOpen((o) => !o)}>
          <span aria-hidden="true">☰</span>Mais
        </button>
      </nav>
    </aside>
  );
}
