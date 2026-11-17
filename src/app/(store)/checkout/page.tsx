import type { Metadata } from 'next';
import { getSettings } from '@/lib/data';
import CheckoutForm from './CheckoutForm';

export const metadata: Metadata = { title: 'Finalizar compra', robots: { index: false } };

export default async function CheckoutPage() {
  const s = await getSettings();
  return <CheckoutForm shipping={s.shipping} payments={s.payments} hasMp={false} />;
}
