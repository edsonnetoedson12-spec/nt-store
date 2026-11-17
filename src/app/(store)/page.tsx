import Link from 'next/link';
import { getCategories, getSettings, getTestimonials, listProducts } from '@/lib/data';
import { HeroSlider } from '@/components/StoreBits';
import { ProductCard, Section } from '@/components/Layout';
import { whatsappNumber } from '@/lib/format';

export const revalidate = 30;

export default async function Home() {
  const [s, cats, best, news, promo, tests] = await Promise.all([
    getSettings(),
    getCategories(),
    listProducts({ sort: 'vendidos', limit: 8 }),
    listProducts({ isNew: true, limit: 4 }),
    listProducts({ promo: true, limit: 4 }),
    getTestimonials(),
  ]);
  const catName = new Map(cats.map((c) => [c.id, c.name]));
  const wa = whatsappNumber(s.whatsapp);

  return (
    <>
      <HeroSlider banners={s.banners} title={s.hero.title} subtitle={s.hero.subtitle} cta={s.hero.cta} />

      {s.phrases.length > 0 && (
        <div className="phrases">
          <div className="container phrases-row">
            {s.phrases.map((p, i) => (
              <span key={i}>✦ {p}</span>
            ))}
          </div>
        </div>
      )}

      {cats.length > 0 && (
        <Section title={s.sections.categories}>
          <div className="cats">
            {cats.map((c) => (
              <Link key={c.id} href={`/loja?categoria=${c.slug}`} className="cat-tile">
                <span>{c.name}</span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {best.length > 0 && (
        <Section title={s.sections.bestsellers} href="/loja?ordem=vendidos">
          <div className="grid">
            {best.map((p) => (
              <ProductCard key={p.id} p={p} catName={p.category_id ? catName.get(p.category_id) : undefined} />
            ))}
          </div>
        </Section>
      )}

      {news.length > 0 && (
        <Section title={s.sections.news} href="/loja?novidades=1">
          <div className="grid">
            {news.map((p) => (
              <ProductCard key={p.id} p={p} catName={p.category_id ? catName.get(p.category_id) : undefined} />
            ))}
          </div>
        </Section>
      )}

      {promo.length > 0 && (
        <section className="section promo-band">
          <div className="container">
            <div className="section-head">
              <h2>{s.sections.promo}</h2>
              <Link href="/loja?promocao=1" className="link">
                Ver tudo →
              </Link>
            </div>
            <div className="grid">
              {promo.map((p) => (
                <ProductCard key={p.id} p={p} catName={p.category_id ? catName.get(p.category_id) : undefined} />
              ))}
            </div>
          </div>
        </section>
      )}

      {best.length + news.length + promo.length === 0 && (
        <section className="section">
          <div className="container empty">Em breve, novos acessórios por aqui.</div>
        </section>
      )}

      {tests.length > 0 && (
        <Section title={s.sections.testimonials}>
          <div className="tests">
            {tests.map((t) => (
              <blockquote key={t.id} className="test">
                <div className="stars" aria-label={`${t.rating} de 5 estrelas`}>
                  {'★'.repeat(t.rating)}
                  <span>{'★'.repeat(5 - t.rating)}</span>
                </div>
                <p>“{t.text}”</p>
                <footer>— {t.name}</footer>
              </blockquote>
            ))}
          </div>
        </Section>
      )}

      {wa && (
        <section className="section cta">
          <div className="container cta-inner">
            <h2>Precisa de ajuda para escolher?</h2>
            <p>Fale com a nossa equipe pelo WhatsApp e receba uma indicação personalizada.</p>
            <a className="btn btn-gold" href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
              Chamar no WhatsApp
            </a>
          </div>
        </section>
      )}
    </>
  );
}
