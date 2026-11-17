import type { OrderStatus } from './types';

export const brl = (n: number | null | undefined): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(n) || 0);

export const onlyDigits = (s: string): string => (s || '').replace(/\D/g, '');

export function slugify(s: string): string {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function formatPhone(s: string): string {
  const d = onlyDigits(s).replace(/^55(?=\d{10,11}$)/, '');
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return s;
}

/** Número para wa.me: adiciona 55 quando o usuário digitou só DDD+número. */
export function whatsappNumber(s: string): string {
  const d = onlyDigits(s);
  return d.length === 10 || d.length === 11 ? `55${d}` : d;
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  aguardando_pagamento: 'Aguardando pagamento',
  pago: 'Pago',
  em_separacao: 'Em separação',
  enviado: 'Enviado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
};

export const STATUS_ORDER: OrderStatus[] = [
  'aguardando_pagamento',
  'pago',
  'em_separacao',
  'enviado',
  'entregue',
  'cancelado',
];

export const PAYMENT_LABEL = { pix: 'PIX', cartao: 'Cartão de crédito', whatsapp: 'Combinar no WhatsApp' } as const;

export const dateBR = (iso: string): string =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
