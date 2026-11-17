import type { MetadataRoute } from 'next';
import { getCategories, listProducts, SITE_URL } from '@/lib/data';

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  let products: Awaited<ReturnType<typeof listProducts>> = [];
  let cats: Awaited<ReturnType<typeof getCategories>> = [];
  try {
    [products, cats] = await Promise.all([listProducts({}), getCategories()]);
  } catch {
    /* sem banco configurado: sitemap só com as páginas fixas */
  }
  return [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/loja`, changeFrequency: 'daily', priority: 0.9 },
    ...cats.map((c) => ({ url: `${SITE_URL}/loja?categoria=${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...products.map((p) => ({ url: `${SITE_URL}/produto/${p.slug}`, changeFrequency: 'weekly' as const, priority: 0.8, lastModified: p.created_at })),
  ];
}
