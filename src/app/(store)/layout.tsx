import { CartProvider } from '@/components/CartProvider';
import { Footer, Header } from '@/components/Layout';
import { WhatsAppFloat } from '@/components/StoreBits';
import { getSettings } from '@/lib/data';

export const revalidate = 30;

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const s = await getSettings();
  const accent = /^#[0-9a-fA-F]{6}$/.test(s.theme.accent) ? s.theme.accent : '#b08d57';
  return (
    <div className={`store${s.theme.mode === 'escuro' ? ' dark' : ''}`} style={{ ['--gold' as string]: accent }}>
      <CartProvider>
        <Header s={s} />
        <main id="conteudo">{children}</main>
        <Footer s={s} />
        <WhatsAppFloat phone={s.whatsapp} name={s.name} />
      </CartProvider>
    </div>
  );
}
