import type { Metadata } from 'next';
import { getSettings } from '@/lib/data';
import CartView from './CartView';

export const metadata: Metadata = { title: 'Carrinho', robots: { index: false } };

export default async function CartPage() {
  const s = await getSettings();
  return <CartView shipping={s.shipping} />;
}
