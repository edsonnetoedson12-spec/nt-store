import type { StoreSettings } from './types';

export const DEFAULT_SETTINGS: StoreSettings = {
  name: 'NT',
  tagline: 'Acessórios que contam a sua história',
  logo_url: '',
  whatsapp: '',
  email: '',
  phone: '',
  address: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  phrases: [],
  hero: { title: 'Acessórios para brilhar todos os dias', subtitle: 'Design sofisticado e qualidade premium.', cta: 'Ver coleção' },
  banners: [],
  sections: { bestsellers: 'Mais vendidos', news: 'Novidades', promo: 'Promoções', categories: 'Compre por categoria', testimonials: 'O que dizem nossas clientes' },
  shipping: { flat: 0, free_above: 0, pickup: true },
  payments: { pix: true, cartao: true, whatsapp: true },
  about: '',
};
