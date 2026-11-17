'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const LINKS = [
  { href: '/admin', label: 'Visão geral' },
  { href: '/admin/produtos', label: 'Produtos' },
  { href: '/admin/categorias', label: 'Categorias' },
  { href: '/admin/pedidos', label: 'Pedidos' },
  { href: '/admin/clientes', label: 'Clientes' },
  { href: '/admin/cupons', label: 'Cupons' },
  { href: '/admin/depoimentos', label: 'Depoimentos' },
  { href: '/admin/configuracoes', label: 'Configurações' },
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
    </aside>
  );
}
