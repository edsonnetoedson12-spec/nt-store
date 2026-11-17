import { CartProvider } from '@/components/CartProvider';
import { Footer, Header } from '@/components/Layout';
import { WhatsAppFloat } from '@/components/StoreBits';
import { getSettings } from '@/lib/data';

export const revalidate = 30;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  return (
    <CartProvider>
      <Header s={s} />
      <main id="conteudo">{children}</main>
      <Footer s={s} />
      <WhatsAppFloat phone={s.whatsapp} name={s.name} />
    </CartProvider>
  );
}
