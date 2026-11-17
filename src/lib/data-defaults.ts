import type { StoreSettings } from './types';

export const DEFAULT_SETTINGS: StoreSettings = {
  name: 'NT',
  tagline: 'Acessórios para celular com qualidade e preço justo',
  logo_url: '',
  whatsapp: '',
  email: '',
  phone: '',
  address: '',
  instagram: '',
  facebook: '',
  tiktok: '',
  phrases: [],
  hero: { title: 'Tudo para o seu celular em um só lugar', subtitle: 'Capas, películas, carregadores e muito mais.', cta: 'Ver produtos' },
  banners: [],
  sections: { bestsellers: 'Mais vendidos', news: 'Novidades', promo: 'Promoções', categories: 'Compre por categoria', testimonials: 'O que dizem nossas clientes' },
  shipping: { flat: 0, free_above: 0, pickup: true },
  payments: { pix: true, cartao: true, whatsapp: true },
  about: '',
  theme: { mode: 'claro', accent: '#b08d57' },
};
