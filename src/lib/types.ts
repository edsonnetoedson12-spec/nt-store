export type Category = { id: string; name: string; slug: string; sort: number };

export type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  promo_price: number | null;
  cost: number;
  stock: number;
  category_id: string | null;
  images: string[];
  featured: boolean;
  is_new: boolean;
  active: boolean;
  sold_count: number;
  created_at: string;
};

export type OrderStatus =
  | 'aguardando_pagamento'
  | 'pago'
  | 'em_separacao'
  | 'enviado'
  | 'entregue'
  | 'cancelado';

export type OrderItem = {
  id: string;
  order_id: string;
  product_id: string | null;
  name: string;
  image: string | null;
  price: number;
  cost: number;
  quantity: number;
};

export type Order = {
  id: string;
  number: number;
  customer_id: string | null;
  status: OrderStatus;
  payment_method: 'pix' | 'cartao' | 'whatsapp';
  delivery: 'entrega' | 'retirada';
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  coupon_code: string | null;
  address: Record<string, string>;
  notes: string | null;
  tracking_code: string | null;
  created_at: string;
  order_items?: OrderItem[];
  customers?: Customer | null;
};

export type Customer = { id: string; name: string; phone: string; email: string | null; created_at: string };

export type Coupon = {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  min_order: number;
  max_uses: number | null;
  used_count: number;
  expires_at: string | null;
  active: boolean;
};

export type Testimonial = { id: string; name: string; text: string; rating: number; active: boolean };

export type Banner = { image: string; title: string; subtitle: string; link: string };

export type StoreSettings = {
  name: string;
  tagline: string;
  logo_url: string;
  whatsapp: string;
  email: string;
  phone: string;
  address: string;
  instagram: string;
  facebook: string;
  tiktok: string;
  phrases: string[];
  hero: { title: string; subtitle: string; cta: string };
  banners: Banner[];
  sections: { bestsellers: string; news: string; promo: string; categories: string; testimonials: string };
  shipping: { flat: number; free_above: number; pickup: boolean };
  payments: { pix: boolean; cartao: boolean; whatsapp: boolean };
  about: string;
  theme: { mode: 'claro' | 'escuro'; accent: string };
};
