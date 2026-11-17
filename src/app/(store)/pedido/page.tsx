import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/data';
import { brl, whatsappNumber } from '@/lib/format';

export const metadata: Metadata = { title: 'Pedido recebido', robots: { index: false } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function OrderDone({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const s = await getSettings();
  const n = one(sp.n).replace(/\D/g, '');
  const total = Number(one(sp.t));
  const mp = one(sp.mp);
  const wa = whatsappNumber(s.whatsapp);
  const msg = encodeURIComponent(`Olá! Fiz o pedido #${n} na ${s.name}${total ? ` (${brl(total)})` : ''}. Gostaria de combinar o pagamento/entrega.`);

  return (
    <div className="container page-pad done">
      <div className="done-card">
        <div className="check" aria-hidden="true">✓</div>
        <h1>{mp === 'fail' ? 'Pagamento não concluído' : 'Pedido recebido!'}</h1>
        {n && <p>Número do pedido: <strong>#{n}</strong></p>}
        {total > 0 && <p>Total: <strong>{brl(total)}</strong></p>}
        <p className="muted">
          {mp === 'ok'
            ? 'Pagamento aprovado. Já estamos separando o seu pedido.'
            : mp === 'fail'
              ? 'O pagamento não foi aprovado. Você pode tentar novamente falando com a gente.'
              : 'Assim que o pagamento for confirmado, vamos separar e enviar o seu pedido. Você também pode falar com a gente pelo WhatsApp.'}
        </p>
        <div className="actions">
          {wa && (
            <a className="btn btn-gold" href={`https://wa.me/${wa}?text=${msg}`} target="_blank" rel="noopener noreferrer">
              Falar no WhatsApp
            </a>
          )}
          <Link className="btn btn-dark" href="/loja">
            Continuar comprando
          </Link>
        </div>
      </div>
    </div>
  );
}
