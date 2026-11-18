import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategories, listProducts, type ProductQuery } from '@/lib/data';
import { ProductCard } from '@/components/Layout';
import { ShopFilters } from '@/components/StoreBits';

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';
const num = (v: string) => (v !== '' && Number.isFinite(Number(v.replace(',', '.'))) ? Number(v.replace(',', '.')) : undefined);

export const metadata: Metadata = {
  title: 'Loja de acessórios',
  description: 'Capas, películas, carregadores, cabos, fones de ouvido e outros acessórios para celular com qualidade e preço justo.',
  alternates: { canonical: '/loja' },
};

export default async function Shop({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q).slice(0, 80);
  const categoria = one(sp.categoria);
  const ordem = one(sp.ordem) as ProductQuery['sort'];
  const min = num(one(sp.min));
  const max = num(one(sp.max));
  const novidades = one(sp.novidades) === '1';
  const promocao = one(sp.promocao) === '1';

  const [cats, products] = await Promise.all([
    getCategories(),
    listProducts({ q, category: categoria || undefined, min, max, sort: ordem || 'novos', isNew: novidades, promo: promocao }),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const keep = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (ordem) p.set('ordem', ordem);
    if (novidades) p.set('novidades', '1');
    if (promocao) p.set('promocao', '1');
    for (const [k, v] of Object.entries(extra)) v ? p.set(k, v) : p.delete(k);
    const s = p.toString();
    return `/loja${s ? `?${s}` : ''}`;
  };
  const title = promocao ? 'Promoções' : novidades ? 'Novidades' : cats.find((c) => c.slug === categoria)?.name || 'Todos os acessórios';

  return (
    <div className="container shop">
      <h1 className="page-title">{q ? `Resultados para “${q}”` : title}</h1>
      <div className="shop-layout">
        <aside className="filters">
          <ShopFilters>
          <form method="get" action="/loja">
            <label>
              Buscar
              <input name="q" defaultValue={q} placeholder="Nome do produto" />
            </label>
            <label>
              Categoria
              <select name="categoria" defaultValue={categoria}>
                <option value="">Todas</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="two">
              <label>
                Preço mín.
                <input name="min" inputMode="decimal" defaultValue={min ?? ''} placeholder="0" />
              </label>
              <label>
                Preço máx.
                <input name="max" inputMode="decimal" defaultValue={max ?? ''} placeholder="500" />
              </label>
            </div>
            <label>
              Ordenar por
              <select name="ordem" defaultValue={ordem || 'novos'}>
                <option value="novos">Mais recentes</option>
                <option value="vendidos">Mais vendidos</option>
                <option value="menor">Menor preço</option>
                <option value="maior">Maior preço</option>
              </select>
            </label>
            {novidades && <input type="hidden" name="novidades" value="1" />}
            {promocao && <input type="hidden" name="promocao" value="1" />}
            <button className="btn btn-dark" type="submit">
              Aplicar filtros
            </button>
            <Link href="/loja" className="link center">
              Limpar
            </Link>
          </form>
          </ShopFilters>
          <div className="chips">
            <Link className={!categoria ? 'chip on' : 'chip'} href={keep({ categoria: '' })}>
              Todas
            </Link>
            {cats.map((c) => (
              <Link key={c.id} className={categoria === c.slug ? 'chip on' : 'chip'} href={keep({ categoria: c.slug })}>
                {c.name}
              </Link>
            ))}
          </div>
        </aside>
        <div>
          <p className="muted">{products.length} {products.length === 1 ? 'produto' : 'produtos'}</p>
          {products.length === 0 ? (
            <div className="empty">Nenhum produto encontrado. Tente outros filtros.</div>
          ) : (
            <div className="grid g3">
              {products.map((p) => (
                <ProductCard key={p.id} p={p} catName={p.category_id ? catName.get(p.category_id) : undefined} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
