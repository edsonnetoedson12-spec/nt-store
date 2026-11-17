import { createPublicClient } from './supabase/server';
import type { Category, Product, StoreSettings, Testimonial } from './types';
import { DEFAULT_SETTINGS } from './data-defaults';

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '');

export { DEFAULT_SETTINGS };

const configured = () => {
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return false;
  try {
    return /^https?:$/.test(new URL(url).protocol);
  } catch {
    return false;
  }
};

export async function getSettings(): Promise<StoreSettings> {
  if (!configured()) return DEFAULT_SETTINGS;
  try {
    const { data } = await createPublicClient().from('settings').select('value').eq('key', 'store').maybeSingle();
    const v = (data?.value ?? {}) as Partial<StoreSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...v,
      hero: { ...DEFAULT_SETTINGS.hero, ...v.hero },
      sections: { ...DEFAULT_SETTINGS.sections, ...v.sections },
      shipping: { ...DEFAULT_SETTINGS.shipping, ...v.shipping },
      payments: { ...DEFAULT_SETTINGS.payments, ...v.payments },
      theme: { ...DEFAULT_SETTINGS.theme, ...v.theme },
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function getCategories(): Promise<Category[]> {
  if (!configured()) return [];
  const { data } = await createPublicClient().from('categories').select('*').order('sort').order('name');
  return (data ?? []) as Category[];
}

export type ProductQuery = {
  q?: string;
  category?: string; // slug
  min?: number;
  max?: number;
  sort?: 'novos' | 'menor' | 'maior' | 'vendidos';
  featured?: boolean;
  isNew?: boolean;
  promo?: boolean;
  limit?: number;
};

export async function listProducts(opts: ProductQuery = {}): Promise<Product[]> {
  if (!configured()) return [];
  const sb = createPublicClient();
  let q = sb.from('products').select('*').eq('active', true);
  if (opts.category) {
    const { data: cat } = await sb.from('categories').select('id').eq('slug', opts.category).maybeSingle();
    if (!cat) return [];
    q = q.eq('category_id', cat.id);
  }
  if (opts.q) q = q.ilike('name', `%${opts.q.replace(/[%_,()]/g, ' ').trim()}%`);
  if (opts.featured) q = q.eq('featured', true);
  if (opts.isNew) q = q.eq('is_new', true);
  if (opts.promo) q = q.not('promo_price', 'is', null);
  if (opts.sort === 'menor') q = q.order('price', { ascending: true });
  else if (opts.sort === 'maior') q = q.order('price', { ascending: false });
  else if (opts.sort === 'vendidos') q = q.order('sold_count', { ascending: false });
  else q = q.order('created_at', { ascending: false });
  if (opts.limit) q = q.limit(opts.limit);
  const { data } = await q;
  let list = (data ?? []) as Product[];
  // filtro de preço considera o preço efetivo (promoção quando houver)
  const eff = (p: Product) => (p.promo_price != null && p.promo_price < p.price ? p.promo_price : p.price);
  if (opts.min != null) list = list.filter((p) => eff(p) >= (opts.min as number));
  if (opts.max != null) list = list.filter((p) => eff(p) <= (opts.max as number));
  return list;
}

export async function getProduct(slug: string): Promise<Product | null> {
  if (!configured()) return null;
  const { data } = await createPublicClient().from('products').select('*').eq('slug', slug).eq('active', true).maybeSingle();
  return (data as Product) ?? null;
}

export async function getTestimonials(): Promise<Testimonial[]> {
  if (!configured()) return [];
  const { data } = await createPublicClient().from('testimonials').select('*').eq('active', true).order('created_at', { ascending: false }).limit(6);
  return (data ?? []) as Testimonial[];
}
