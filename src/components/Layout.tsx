import Link from 'next/link';
import type { Product, StoreSettings } from '@/lib/types';
import { brl } from '@/lib/format';
import { discountPercent, hasPromo, unitPrice } from '@/lib/pricing';
import { AddToCart, CartButton, MobileMenu } from './StoreBits';

export function Logo({ s }: { s: StoreSettings }) {
  return (
    <Link href="/" className="logo" aria-label={`${s.name} — página inicial`}>
      {s.logo_url ? <img src={s.logo_url} alt={s.name} height={36} /> : <span className="logo-mark">{s.name || 'NT'}</span>}
    </Link>
  );
}

export function Header({ s }: { s: StoreSettings }) {
  const links = [
    { href: '/', label: 'Início' },
    { href: '/loja', label: 'Loja' },
    { href: '/loja?novidades=1', label: 'Novidades' },
    { href: '/loja?promocao=1', label: 'Promoções' },
  ];
  return (
    <>
      {s.phrases[0] && <div className="topbar">{s.phrases[0]}</div>}
      <header className="header">
        <div className="container header-row">
          <MobileMenu links={links} />
          <Logo s={s} />
          <nav className="nav" aria-label="Principal">
            {links.map((l) => (
              <Link key={l.href} href={l.href}>
                {l.label}
              </Link>
            ))}
          </nav>
          <form action="/loja" className="search" role="search">
            <input type="search" name="q" placeholder="Buscar acessórios" aria-label="Buscar produtos" />
          </form>
          <CartButton />
        </div>
      </header>
    </>
  );
}

export function Footer({ s }: { s: StoreSettings }) {
  const socials = [
    { label: 'Instagram', url: s.instagram },
    { label: 'Facebook', url: s.facebook },
    { label: 'TikTok', url: s.tiktok },
  ].filter((x) => x.url);
  return (
    <footer className="footer">
      <div className="container footer-grid">
        <div>
          <div className="logo-mark light">{s.name}</div>
          <p>{s.tagline}</p>
          {s.about && <p className="muted-l">{s.about}</p>}
        </div>
        <div>
          <h4>Loja</h4>
          <Link href="/loja">Todos os produtos</Link>
          <Link href="/loja?novidades=1">Novidades</Link>
          <Link href="/loja?promocao=1">Promoções</Link>
          <Link href="/carrinho">Meu carrinho</Link>
        </div>
        <div>
          <h4>Contato</h4>
          {s.phone && <span>{s.phone}</span>}
          {s.email && <a href={`mailto:${s.email}`}>{s.email}</a>}
          {s.address && <span>{s.address}</span>}
        </div>
        <div>
          <h4>Redes sociais</h4>
          {socials.map((x) => (
            <a key={x.label} href={x.url} target="_blank" rel="noopener noreferrer">
              {x.label}
            </a>
          ))}
        </div>
      </div>
      <div className="container copy">
        © {new Date().getFullYear()} {s.name}. Todos os direitos reservados. Pagamento seguro via PIX e cartão.
      </div>
    </footer>
  );
}

export function ProductCard({ p, catName }: { p: Product; catName?: string }) {
  const promo = hasPromo(p);
  return (
    <article className="card">
      <Link href={`/produto/${p.slug}`} className="card-img">
        <img src={p.images[0] || '/placeholders/produto.svg'} alt={p.name} loading="lazy" />
        <div className="tags">
          {promo && <span className="tag tag-red">-{discountPercent(p)}%</span>}
          {p.is_new && <span className="tag">Novo</span>}
          {p.stock <= 0 && <span className="tag tag-gray">Esgotado</span>}
        </div>
      </Link>
      <div className="card-body">
        {catName && <span className="cat">{catName}</span>}
        <Link href={`/produto/${p.slug}`} className="card-title">
          {p.name}
        </Link>
        <div className="price">
          {promo && <s>{brl(p.price)}</s>}
          <strong>{brl(unitPrice(p))}</strong>
        </div>
        {p.stock > 0 && p.stock <= 5 && <span className="low">Restam {p.stock}</span>}
        <AddToCart product={p} />
      </div>
    </article>
  );
}

export function Section({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <section className="section">
      <div className="container">
        <div className="section-head">
          <h2>{title}</h2>
          {href && (
            <Link href={href} className="link">
              Ver tudo →
            </Link>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
