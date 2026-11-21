import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategories, getProduct, getVariants, getSettings, listProducts, SITE_URL } from '@/lib/data';
import { AddToCart, ProductGallery } from '@/components/StoreBits';
import { ProductCard, Section } from '@/components/Layout';
import { brl } from '@/lib/format';
import { discountPercent, hasPromo, unitPrice } from '@/lib/pricing';

export const revalidate = 30;
type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const p = await getProduct(slug);
  if (!p) return { title: 'Produto não encontrado' };
  const desc = (p.description || `${p.name} na NT Acessórios`).slice(0, 160);
  return {
    title: p.name,
    description: desc,
    alternates: { canonical: `/produto/${p.slug}` },
    openGraph: { title: p.name, description: desc, images: p.images.slice(0, 1), type: 'website' },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const [p, cats, s] = await Promise.all([getProduct(slug), getCategories(), getSettings()]);
  if (!p) notFound();
  const variants = p.has_variants ? await getVariants(p.id) : [];
  const cat = cats.find((c) => c.id === p.category_id);
  const related = (await listProducts({ category: cat?.slug, limit: 5 })).filter((x) => x.id !== p.id).slice(0, 4);
  const promo = hasPromo(p);
  const abs = (u: string) => (u.startsWith('http') ? u : `${SITE_URL}${u}`);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description || p.name,
    image: p.images.map(abs),
    brand: { '@type': 'Brand', name: p.brand || s.name },
    ...(p.sku ? { sku: p.sku } : {}),
    offers: {
      '@type': 'Offer',
      priceCurrency: 'BRL',
      price: unitPrice(p).toFixed(2),
      availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/produto/${p.slug}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <div className="container pdp">
        <nav className="crumbs" aria-label="Você está em">
          <Link href="/">Início</Link> / <Link href="/loja">Loja</Link>
          {cat && (
            <>
              {' '}
              / <Link href={`/loja?categoria=${cat.slug}`}>{cat.name}</Link>
            </>
          )}
        </nav>
        <div className="pdp-grid">
          <ProductGallery images={p.images} alt={p.name} />
          <div className="pdp-info">
            {cat && <span className="cat">{cat.name}</span>}
            <h1>{p.name}</h1>
            <div className="price big">
              {promo && <s>{brl(p.price)}</s>}
              <strong>{brl(unitPrice(p))}</strong>
              {promo && <span className="tag tag-red">-{discountPercent(p)}%</span>}
            </div>
            <p className="muted">
              {p.stock > 0 ? (p.stock <= 5 ? `Últimas ${p.stock} unidades em estoque` : 'Em estoque — envio rápido') : 'Produto esgotado'}
            </p>
            <AddToCart product={p} big variants={variants} />
            <div className="desc">
              <h2>Descrição</h2>
              <p>{p.description || 'Sem descrição.'}</p>
            </div>
            <ul className="perks">
              <li>Pagamento seguro por PIX ou cartão</li>
              <li>Embalagem premium para presente</li>
              <li>Atendimento direto pelo WhatsApp</li>
            </ul>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <Section title="Você também pode gostar">
          <div className="grid">
            {related.map((r) => (
              <ProductCard key={r.id} p={r} catName={cat?.name} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
